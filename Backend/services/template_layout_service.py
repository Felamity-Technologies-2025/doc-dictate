"""
Page layout of an uploaded template: page size, which page each heading is on,
where it sits (vertical position, left / centre / right) and the pictures
(logos, banners, signatures...) with their exact position on the page.

All positions are fractions of the page (x, w of the page width; y, h of the
page height) so the editor and the exports can scale them to any size.

The LLM decides WHICH lines are headings; this module measures WHERE they are
from the source file itself (PDF text layer / DOCX paragraphs). The LLM's own
page / position guesses are used only where the file has no text to measure
(scanned pages).
"""
import logging
import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import pymupdf

logger = logging.getLogger(__name__)

MAX_IMAGES = 60
MAX_IMAGE_BYTES_TOTAL = 15 * 1024 * 1024
# Pictures covering more of the page than this are page scans / backgrounds, not logos
MAX_IMAGE_PAGE_AREA = 0.6
MIN_IMAGE_SIDE_PT = 12
IMAGE_RENDER_DPI = 150
BROWSER_IMAGE_TYPES = {'image/png', 'image/jpeg', 'image/gif'}

_W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
_WP = '{http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing}'
_A = '{http://schemas.openxmlformats.org/drawingml/2006/main}'
_R = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
EMU_PER_PT = 12700


@dataclass
class LayoutImage:
    page: int          # 1-based
    x: float
    y: float
    w: float
    h: float
    mime: str
    data: bytes


@dataclass
class LayoutLine:
    """A line / paragraph of source text with its measured placement."""
    page: int
    y: float
    text: str
    align: Optional[str]   # 'left' | 'center' | 'right'
    norm: str = ''


@dataclass
class TemplateLayout:
    page_count: int
    page_width: float      # points
    page_height: float     # points
    lines: List[LayoutLine] = field(default_factory=list)
    images: List[LayoutImage] = field(default_factory=list)
    measured_pages: set = field(default_factory=set)  # pages whose text could be measured
    llm_parts: List[Tuple[int, str]] = field(default_factory=list)  # DOCX: (page, line) for the LLM


def _norm(text: str) -> str:
    return re.sub(r'[^0-9a-z]+', '', (text or '').lower())


def _clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def _encode_pixmap(pix: 'pymupdf.Pixmap') -> Tuple[str, bytes]:
    """PNG for small / flat pictures, JPEG for large photographic ones."""
    if pix.alpha:
        pix = pymupdf.Pixmap(pix, 0)
    png = pix.tobytes('png')
    if len(png) <= 300 * 1024:
        return 'image/png', png
    return 'image/jpeg', pix.tobytes('jpeg', jpg_quality=85)


def _add_image(layout: TemplateLayout, image: LayoutImage) -> None:
    used = sum(len(i.data) for i in layout.images)
    if len(layout.images) >= MAX_IMAGES or used + len(image.data) > MAX_IMAGE_BYTES_TOTAL:
        logger.info("Template image limit reached; skipping an image on page %s", image.page)
        return
    layout.images.append(image)


def _merge_rects(rects: List[pymupdf.Rect]) -> List[pymupdf.Rect]:
    """Union overlapping rectangles (pictures drawn as several tiles become one)."""
    merged: List[pymupdf.Rect] = []
    for rect in sorted(rects, key=lambda r: (r.y0, r.x0)):
        for index, other in enumerate(merged):
            if rect.intersects(other):
                merged[index] = other | rect
                break
        else:
            merged.append(pymupdf.Rect(rect))
    # A union can create new overlaps; repeat until stable
    if len(merged) < len(rects):
        return _merge_rects(merged)
    return merged


def _line_align(x0: float, x1: float, page_width: float, text_left: float, text_right: float) -> str:
    center = (x0 + x1) / 2
    if x0 > page_width * 0.5 and x1 >= text_right - page_width * 0.06:
        return 'right'
    if abs(center - page_width / 2) <= page_width * 0.06 and x0 > text_left + page_width * 0.08:
        return 'center'
    return 'left'


