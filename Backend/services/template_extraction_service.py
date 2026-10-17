"""
LLM-based structure extraction for uploaded PDF templates.

The LLM is used only to identify a document's static headings / field labels
(no embeddings, vector stores or retrieval). Its JSON answer is validated and
normalized here before anything is stored, and filled-in values are stripped.
"""
import json
import logging
import re
import tempfile
import threading
from dataclasses import dataclass
from typing import Dict, List, Optional

from config import Config
from djangoLLM_client import DjangoLLMClient
from services.pdf_service import PdfContent, read_pdf, render_pages_to_images
from services.template_service import FIELD_TYPES, MAX_HEADING_LENGTH

logger = logging.getLogger(__name__)

MAX_FIELDS = 200
# Labels longer than this are almost certainly sentences, not headings
MAX_LABEL_WORDS = 20
# Multi-page scans make large gateway requests that are sometimes dropped. Each retry
# re-renders the pages at a lower resolution (smaller payload); the first try keeps the
# gateway request modest already.
VISION_RENDER_DPIS = (110, 85, 65)

EXTRACTION_SYSTEM_PROMPT = """You are a document-structure analyst. You receive ONE document and must return only its reusable template skeleton: the static headings, section titles and field labels that would appear in every document of this kind, with all filled-in content removed.

Rules:
1. Identify only genuine structural elements that are present in the document:
   - section headings / titles (including numbered or lettered ones);
   - field labels that precede a filled-in value (e.g. "From", "To", "Date", "Subject", "Ref. No.");
   - fixed boilerplate lines that begin a block of free text, such as a salutation ("Respected Sir/Madam") or a closing ("Yours faithfully").
2. Return the LABEL only, never its value. "From: Giri Nadhan" -> "From". "Subject: Request for Leave" -> "Subject". Drop the trailing colon.
3. Never output names of people or organisations, addresses, dates, amounts, ID numbers, property details, or any sentence/paragraph of body text. Do not turn the first words of an ordinary paragraph into a heading.
4. Do not invent headings. The single exception: if the document has an unlabelled free-text body (for example the body of a letter), add one entry "Body" with field_type "paragraph" at the position where that body occurs.
5. Keep the headings in the order they appear. Copy heading wording as written in the document (you may fix obvious OCR mistakes).
6. field_type must be one of:
   - "field": a short label whose value is usually a line or two (From, To, Date, Subject, Name, Address);
   - "section": a heading or fixed line that introduces a block of content (section titles, salutations, closings);
   - "paragraph": an unlabelled free-text region (e.g. "Body").
7. Hierarchy: level 1 = top level; sub-headings nested under a heading get level 2, 3, ... and parent_order = the "order" of their enclosing heading (null for top level).
8. template_name: a short generic name for this kind of document (e.g. "Leave Letter", "Legal Opinion"). It must not contain any names, places or dates from the document.
9. Respond with a single valid JSON object and nothing else - no Markdown, no code fences, no commentary.

JSON schema:
{"template_name": string, "document_type": string, "fields": [{"heading": string, "field_type": "field" | "section" | "paragraph", "order": integer starting at 1, "level": integer >= 1, "parent_order": integer | null}]}"""


class ExtractionError(Exception):
    """Template extraction failed; `message` is safe to show to the user."""

    def __init__(self, message: str, status_code: int = 422):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


@dataclass
class ExtractionResult:
    template_name: str
    document_type: Optional[str]
    fields: List[Dict]  # {heading, field_type, parent_index}
    method: str  # 'text' | 'vision' | 'text+vision'
    page_count: int


_client_lock = threading.Lock()
_client: Optional[DjangoLLMClient] = None


def get_llm_client() -> DjangoLLMClient:
    """Shared gateway client so the auth token is reused across requests."""
    global _client
    with _client_lock:
        if _client is None:
            _client = DjangoLLMClient()
        return _client


def _is_transient_failure(response) -> bool:
    """True for gateway answers worth retrying: dropped connection, timeout, 5xx."""
    if not isinstance(response, dict) or 'content' in response:
        return False
    status = response.get('status_code')
    if isinstance(status, int):
        return status >= 500 or status == 429
    error = str(response.get('error', '')).lower()
    return 'connection error' in error or 'timeout' in error


# --------------------------------------------------------------------- parsing

