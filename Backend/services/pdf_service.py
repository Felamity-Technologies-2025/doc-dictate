"""
PDF reading for template extraction: text layer extraction, with page
images rendered for pages that have no usable text (scanned PDFs) so they
can be read by a vision-capable LLM.
"""
import logging
import os
from dataclasses import dataclass, field
from typing import List

import pymupdf

logger = logging.getLogger(__name__)

# A page with fewer extractable characters than this is treated as scanned
MIN_TEXT_CHARS_PER_PAGE = 25
OCR_RENDER_DPI = 150


class PdfProcessingError(ValueError):
    """The PDF cannot be read; the message is safe to show to the user."""


@dataclass
class PdfContent:
    page_count: int
    text: str = ''
    text_page_count: int = 0
    scanned_pages: List[int] = field(default_factory=list)  # 0-based page indexes without a text layer

    @property
    def is_scanned(self) -> bool:
        return bool(self.scanned_pages)


def is_pdf_bytes(data: bytes) -> bool:
    # The PDF header may be preceded by a few junk bytes; the spec allows up to 1024
    return b'%PDF-' in data[:1024]


def read_pdf(data: bytes, max_pages: int) -> PdfContent:
    """Extract per-page text in reading order and detect scanned pages."""
    if not is_pdf_bytes(data):
        raise PdfProcessingError('The uploaded file is not a valid PDF document.')
    try:
        doc = pymupdf.open(stream=data, filetype='pdf')
    except Exception:
        raise PdfProcessingError('The PDF could not be opened. It may be corrupted.')

    try:
        if doc.needs_pass:
            raise PdfProcessingError('The PDF is password protected. Please upload an unlocked copy.')
        if doc.page_count == 0:
            raise PdfProcessingError('The PDF has no pages.')
        if doc.page_count > max_pages:
            raise PdfProcessingError(
                f'The PDF has {doc.page_count} pages; templates are limited to {max_pages} pages.'
            )

        content = PdfContent(page_count=doc.page_count)
        parts = []
        for index, page in enumerate(doc):
            try:
                text = page.get_text('text', sort=True).strip()
            except Exception:
                logger.warning("Text extraction failed on page %s", index + 1, exc_info=True)
                text = ''
            if len(text) >= MIN_TEXT_CHARS_PER_PAGE:
                parts.append(f'--- Page {index + 1} ---\n{text}')
                content.text_page_count += 1
            else:
                content.scanned_pages.append(index)
        content.text = '\n\n'.join(parts)
        return content
    finally:
        doc.close()


def render_pages_to_images(data: bytes, page_indexes: List[int], out_dir: str, limit: int,
                           dpi: int = OCR_RENDER_DPI) -> List[str]:
    """Render the given pages to JPEG files in out_dir (caller owns cleanup). Returns file paths."""
    paths = []
    doc = pymupdf.open(stream=data, filetype='pdf')
    try:
        for index in page_indexes[:limit]:
            pixmap = doc[index].get_pixmap(dpi=dpi)
            path = os.path.join(out_dir, f'page_{index + 1}.jpg')
            with open(path, 'wb') as fh:
                fh.write(pixmap.tobytes('jpeg', jpg_quality=80))
            paths.append(path)
    finally:
        doc.close()
    return paths