# --------------------------------------------------------------------- PDF

def pdf_layout(pdf_bytes: bytes, max_pages: int) -> TemplateLayout:
    doc = pymupdf.open(stream=pdf_bytes, filetype='pdf')
    try:
        first = doc[0].rect
        layout = TemplateLayout(page_count=min(doc.page_count, max_pages),
                                page_width=first.width, page_height=first.height)
        for index in range(layout.page_count):
            page = doc[index]
            rect = page.rect
            width, height = rect.width or 1, rect.height or 1

            # Text lines with their position (only pages that have a text layer)
            raw_lines = []
            try:
                for block in page.get_text('dict')['blocks']:
                    for line in block.get('lines', []):
                        text = ''.join(span.get('text', '') for span in line.get('spans', [])).strip()
                        if text:
                            raw_lines.append((pymupdf.Rect(line['bbox']), text))
            except Exception:
                logger.debug("Text layout extraction failed on page %s", index + 1, exc_info=True)
            if sum(len(t) for _, t in raw_lines) >= 25:
                layout.measured_pages.add(index + 1)
                text_left = min(r.x0 for r, _ in raw_lines)
                text_right = max(r.x1 for r, _ in raw_lines)
                for bbox, text in sorted(raw_lines, key=lambda item: (round(item[0].y0), item[0].x0)):
                    layout.lines.append(LayoutLine(
                        page=index + 1, y=_clamp((bbox.y0 - rect.y0) / height), text=text,
                        align=_line_align(bbox.x0 - rect.x0, bbox.x1 - rect.x0, width,
                                          text_left - rect.x0, text_right - rect.x0),
                        norm=_norm(text),
                    ))

            # Embedded pictures, rendered as they appear on the page
            rects = []
            try:
                for info in page.get_image_info():
                    bbox = pymupdf.Rect(info['bbox']) & rect
                    if bbox.is_empty or bbox.width < MIN_IMAGE_SIDE_PT or bbox.height < MIN_IMAGE_SIDE_PT:
                        continue
                    if (bbox.width * bbox.height) / (width * height) > MAX_IMAGE_PAGE_AREA:
                        continue  # page scan or background
                    rects.append(bbox)
            except Exception:
                logger.debug("Image listing failed on page %s", index + 1, exc_info=True)
            for bbox in _merge_rects(rects):
                try:
                    pix = page.get_pixmap(clip=bbox, dpi=IMAGE_RENDER_DPI, alpha=False)
                    mime, data = _encode_pixmap(pix)
                except Exception:
                    logger.debug("Image render failed on page %s", index + 1, exc_info=True)
                    continue
                _add_image(layout, LayoutImage(
                    page=index + 1,
                    x=_clamp((bbox.x0 - rect.x0) / width), y=_clamp((bbox.y0 - rect.y0) / height),
                    w=_clamp(bbox.width / width), h=_clamp(bbox.height / height),
                    mime=mime, data=data,
                ))
        return layout
    finally:
        doc.close()


def crop_pdf_regions(pdf_bytes: bytes, layout: TemplateLayout, regions: List[Dict]) -> None:
    """Add pictures the vision model located on scanned pages (boxes as page fractions)."""
    if not regions:
        return
    doc = pymupdf.open(stream=pdf_bytes, filetype='pdf')
    try:
        for region in regions:
            page_no = region['page']
            if page_no < 1 or page_no > layout.page_count or page_no in layout.measured_pages:
                continue  # text pages already had their real images extracted
            page = doc[page_no - 1]
            rect = page.rect
            clip = pymupdf.Rect(rect.x0 + region['x'] * rect.width, rect.y0 + region['y'] * rect.height,
                                rect.x0 + (region['x'] + region['w']) * rect.width,
                                rect.y0 + (region['y'] + region['h']) * rect.height) & rect
            if clip.is_empty or clip.width < MIN_IMAGE_SIDE_PT or clip.height < MIN_IMAGE_SIDE_PT:
                continue
            try:
                mime, data = _encode_pixmap(page.get_pixmap(clip=clip, dpi=IMAGE_RENDER_DPI, alpha=False))
            except Exception:
                logger.debug("Region crop failed on page %s", page_no, exc_info=True)
                continue
            _add_image(layout, LayoutImage(page=page_no, x=region['x'], y=region['y'],
                                           w=region['w'], h=region['h'], mime=mime, data=data))
    finally:
        doc.close()


