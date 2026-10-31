"""
Reusable document templates (headings/field definitions) stored in the
application's JSON data file.

Collections
-----------
templates        one record per uploaded template
template_fields  ordered, optionally nested headings/labels of a template;
                 `is_custom` marks user-added fields vs. LLM-extracted ones
template_images  pictures of the source document (bytes stored base64-encoded)

Completed documents stay in the `documents` collection and reference a
template through `template_id` (see DocumentService). They are
never deleted together with a template.
"""
import logging
import base64
import uuid
from datetime import datetime
from typing import Dict, List, Optional

from config import Config
from services.json_store import get_store

logger = logging.getLogger(__name__)

FIELD_TYPES = ('field', 'section', 'paragraph')
ALIGNMENTS = ('left', 'center', 'right')
MAX_HEADING_LENGTH = 200
MAX_TEMPLATE_NAME_LENGTH = 120
MAX_LEVEL = 6


class TemplateValidationError(ValueError):
    """Raised for invalid user input (mapped to HTTP 400)."""


class TemplateNotFoundError(LookupError):
    """Raised when a template or field does not exist (mapped to HTTP 404)."""


def _now() -> str:
    return datetime.utcnow().isoformat() + "Z"


def clean_heading(value) -> str:
    if not isinstance(value, str):
        raise TemplateValidationError('Field name must be a string.')
    heading = ' '.join(value.split()).strip()
    if not heading:
        raise TemplateValidationError('Field name cannot be empty.')
    if len(heading) > MAX_HEADING_LENGTH:
        raise TemplateValidationError(f'Field name must be at most {MAX_HEADING_LENGTH} characters.')
    return heading


def clean_field_type(value, default: str = 'field') -> str:
    if value is None or value == '':
        return default
    if value not in FIELD_TYPES:
        raise TemplateValidationError(f"Field type must be one of: {', '.join(FIELD_TYPES)}.")
    return value


def clean_template_name(value) -> str:
    if not isinstance(value, str) or not value.strip():
        raise TemplateValidationError('Template name cannot be empty.')
    name = ' '.join(value.split()).strip()
    if len(name) > MAX_TEMPLATE_NAME_LENGTH:
        raise TemplateValidationError(f'Template name must be at most {MAX_TEMPLATE_NAME_LENGTH} characters.')
    return name