def _response_text(response) -> str:
    """Pull the assistant text out of a gateway response or raise ExtractionError."""
    if not isinstance(response, dict):
        raise ExtractionError('The LLM gateway returned an unexpected response.', 502)
    if response.get('error') or 'content' not in response:
        status = response.get('status_code')
        detail = response.get('error') or response.get('detail')
        if isinstance(detail, (dict, list)):
            detail = json.dumps(detail)[:200]
        if status in (401, 403):
            raise ExtractionError('The LLM gateway rejected the credentials. Check DJANGO_LLM_EMAIL / DJANGO_LLM_OTP.', 502)
        message = 'The LLM gateway request failed'
        if status:
            message += f' (HTTP {status})'
        if detail:
            message += f': {str(detail)[:200]}'
        raise ExtractionError(message + '.', 502)

    content = response['content']
    if isinstance(content, list):  # multimodal-style content parts
        content = ''.join(part.get('text', '') if isinstance(part, dict) else str(part) for part in content)
    if not isinstance(content, str) or not content.strip():
        raise ExtractionError('The LLM returned an empty response.', 502)
    return content


def parse_llm_json(text: str) -> Dict:
    """Parse the model's JSON, tolerating code fences or stray text around the object."""
    candidate = text.strip()
    fence = re.match(r'^```(?:json)?\s*(.*?)\s*```$', candidate, re.DOTALL | re.IGNORECASE)
    if fence:
        candidate = fence.group(1)
    try:
        data = json.loads(candidate)
    except json.JSONDecodeError:
        start, end = candidate.find('{'), candidate.rfind('}')
        if start == -1 or end <= start:
            raise ExtractionError('The LLM did not return valid JSON. Please try again.', 502)
        try:
            data = json.loads(candidate[start:end + 1])
        except json.JSONDecodeError:
            raise ExtractionError('The LLM did not return valid JSON. Please try again.', 502)
    if not isinstance(data, dict):
        raise ExtractionError('The LLM response had an unexpected structure.', 502)
    return data


_TYPE_ALIASES = {
    'field': 'field', 'label': 'field', 'input': 'field', 'line': 'field',
    'section': 'section', 'heading': 'section', 'title': 'section', 'subheading': 'section',
    'sub-heading': 'section', 'subsection': 'section', 'salutation': 'section', 'closing': 'section',
    'paragraph': 'paragraph', 'body': 'paragraph', 'text': 'paragraph',
}


def _as_int(value) -> Optional[int]:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    if isinstance(value, str) and value.strip().lstrip('-').isdigit():
        return int(value.strip())
    return None


def clean_extracted_heading(raw) -> Optional[str]:
    """Normalize one heading; strip any filled-in value. Returns None to drop it."""
    if not isinstance(raw, str):
        return None
    heading = ' '.join(raw.split()).strip()
    # "Label: value" -> "Label" (only for short labels, so titles containing a colon survive)
    if ':' in heading:
        label, value = heading.split(':', 1)
        if value.strip() and 0 < len(label.split()) <= 5:
            heading = label.strip()
    heading = heading.rstrip(' :;-–—').strip()
    if not heading or len(heading) > MAX_HEADING_LENGTH or len(heading.split()) > MAX_LABEL_WORDS:
        return None
    return heading


def normalize_extraction(data: Dict) -> Dict:
    """Validate the LLM JSON and convert it to {template_name, document_type, fields[{heading, field_type, parent_index}]}."""
    raw_fields = data.get('fields')
    if not isinstance(raw_fields, list):
        raise ExtractionError('The LLM response did not contain a list of fields.', 502)

    items = []
    for position, raw in enumerate(raw_fields):
        if not isinstance(raw, dict):
            continue
        heading = clean_extracted_heading(raw.get('heading'))
        if not heading:
            continue
        field_type = _TYPE_ALIASES.get(str(raw.get('field_type', '')).strip().lower(), 'section')
        order = _as_int(raw.get('order'))
        level = _as_int(raw.get('level'))
        items.append({
            'heading': heading,
            'field_type': field_type if field_type in FIELD_TYPES else 'section',
            'order': order if order is not None else 10_000 + position,
            'position': position,
            'level': min(max(level or 1, 1), 6),
            'parent_order': _as_int(raw.get('parent_order')),
        })

    items.sort(key=lambda item: (item['order'], item['position']))

    # Drop consecutive duplicates (same heading at the same level)
    deduped = []
    for item in items:
        if deduped and deduped[-1]['heading'].lower() == item['heading'].lower() \
                and deduped[-1]['level'] == item['level']:
            continue
        deduped.append(item)
    items = deduped[:MAX_FIELDS]

    if not items:
        raise ExtractionError('No headings or field labels could be identified in this document.', 422)

    # Resolve hierarchy: explicit parent_order first, else nearest earlier field with a lower level
    order_to_index = {}
    fields = []
    for index, item in enumerate(items):
        parent_index = None
        if item['parent_order'] is not None and item['parent_order'] in order_to_index:
            parent_index = order_to_index[item['parent_order']]
        elif item['level'] > 1:
            for back in range(index - 1, -1, -1):
                if items[back]['level'] < item['level']:
                    parent_index = back
                    break
        order_to_index.setdefault(item['order'], index)
        fields.append({'heading': item['heading'], 'field_type': item['field_type'], 'parent_index': parent_index})

    name = data.get('template_name')
    name = ' '.join(name.split())[:120] if isinstance(name, str) and name.strip() else ''
    doc_type = data.get('document_type')
    doc_type = ' '.join(doc_type.split())[:120] if isinstance(doc_type, str) and doc_type.strip() else None
    return {'template_name': name, 'document_type': doc_type, 'fields': fields}