# -------------------------------------------------------------------- DOCX

def _docx_align(paragraph) -> str:
    """Effective paragraph alignment, following the style chain."""
    def jc_of(p_pr):
        if p_pr is None:
            return None
        jc = p_pr.find(f'{_W}jc')
        return jc.get(f'{_W}val') if jc is not None else None

    value = jc_of(paragraph._p.pPr)
    style = paragraph.style
    while value is None and style is not None:
        value = jc_of(style.element.find(f'{_W}pPr'))
        style = style.base_style
    if value == 'center':
        return 'center'
    if value in ('right', 'end'):
        return 'right'
    return 'left'


def _docx_picture(drawing, part) -> Optional[Tuple[str, bytes, float, float]]:
    """(mime, data, width_pt, height_pt) of a <w:drawing>, or None."""
    blip = drawing.find(f'.//{_A}blip')
    extent = drawing.find(f'.//{_WP}extent')
    if blip is None or extent is None:
        return None
    rel_id = blip.get(f'{_R}embed')
    image_part = part.related_parts.get(rel_id) if rel_id else None
    if image_part is None:
        return None
    mime, data = image_part.content_type, image_part.blob
    if mime not in BROWSER_IMAGE_TYPES:
        try:  # e.g. BMP / TIFF -> PNG; vector formats (EMF/WMF) cannot be converted and are skipped
            mime, data = _encode_pixmap(pymupdf.Pixmap(data))
        except Exception:
            return None
    try:
        width_pt = int(extent.get('cx')) / EMU_PER_PT
        height_pt = int(extent.get('cy')) / EMU_PER_PT
    except (TypeError, ValueError):
        return None
    if width_pt < MIN_IMAGE_SIDE_PT or height_pt < MIN_IMAGE_SIDE_PT:
        return None
    return mime, data, width_pt, height_pt


def _anchor_offset(anchor, axis: str, size_pt: float, page_pt: float, margin_start: float,
                   margin_end: float) -> Optional[float]:
    """Absolute position (pt from the page edge) of an anchored picture, if it can be read."""
    pos = anchor.find(f'{_WP}position{axis}')
    if pos is None:
        return None
    relative = pos.get('relativeFrom', 'column')
    start, span = (0.0, page_pt) if relative == 'page' else (margin_start, page_pt - margin_start - margin_end)
    offset = pos.find(f'{_WP}posOffset')
    if offset is not None and offset.text and offset.text.strip().lstrip('-').isdigit():
        return start + int(offset.text) / EMU_PER_PT
    align = pos.find(f'{_WP}align')
    if align is not None and align.text:
        where = align.text.strip()
        if where in ('center',):
            return start + (span - size_pt) / 2
        if where in ('right', 'bottom', 'outside'):
            return start + span - size_pt
        return start
    return None