class TemplateService:
    def __init__(self, db_path: str = None):
        self.db_path = db_path or Config.DATABASE_PATH
        self.store = get_store(self.db_path)

    # ------------------------------------------------------------------ helpers

    @staticmethod
    def _field_rows(data: dict, template_id: str) -> List[Dict]:
        rows = [f for f in data['template_fields'] if f['template_id'] == template_id]
        return sorted(rows, key=lambda f: (f['field_order'], f['created_at']))

    @staticmethod
    def _serialize_fields(rows) -> List[Dict]:
        by_id = {row['id']: row for row in rows}
        fields = []
        for row in rows:
            level, parent, seen = 1, row['parent_field_id'], set()
            while parent and parent in by_id and parent not in seen and level < MAX_LEVEL:
                seen.add(parent)
                level += 1
                parent = by_id[parent]['parent_field_id']
            fields.append({
                'id': row['id'],
                'template_id': row['template_id'],
                'heading': row['heading'],
                'field_type': row['field_type'],
                'field_order': row['field_order'],
                'parent_field_id': row['parent_field_id'],
                'level': level,
                'is_custom': bool(row['is_custom']),
                'table_id': row.get('table_id'),
                'align': row.get('align'),
                'page': row.get('page'),
                'pos_y': row.get('pos_y'),
                'created_at': row['created_at'],
                'updated_at': row['updated_at'],
            })
        return fields

    @staticmethod
    def _renumber(data: dict, template_id: str, ordered_ids: List[str], now: str) -> None:
        by_id = {f['id']: f for f in data['template_fields'] if f['template_id'] == template_id}
        for index, field_id in enumerate(ordered_ids, start=1):
            if field_id in by_id:
                by_id[field_id]['field_order'] = index
        for template in data['templates']:
            if template['id'] == template_id:
                template['updated_at'] = now

    @staticmethod
    def _require_template(data: dict, template_id: str) -> Dict:
        row = next((t for t in data['templates'] if t['id'] == template_id), None)
        if not row:
            raise TemplateNotFoundError(f'Template {template_id} not found.')
        return row

    @staticmethod
    def _validate_parent(rows, parent_field_id: Optional[str], field_id: Optional[str] = None) -> Optional[str]:
        if not parent_field_id:
            return None
        by_id = {row['id']: row for row in rows}
        if parent_field_id not in by_id:
            raise TemplateValidationError('Parent section does not belong to this template.')
        if parent_field_id == field_id:
            raise TemplateValidationError('A field cannot be its own parent.')
        # Prevent cycles: walk up from the proposed parent
        current, seen = parent_field_id, set()
        while current and current not in seen:
            if current == field_id:
                raise TemplateValidationError('A field cannot be nested inside one of its own sub-fields.')
            seen.add(current)
            current = by_id[current]['parent_field_id'] if current in by_id else None
        return parent_field_id

    @staticmethod
    def _subtree_end_index(rows, field_id: str) -> int:
        """Index (in `rows`) of the last descendant of field_id, or of field_id itself."""
        ids = [row['id'] for row in rows]
        start = ids.index(field_id)
        descendants = {field_id}
        end = start
        for i in range(start + 1, len(rows)):
            if rows[i]['parent_field_id'] in descendants:
                descendants.add(rows[i]['id'])
                end = i
            else:
                break
        return end

    @staticmethod
    def _build_template(data: dict, row: Dict, rows: Optional[List[Dict]] = None) -> Dict:
        """Template record with its derived counts (and, if `rows` is given, fields + images)."""
        template_id = row['id']
        template = dict(row)
        fields = [f for f in data['template_fields'] if f['template_id'] == template_id]
        template['field_count'] = len(fields)
        template['custom_field_count'] = sum(1 for f in fields if f['is_custom'])
        template['document_count'] = sum(1 for d in data['documents'] if d.get('template_id') == template_id)
        if rows is not None:
            template['fields'] = TemplateService._serialize_fields(rows)
            images = [i for i in data['template_images'] if i['template_id'] == template_id]
            images.sort(key=lambda i: (i['page'], i['y'], i['x']))
            template['images'] = [{k: i[k] for k in ('id', 'page', 'x', 'y', 'w', 'h', 'mime')} for i in images]
        return template

    # ------------------------------------------------------------------ templates

    def create_template(self, template_name: str, fields: List[Dict], original_filename: str = None,
                        document_type: str = None, extraction_method: str = None,
                        pages: Optional[Dict] = None, images: Optional[List] = None) -> Dict:
        """
        Persist a template and its extracted fields in one transaction.
        `fields` items: {heading, field_type, parent_index (index into `fields` or None),
        table_key (optional: fields with the same key are the columns of one table)}.
        """
        name = clean_template_name(template_name)
        if not fields:
            raise TemplateValidationError('A template needs at least one field.')

        template_id = str(uuid.uuid4())
        now = _now()
        field_ids = [str(uuid.uuid4()) for _ in fields]
        table_ids: Dict = {}
        # Source page numbers are renumbered 1..n over the pages that hold content
        page_numbers = {number: index for index, number in enumerate((pages or {}).get('numbers') or [], start=1)}

        with self.store.transaction() as data:  # all-or-nothing: nothing is saved if validation fails
            data['templates'].append({
                'id': template_id,
                'template_name': name,
                'original_filename': original_filename,
                'document_type': document_type,
                'extraction_method': extraction_method,
                'created_at': now,
                'updated_at': now,
                'page_count': len(page_numbers) or None,
                'page_width': (pages or {}).get('width'),
                'page_height': (pages or {}).get('height'),
            })
            for image in (images or []) if page_numbers else []:
                if image.page not in page_numbers:
                    continue
                data['template_images'].append({
                    'id': str(uuid.uuid4()),
                    'template_id': template_id,
                    'page': page_numbers[image.page],
                    'x': image.x,
                    'y': image.y,
                    'w': image.w,
                    'h': image.h,
                    'mime': image.mime,
                    'data': base64.b64encode(image.data).decode('ascii'),
                    'created_at': now,
                })
            for index, field in enumerate(fields):
                parent_index = field.get('parent_index')
                parent_id = (
                    field_ids[parent_index]
                    if isinstance(parent_index, int) and 0 <= parent_index < index
                    else None
                )
                table_key = field.get('table_key')
                table_id = table_ids.setdefault(table_key, str(uuid.uuid4())) if table_key is not None else None
                data['template_fields'].append({
                    'id': field_ids[index],
                    'template_id': template_id,
                    'heading': clean_heading(field['heading']),
                    'field_type': clean_field_type(field.get('field_type'), 'section'),
                    'field_order': index + 1,
                    'parent_field_id': parent_id,
                    'is_custom': 0,
                    'created_at': now,
                    'updated_at': now,
                    'table_id': table_id,
                    'align': field.get('align') if field.get('align') in ALIGNMENTS else None,
                    'page': page_numbers.get(field.get('page')) if page_numbers else None,
                    'pos_y': field.get('pos_y') if page_numbers else None,
                })
        return self.get_template(template_id)

    def list_templates(self) -> List[Dict]:
        with self.store.read() as data:
            templates = [self._build_template(data, row) for row in data['templates']]
        return sorted(templates, key=lambda t: t['updated_at'], reverse=True)

    def get_template(self, template_id: str) -> Optional[Dict]:
        with self.store.read() as data:
            row = next((t for t in data['templates'] if t['id'] == template_id), None)
            if not row:
                return None
            return self._build_template(data, row, self._field_rows(data, template_id))

    def _find_image(self, image_id: str, template_id: str = None) -> Optional[Dict]:
        with self.store.read() as data:
            row = next((i for i in data['template_images']
                        if i['id'] == image_id and (template_id is None or i['template_id'] == template_id)), None)
            return {'mime': row['mime'], 'data': base64.b64decode(row['data'])} if row else None

    def get_image(self, template_id: str, image_id: str) -> Optional[Dict]:
        """{mime, data} of one template picture, or None."""
        return self._find_image(image_id, template_id)

    def get_image_by_id(self, image_id: str) -> Optional[Dict]:
        """Picture lookup for exports, which only know the image id stored in the document."""
        return self._find_image(image_id)

    def rename_template(self, template_id: str, template_name: str) -> Dict:
        name = clean_template_name(template_name)
        with self.store.transaction() as data:
            row = self._require_template(data, template_id)
            row['template_name'] = name
            row['updated_at'] = _now()
        return self.get_template(template_id)

    def delete_template(self, template_id: str) -> int:
        """
        Delete a template and its field definitions. Documents created from it
        are kept (their content is self-contained); only their link is cleared.
        Returns the number of documents that were detached.
        """
        with self.store.transaction() as data:
            self._require_template(data, template_id)
            detached = 0
            for doc in data['documents']:
                if doc.get('template_id') == template_id:
                    doc['template_id'] = None
                    detached += 1
            data['template_fields'] = [f for f in data['template_fields'] if f['template_id'] != template_id]
            if not detached:
                # Pictures are kept while documents created from the template still show them
                data['template_images'] = [i for i in data['template_images'] if i['template_id'] != template_id]
            data['templates'] = [t for t in data['templates'] if t['id'] != template_id]
            return detached

    def template_exists(self, template_id: str) -> bool:
        with self.store.read() as data:
            return any(t['id'] == template_id for t in data['templates'])

    # ------------------------------------------------------------------ fields

    def add_field(self, template_id: str, heading: str, field_type: str = None, position: int = None,
                  after_field_id: str = None, parent_field_id: str = None, is_custom: bool = True) -> Dict:
        """
        Add a field to ONE template. Placement, in priority order:
        `position` (1-based), else directly after `after_field_id` (and its
        sub-fields), else at the end of `parent_field_id`'s section, else last.
        """
        heading = clean_heading(heading)
        field_type = clean_field_type(field_type, 'field')
        now = _now()
        new_id = str(uuid.uuid4())

        with self.store.transaction() as data:
            self._require_template(data, template_id)
            rows = self._field_rows(data, template_id)
            ids = [row['id'] for row in rows]
            parent_field_id = self._validate_parent(rows, parent_field_id)

            if position is not None:
                if not isinstance(position, int) or isinstance(position, bool):
                    raise TemplateValidationError('Position must be an integer.')
                insert_at = min(max(position, 1), len(ids) + 1) - 1
            elif after_field_id:
                if after_field_id not in ids:
                    raise TemplateValidationError('The field to insert after does not belong to this template.')
                insert_at = self._subtree_end_index(rows, after_field_id) + 1
            elif parent_field_id:
                insert_at = self._subtree_end_index(rows, parent_field_id) + 1
            else:
                insert_at = len(ids)

            # A new field belongs to the page of the field it follows (or the first field's page)
            neighbour = rows[insert_at - 1] if insert_at > 0 else (rows[0] if rows else None)
            page = neighbour.get('page') if neighbour is not None else None
            pos_y = neighbour.get('pos_y') if neighbour is not None else None

            # A field added between two columns of a table becomes a column of that table
            table_id = None
            if 0 < insert_at < len(rows):
                before, after = rows[insert_at - 1].get('table_id'), rows[insert_at].get('table_id')
                if before and before == after:
                    table_id = before

            data['template_fields'].append({
                'id': new_id,
                'template_id': template_id,
                'heading': heading,
                'field_type': field_type,
                'field_order': len(ids) + 1,
                'parent_field_id': parent_field_id,
                'is_custom': 1 if is_custom else 0,
                'created_at': now,
                'updated_at': now,
                'table_id': table_id,
                'align': None,
                'page': page,
                'pos_y': pos_y,
            })
            ids.insert(insert_at, new_id)
            self._renumber(data, template_id, ids, now)
        return self._get_field(template_id, new_id)

    def update_field(self, template_id: str, field_id: str, heading: str = None, field_type: str = None,
                     position: int = None, parent_field_id=...) -> Dict:
        """Rename / retype / move / re-parent a field. `parent_field_id=None` moves it to the top level."""
        now = _now()
        with self.store.transaction() as data:
            self._require_template(data, template_id)
            rows = self._field_rows(data, template_id)
            current = next((row for row in rows if row['id'] == field_id), None)
            if not current:
                raise TemplateNotFoundError(f'Field {field_id} not found in template {template_id}.')

            updates = {}
            if heading is not None:
                updates['heading'] = clean_heading(heading)
            if field_type is not None:
                updates['field_type'] = clean_field_type(field_type)
            if parent_field_id is not ...:
                updates['parent_field_id'] = self._validate_parent(rows, parent_field_id, field_id)
            if updates:
                current.update(updates)
                current['updated_at'] = now

            if position is not None:
                if not isinstance(position, int) or isinstance(position, bool):
                    raise TemplateValidationError('Position must be an integer.')
                ids = [row['id'] for row in rows if row['id'] != field_id]
                ids.insert(min(max(position, 1), len(ids) + 1) - 1, field_id)
                self._renumber(data, template_id, ids, now)
            elif updates:
                self._require_template(data, template_id)['updated_at'] = now
        return self._get_field(template_id, field_id)

    def delete_field(self, template_id: str, field_id: str) -> None:
        """
        Remove a field from the template definition. Sub-fields move up to the
        removed field's parent. Saved documents are not modified.
        """
        now = _now()
        with self.store.transaction() as data:
            self._require_template(data, template_id)
            rows = self._field_rows(data, template_id)
            current = next((row for row in rows if row['id'] == field_id), None)
            if not current:
                raise TemplateNotFoundError(f'Field {field_id} not found in template {template_id}.')
            if len(rows) == 1:
                raise TemplateValidationError('A template must keep at least one field.')
            for row in rows:
                if row['parent_field_id'] == field_id:
                    row['parent_field_id'] = current['parent_field_id']
                    row['updated_at'] = now
            data['template_fields'] = [
                f for f in data['template_fields'] if not (f['id'] == field_id and f['template_id'] == template_id)
            ]
            self._renumber(data, template_id, [row['id'] for row in rows if row['id'] != field_id], now)

    def _get_field(self, template_id: str, field_id: str) -> Dict:
        template = self.get_template(template_id)
        if not template:
            raise TemplateNotFoundError(f'Template {template_id} not found.')
        field = next((f for f in template['fields'] if f['id'] == field_id), None)
        if not field:
            raise TemplateNotFoundError(f'Field {field_id} not found in template {template_id}.')
        return field


# Singleton instance
template_service = TemplateService()