# ------------------------------------------------------------------ extraction

def _build_user_prompt(filename: str, pdf: PdfContent, text: str, truncated: bool, image_count: int) -> str:
    lines = [f'Extract the template structure of this document (file: "{filename}", {pdf.page_count} page(s)).']
    if text:
        lines.append('Text extracted from the PDF follows between <document> tags.')
        if truncated:
            lines.append('The text was truncated because the document is long; extract structure from what is given.')
    if image_count:
        lines.append(f'{image_count} page image(s) are attached for pages without a text layer (scanned). Read them as part of the document.')
    lines.append('Return the JSON object only.')
    if text:
        lines.append(f'<document>\n{text}\n</document>')
    return '\n'.join(lines)


def extract_template_structure(pdf_bytes: bytes, filename: str,
                               client: Optional[DjangoLLMClient] = None) -> ExtractionResult:
    pdf = read_pdf(pdf_bytes, Config.TEMPLATE_PDF_MAX_PAGES)

    if not pdf.text and not pdf.scanned_pages:
        raise ExtractionError('No readable content was found in the PDF.', 422)

    text = pdf.text
    truncated = len(text) > Config.LLM_MAX_INPUT_CHARS
    if truncated:
        text = text[:Config.LLM_MAX_INPUT_CHARS]

    client = client or get_llm_client()
    if not client.is_configured:
        raise ExtractionError(
            'The LLM gateway is not configured. Set DJANGO_LLM_EMAIL and DJANGO_LLM_OTP in Backend/.env.', 503
        )

    system = {'role': 'system', 'content': EXTRACTION_SYSTEM_PROMPT}

    with _client_lock:  # requests.Session + token renewal are shared state
        if pdf.scanned_pages:
            response = None
            for attempt, dpi in enumerate(VISION_RENDER_DPIS, start=1):
                with tempfile.TemporaryDirectory(prefix='template_ocr_') as tmp_dir:
                    images = render_pages_to_images(pdf_bytes, pdf.scanned_pages, tmp_dir,
                                                    Config.TEMPLATE_OCR_MAX_PAGES, dpi=dpi)
                    user = {'role': 'user', 'content': _build_user_prompt(filename, pdf, text, truncated, len(images))}
                    logger.info("Template extraction via vision model: %s page image(s) at %s dpi, %s text page(s) (attempt %s)",
                                len(images), dpi, pdf.text_page_count, attempt)
                    response = client.query_with_image(
                        Config.DJANGO_LLM_VISION_PROVIDER, Config.DJANGO_LLM_VISION_MODEL,
                        [system, user], images, complexity_score=0.7,
                    )
                if not _is_transient_failure(response):
                    break
                logger.warning("LLM gateway call failed transiently (%s); retrying with smaller images",
                               response.get('error') or response.get('status_code'))
            method = 'text+vision' if pdf.text else 'vision'
        else:
            user = {'role': 'user', 'content': _build_user_prompt(filename, pdf, text, truncated, 0)}
            logger.info("Template extraction via text model: %s chars from %s page(s)", len(text), pdf.page_count)
            for attempt in range(2):
                response = client.query_llm(
                    Config.DJANGO_LLM_PROVIDER, Config.DJANGO_LLM_MODEL, [system, user], complexity_score=0.5,
                )
                if not _is_transient_failure(response):
                    break
                logger.warning("LLM gateway call failed transiently (%s); retrying",
                               response.get('error') or response.get('status_code'))
            method = 'text'

    normalized = normalize_extraction(parse_llm_json(_response_text(response)))
    return ExtractionResult(
        template_name=normalized['template_name'],
        document_type=normalized['document_type'],
        fields=normalized['fields'],
        method=method,
        page_count=pdf.page_count,
    )