def docx_layout(document) -> TemplateLayout:
    """Pages follow the page breaks in the file (explicit breaks and the breaks Word last rendered)."""
    from docx.table import Table
    from docx.text.paragraph import Paragraph

    section = document.sections[0]
    page_w = section.page_width.pt if section.page_width else 612.0
    page_h = section.page_height.pt if section.page_height else 792.0
    m_left = section.left_margin.pt if section.left_margin is not None else 72.0
    m_right = section.right_margin.pt if section.right_margin is not None else 72.0
    m_top = section.top_margin.pt if section.top_margin is not None else 72.0
    m_bottom = section.bottom_margin.pt if section.bottom_margin is not None else 72.0

    layout = TemplateLayout(page_count=1, page_width=page_w, page_height=page_h)
    entries: List[Tuple[int, str, str, list]] = []  # (page, text, align, pictures[(mime,data,w,h,x,y_abs|None)])
    page = 1
    content_since_break = False

    def picture_entries(element, part, align) -> list:
        found = []
        for drawing in element.iter(f'{_W}drawing'):
            picture = _docx_picture(drawing, part)
            if not picture:
                continue
            mime, data, w_pt, h_pt = picture
            anchor = drawing.find(f'{_WP}anchor')
            x_pt = y_pt = None
            if anchor is not None:
                x_pt = _anchor_offset(anchor, 'H', w_pt, page_w, m_left, m_right)
                y_pt = _anchor_offset(anchor, 'V', h_pt, page_h, m_top, m_bottom)
            if x_pt is None:
                if align == 'center':
                    x_pt = (page_w - w_pt) / 2
                elif align == 'right':
                    x_pt = page_w - m_right - w_pt
                else:
                    x_pt = m_left
            found.append((mime, data, w_pt, h_pt, x_pt, y_pt))
        return found

    def visit_paragraph(paragraph: Paragraph, in_table: bool = False):
        nonlocal page, content_since_break
        p = paragraph._p
        p_pr = p.pPr
        if p_pr is not None and p_pr.find(f'{_W}pageBreakBefore') is not None and content_since_break:
            page += 1
            content_since_break = False
        text_before_break = ''
        broke_inside = False
        for node in p.iter(f'{_W}t', f'{_W}br', f'{_W}lastRenderedPageBreak'):
            if node.tag == f'{_W}t':
                text_before_break += node.text or ''
                content_since_break = content_since_break or bool((node.text or '').strip())
            elif (node.tag == f'{_W}br' and node.get(f'{_W}type') == 'page') or \
                    node.tag == f'{_W}lastRenderedPageBreak':
                if content_since_break:
                    page += 1
                    broke_inside = bool(text_before_break.strip())
                    content_since_break = False
        text = paragraph.text.strip()
        align = _docx_align(paragraph)
        # Text before an in-paragraph break stays on the previous page
        entry_page = page - 1 if broke_inside and page > 1 else page
        entries.append((entry_page, text, align, picture_entries(p, paragraph.part, align)))
        if text and not in_table:
            prefix = f'[{align}] ' if align in ('center', 'right') else ''
            layout.llm_parts.append((entry_page, prefix + text))
        if text or entries[-1][3]:
            content_since_break = True
        if p_pr is not None and p_pr.find(f'{_W}sectPr') is not None:
            page += 1  # section break (next page)
            content_since_break = False

    for block in document.iter_inner_content():
        if isinstance(block, Paragraph):
            visit_paragraph(block)
        elif isinstance(block, Table):
            for row in block.rows:
                row_page = page
                for cell in row.cells:
                    for paragraph in cell.paragraphs:
                        visit_paragraph(paragraph, in_table=True)
                cells = [cell.text.strip().replace('\n', ' / ') for cell in row.cells]
                if any(cells):
                    layout.llm_parts.append((row_page, ' | '.join(cells)))

    layout.page_count = max([page] + [e[0] for e in entries]) if entries else 1
    # Drop a trailing page that only exists because of a final break
    while layout.page_count > 1 and not any(e[0] == layout.page_count and (e[1] or e[3]) for e in entries):
        layout.page_count -= 1

    # Vertical position: paragraphs spread over the text area of their page, in order
    per_page: Dict[int, int] = {}
    for entry in entries:
        per_page[entry[0]] = per_page.get(entry[0], 0) + 1
    seen: Dict[int, int] = {}
    top, usable = m_top / page_h, max(0.1, (page_h - m_top - m_bottom) / page_h)
    for entry_page, text, align, pictures in entries:
        index = seen.get(entry_page, 0)
        seen[entry_page] = index + 1
        y = top + usable * (index + 0.5) / max(per_page[entry_page], 1)
        if text:
            layout.lines.append(LayoutLine(page=entry_page, y=_clamp(y), text=text, align=align, norm=_norm(text)))
        for mime, data, w_pt, h_pt, x_pt, y_pt in pictures:
            _add_image(layout, LayoutImage(
                page=entry_page, x=_clamp(x_pt / page_w), y=_clamp(y_pt / page_h if y_pt is not None else y),
                w=_clamp(w_pt / page_w), h=_clamp(h_pt / page_h), mime=mime, data=data,
            ))
    layout.measured_pages = set(range(1, layout.page_count + 1))

    # Header pictures (logos) repeat on every page
    try:
        first_header = section.first_page_header if section.different_first_page_header_footer else None
        for page_no in range(1, layout.page_count + 1):
            header = first_header if (page_no == 1 and first_header is not None) else section.header
            if header is None or header.is_linked_to_previous:  # linked = the section has no header of its own
                continue
            for paragraph in header.paragraphs:
                align = _docx_align(paragraph)
                for mime, data, w_pt, h_pt, x_pt, y_pt in picture_entries(paragraph._p, header.part, align):
                    header_y = section.header_distance.pt if section.header_distance is not None else 36.0
                    _add_image(layout, LayoutImage(
                        page=page_no, x=_clamp(x_pt / page_w),
                        y=_clamp((y_pt if y_pt is not None else header_y) / page_h),
                        w=_clamp(w_pt / page_w), h=_clamp(h_pt / page_h), mime=mime, data=data,
                    ))
    except Exception:
        logger.debug("Header picture extraction failed", exc_info=True)
    return layout


