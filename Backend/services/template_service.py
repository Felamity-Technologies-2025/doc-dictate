"""
Reusable document templates (headings/field definitions) stored in the
application's existing SQLite database.

Tables
------
templates        one row per uploaded template
template_fields  ordered, optionally nested headings/labels of a template;
                 `is_custom` marks user-added fields vs. LLM-extracted ones

Completed documents stay in the existing `documents` table and reference a
template through `documents.template_id` (see DocumentService). They are
never deleted together with a template.
"""
import logging
import os
import sqlite3
import uuid
from datetime import datetime
from typing import Dict, List, Optional

from config import Config
# Imported for its side effect: guarantees the documents table + template_id column exist first
from services.document_service import document_service  # noqa: F401

logger = logging.getLogger(__name__)

FIELD_TYPES = ('field', 'section', 'paragraph')
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
        self._init_db()

    def _get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def _init_db(self):
        os.makedirs(os.path.dirname(os.path.abspath(self.db_path)), exist_ok=True)
        with self._get_connection() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS templates (
                    id TEXT PRIMARY KEY,
                    template_name TEXT NOT NULL,
                    original_filename TEXT,
                    document_type TEXT,
                    extraction_method TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS template_fields (
                    id TEXT PRIMARY KEY,
                    template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
                    heading TEXT NOT NULL,
                    field_type TEXT NOT NULL DEFAULT 'field'
                        CHECK (field_type IN ('field', 'section', 'paragraph')),
                    field_order INTEGER NOT NULL,
                    parent_field_id TEXT REFERENCES template_fields(id) ON DELETE SET NULL,
                    is_custom INTEGER NOT NULL DEFAULT 0 CHECK (is_custom IN (0, 1)),
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            """)
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_template_fields_template ON template_fields(template_id, field_order)"
            )
            conn.commit()

    # ------------------------------------------------------------------ helpers

    @staticmethod
    def _field_rows(conn, template_id: str) -> List[sqlite3.Row]:
        return conn.execute(
            "SELECT * FROM template_fields WHERE template_id = ? ORDER BY field_order, created_at",
            (template_id,),
        ).fetchall()

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
                'created_at': row['created_at'],
                'updated_at': row['updated_at'],
            })
        return fields

    @staticmethod
    def _renumber(conn, template_id: str, ordered_ids: List[str], now: str) -> None:
        for index, field_id in enumerate(ordered_ids, start=1):
            conn.execute(
                "UPDATE template_fields SET field_order = ? WHERE id = ? AND template_id = ? AND field_order != ?",
                (index, field_id, template_id, index),
            )
        conn.execute("UPDATE templates SET updated_at = ? WHERE id = ?", (now, template_id))

    def _require_template(self, conn, template_id: str) -> sqlite3.Row:
        row = conn.execute("SELECT * FROM templates WHERE id = ?", (template_id,)).fetchone()
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

    # ------------------------------------------------------------------ templates

    def create_template(self, template_name: str, fields: List[Dict], original_filename: str = None,
                        document_type: str = None, extraction_method: str = None) -> Dict:
        """
        Persist a template and its extracted fields in one transaction.
        `fields` items: {heading, field_type, parent_index (index into `fields` or None)}.
        """
        name = clean_template_name(template_name)
        if not fields:
            raise TemplateValidationError('A template needs at least one field.')

        template_id = str(uuid.uuid4())
        now = _now()
        field_ids = [str(uuid.uuid4()) for _ in fields]
        conn = self._get_connection()
        try:
            with conn:  # one transaction: all-or-nothing
                conn.execute(
                    """INSERT INTO templates (id, template_name, original_filename, document_type,
                                              extraction_method, created_at, updated_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    (template_id, name, original_filename, document_type, extraction_method, now, now),
                )
                for index, field in enumerate(fields):
                    parent_index = field.get('parent_index')
                    parent_id = (
                        field_ids[parent_index]
                        if isinstance(parent_index, int) and 0 <= parent_index < index
                        else None
                    )
                    conn.execute(
                        """INSERT INTO template_fields (id, template_id, heading, field_type, field_order,
                                                        parent_field_id, is_custom, created_at, updated_at)
                           VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)""",
                        (field_ids[index], template_id, clean_heading(field['heading']),
                         clean_field_type(field.get('field_type'), 'section'), index + 1, parent_id, now, now),
                    )
        finally:
            conn.close()
        return self.get_template(template_id)

    def list_templates(self) -> List[Dict]:
        with self._get_connection() as conn:
            rows = conn.execute("""
                SELECT t.*,
                       (SELECT COUNT(*) FROM template_fields f WHERE f.template_id = t.id) AS field_count,
                       (SELECT COUNT(*) FROM template_fields f WHERE f.template_id = t.id AND f.is_custom = 1)
                           AS custom_field_count,
                       (SELECT COUNT(*) FROM documents d WHERE d.template_id = t.id) AS document_count
                FROM templates t
                ORDER BY t.updated_at DESC
            """).fetchall()
            return [dict(row) for row in rows]

    def get_template(self, template_id: str) -> Optional[Dict]:
        with self._get_connection() as conn:
            row = conn.execute("SELECT * FROM templates WHERE id = ?", (template_id,)).fetchone()
            if not row:
                return None
            template = dict(row)
            template['fields'] = self._serialize_fields(self._field_rows(conn, template_id))
            template['field_count'] = len(template['fields'])
            template['custom_field_count'] = sum(1 for f in template['fields'] if f['is_custom'])
            template['document_count'] = conn.execute(
                "SELECT COUNT(*) FROM documents WHERE template_id = ?", (template_id,)
            ).fetchone()[0]
            return template

    def rename_template(self, template_id: str, template_name: str) -> Dict:
        name = clean_template_name(template_name)
        with self._get_connection() as conn:
            self._require_template(conn, template_id)
            conn.execute(
                "UPDATE templates SET template_name = ?, updated_at = ? WHERE id = ?",
                (name, _now(), template_id),
            )
            conn.commit()
        return self.get_template(template_id)

    def delete_template(self, template_id: str) -> int:
        """
        Delete a template and its field definitions. Documents created from it
        are kept (their content is self-contained); only their link is cleared.
        Returns the number of documents that were detached.
        """
        conn = self._get_connection()
        try:
            with conn:
                self._require_template(conn, template_id)
                detached = conn.execute(
                    "UPDATE documents SET template_id = NULL WHERE template_id = ?", (template_id,)
                ).rowcount
                conn.execute("DELETE FROM template_fields WHERE template_id = ?", (template_id,))
                conn.execute("DELETE FROM templates WHERE id = ?", (template_id,))
            return detached
        finally:
            conn.close()

    def template_exists(self, template_id: str) -> bool:
        with self._get_connection() as conn:
            return conn.execute("SELECT 1 FROM templates WHERE id = ?", (template_id,)).fetchone() is not None

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

        conn = self._get_connection()
        try:
            with conn:
                self._require_template(conn, template_id)
                rows = self._field_rows(conn, template_id)
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

                conn.execute(
                    """INSERT INTO template_fields (id, template_id, heading, field_type, field_order,
                                                    parent_field_id, is_custom, created_at, updated_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (new_id, template_id, heading, field_type, len(ids) + 1, parent_field_id,
                     1 if is_custom else 0, now, now),
                )
                ids.insert(insert_at, new_id)
                self._renumber(conn, template_id, ids, now)
        finally:
            conn.close()
        return self._get_field(template_id, new_id)

    def update_field(self, template_id: str, field_id: str, heading: str = None, field_type: str = None,
                     position: int = None, parent_field_id=...) -> Dict:
        """Rename / retype / move / re-parent a field. `parent_field_id=None` moves it to the top level."""
        now = _now()
        conn = self._get_connection()
        try:
            with conn:
                self._require_template(conn, template_id)
                rows = self._field_rows(conn, template_id)
                current = next((row for row in rows if row['id'] == field_id), None)
                if not current:
                    raise TemplateNotFoundError(f'Field {field_id} not found in template {template_id}.')

                updates, params = [], []
                if heading is not None:
                    updates.append("heading = ?")
                    params.append(clean_heading(heading))
                if field_type is not None:
                    updates.append("field_type = ?")
                    params.append(clean_field_type(field_type))
                if parent_field_id is not ...:
                    updates.append("parent_field_id = ?")
                    params.append(self._validate_parent(rows, parent_field_id, field_id))
                if updates:
                    updates.append("updated_at = ?")
                    params.extend([now, field_id, template_id])
                    conn.execute(
                        f"UPDATE template_fields SET {', '.join(updates)} WHERE id = ? AND template_id = ?",
                        params,
                    )

                if position is not None:
                    if not isinstance(position, int) or isinstance(position, bool):
                        raise TemplateValidationError('Position must be an integer.')
                    ids = [row['id'] for row in rows if row['id'] != field_id]
                    ids.insert(min(max(position, 1), len(ids) + 1) - 1, field_id)
                    self._renumber(conn, template_id, ids, now)
                elif updates:
                    conn.execute("UPDATE templates SET updated_at = ? WHERE id = ?", (now, template_id))
        finally:
            conn.close()
        return self._get_field(template_id, field_id)

    def delete_field(self, template_id: str, field_id: str) -> None:
        """
        Remove a field from the template definition. Sub-fields move up to the
        removed field's parent. Saved documents are not modified.
        """
        now = _now()
        conn = self._get_connection()
        try:
            with conn:
                self._require_template(conn, template_id)
                rows = self._field_rows(conn, template_id)
                current = next((row for row in rows if row['id'] == field_id), None)
                if not current:
                    raise TemplateNotFoundError(f'Field {field_id} not found in template {template_id}.')
                if len(rows) == 1:
                    raise TemplateValidationError('A template must keep at least one field.')
                conn.execute(
                    "UPDATE template_fields SET parent_field_id = ?, updated_at = ? "
                    "WHERE parent_field_id = ? AND template_id = ?",
                    (current['parent_field_id'], now, field_id, template_id),
                )
                conn.execute("DELETE FROM template_fields WHERE id = ? AND template_id = ?", (field_id, template_id))
                self._renumber(conn, template_id, [row['id'] for row in rows if row['id'] != field_id], now)
        finally:
            conn.close()

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