def docx_text_for_llm(layout: TemplateLayout) -> str:
    """DOCX text with page markers and the alignment of centred / right-aligned lines; table rows as "a | b"."""
    parts, current = [], None
    for page, text in layout.llm_parts:
        if page != current:
            current = page
            parts.append(f'--- Page {current} ---')
        parts.append(text)
    return '\n'.join(parts)


# ------------------------------------------------------------- placement

def _match_quality(heading: str, target: str, line: LayoutLine) -> int:
    """3: the line is the heading (or "Heading: value"); 2: starts with it; 1: contains it; 0: no match."""
    if line.norm == target:
        return 3
    if line.norm.startswith(target):
        label = re.escape(' '.join(heading.lower().split()))
        if re.match(rf'^\W*{label}\s*[:\-–]', ' '.join(line.text.lower().split())):
            return 3
        return 2
    return 1 if target in line.norm else 0


def place_fields(fields: List[Dict], layout: TemplateLayout) -> None:
    """
    Set `page`, `pos_y` (and `align` for measured text) on each field, in place.
    Fields are in document order, so matching continues forward from the previous match.
    """
    cursor = 0  # index into layout.lines
    last_page, last_y = 1, 0.0
    lines = layout.lines
    for index, item in enumerate(fields):
        # Columns of a table share the placement of the table's first column
        if item.get('table_key') is not None and index > 0 and fields[index - 1].get('table_key') == item['table_key']:
            item['page'], item['pos_y'] = fields[index - 1]['page'], fields[index - 1]['pos_y']
            continue

        target = _norm(item['heading'])
        match = None
        if target:
            # Best kind of match wins over an earlier weaker one, e.g. the title line "Report" over a
            # running header "REPORT - Client X" that merely starts with the same words
            best = 0
            for j in range(cursor, len(lines)):
                quality = _match_quality(item['heading'], target, lines[j])
                if quality > best:
                    best, match = quality, j
                    if quality == 3:
                        break
        if match is not None:
            line = lines[match]
            cursor = match + 1
            item['page'], item['pos_y'] = line.page, line.y
            if item.get('table_key') is None and line.align:
                item['align'] = line.align if line.align in ('center', 'right') else None
        else:
            # Not measurable (scanned page): the LLM's estimate, kept in document order
            page = item.get('llm_page')
            page = page if isinstance(page, int) and last_page <= page <= layout.page_count else last_page
            y = item.get('llm_y')
            y = y if isinstance(y, (int, float)) and 0 <= y <= 1 else None
            if y is None or (page == last_page and y < last_y):
                y = last_y
            item['page'], item['pos_y'] = page, y
        last_page, last_y = item['page'], item['pos_y']
