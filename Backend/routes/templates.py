"""
Reusable document templates API.

POST   /api/templates/upload                         PDF -> LLM heading extraction -> saved template
GET    /api/templates                                list templates
GET    /api/templates/<id>                           template with ordered fields
PUT    /api/templates/<id>                           rename
DELETE /api/templates/<id>                           delete (documents are kept, link cleared)
POST   /api/templates/<id>/fields                    add custom field
PUT    /api/templates/<id>/fields/<field_id>         rename / retype / move / re-parent
DELETE /api/templates/<id>/fields/<field_id>         remove field from the template
POST   /api/templates/<id>/documents                 create a completed document from the template
"""
import json
import logging
import os

from flask import Blueprint, jsonify, request
from werkzeug.utils import secure_filename

from config import Config
from services.document_service import document_service
from services.pdf_service import PdfProcessingError
from services.template_extraction_service import ExtractionError, extract_template_structure
from services.template_service import (
    TemplateNotFoundError,
    TemplateValidationError,
    template_service,
)

logger = logging.getLogger(__name__)
templates_bp = Blueprint('templates', __name__)


def _error(message: str, status: int):
    return jsonify({'success': False, 'error': message}), status


def _json_body() -> dict:
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


def _optional_int(data: dict, key: str):
    value = data.get(key)
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, int):
        raise TemplateValidationError(f'"{key}" must be an integer.')
    return value


def _handle_service_errors(fn):
    """Map service exceptions to consistent JSON responses."""
    def wrapper(*args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except TemplateValidationError as e:
            return _error(str(e), 400)
        except TemplateNotFoundError as e:
            return _error(str(e), 404)
        except Exception:
            logger.error("Template API error in %s", fn.__name__, exc_info=True)
            return _error('A database error occurred while processing the template.', 500)
    wrapper.__name__ = fn.__name__
    return wrapper


# ------------------------------------------------------------------ upload

@templates_bp.route('/upload', methods=['POST'])
def upload_template():
    """multipart/form-data: file=<pdf>, template_name=<optional override>"""
    if request.content_length and request.content_length > Config.TEMPLATE_PDF_MAX_BYTES + 64 * 1024:
        return _error(f'The PDF exceeds the {Config.TEMPLATE_PDF_MAX_BYTES // (1024 * 1024)} MB template limit.', 413)

    upload = request.files.get('file')
    if upload is None:
        return _error('No PDF provided. Expecting form-data field "file".', 400)
    filename = secure_filename(upload.filename or '') or 'template.pdf'
    if not upload.filename or not upload.filename.lower().endswith('.pdf'):
        return _error('Only PDF files can be uploaded as templates.', 400)
    if upload.mimetype not in ('application/pdf', 'application/x-pdf', 'application/octet-stream', ''):
        return _error('Only PDF files can be uploaded as templates.', 400)

    # Read at most limit+1 bytes so oversized uploads are detected without loading everything
    data = upload.stream.read(Config.TEMPLATE_PDF_MAX_BYTES + 1)
    if len(data) > Config.TEMPLATE_PDF_MAX_BYTES:
        return _error(f'The PDF exceeds the {Config.TEMPLATE_PDF_MAX_BYTES // (1024 * 1024)} MB template limit.', 413)
    if not data:
        return _error('The uploaded file is empty.', 400)

    try:
        result = extract_template_structure(data, filename)
    except PdfProcessingError as e:
        return _error(str(e), 422)
    except ExtractionError as e:
        return _error(e.message, e.status_code)
    except Exception:
        logger.error("Unexpected template extraction failure", exc_info=True)
        return _error('The PDF could not be processed.', 500)

    override = (request.form.get('template_name') or '').strip()
    fallback = os.path.splitext(upload.filename)[0].strip() or 'Untitled Template'
    name = override or result.template_name or fallback

    try:
        template = template_service.create_template(
            template_name=name,
            fields=result.fields,
            original_filename=upload.filename[:255],
            document_type=result.document_type,
            extraction_method=result.method,
        )
    except TemplateValidationError as e:
        return _error(str(e), 400)
    except Exception:
        logger.error("Failed to save extracted template", exc_info=True)
        return _error('The template could not be saved to the database.', 500)

    return jsonify({
        'success': True,
        'template': template,
        'extraction': {'method': result.method, 'page_count': result.page_count,
                       'field_count': len(result.fields)},
    }), 201


# --------------------------------------------------------------- templates

@templates_bp.route('', methods=['GET'])
@_handle_service_errors
def list_templates():
    templates = template_service.list_templates()
    return jsonify({'success': True, 'templates': templates, 'count': len(templates)}), 200


@templates_bp.route('/<template_id>', methods=['GET'])
@_handle_service_errors
def get_template(template_id):
    template = template_service.get_template(template_id)
    if not template:
        return _error(f'Template {template_id} not found.', 404)
    return jsonify({'success': True, 'template': template}), 200


@templates_bp.route('/<template_id>', methods=['PUT'])
@_handle_service_errors
def rename_template(template_id):
    data = _json_body()
    if 'template_name' not in data:
        return _error('"template_name" is required.', 400)
    template = template_service.rename_template(template_id, data['template_name'])
    return jsonify({'success': True, 'template': template}), 200


@templates_bp.route('/<template_id>', methods=['DELETE'])
@_handle_service_errors
def delete_template(template_id):
    detached = template_service.delete_template(template_id)
    return jsonify({
        'success': True,
        'message': f'Template {template_id} deleted.',
        'detached_documents': detached,
    }), 200


# ------------------------------------------------------------------ fields

@templates_bp.route('/<template_id>/fields', methods=['POST'])
@_handle_service_errors
def add_field(template_id):
    data = _json_body()
    field = template_service.add_field(
        template_id,
        heading=data.get('heading'),
        field_type=data.get('field_type'),
        position=_optional_int(data, 'position'),
        after_field_id=data.get('after_field_id') or None,
        parent_field_id=data.get('parent_field_id') or None,
        is_custom=True,
    )
    return jsonify({'success': True, 'field': field, 'template': template_service.get_template(template_id)}), 201


@templates_bp.route('/<template_id>/fields/<field_id>', methods=['PUT'])
@_handle_service_errors
def update_field(template_id, field_id):
    data = _json_body()
    kwargs = {
        'heading': data.get('heading'),
        'field_type': data.get('field_type'),
        'position': _optional_int(data, 'position'),
    }
    if 'parent_field_id' in data:
        kwargs['parent_field_id'] = data.get('parent_field_id') or None
    field = template_service.update_field(template_id, field_id, **kwargs)
    return jsonify({'success': True, 'field': field, 'template': template_service.get_template(template_id)}), 200


@templates_bp.route('/<template_id>/fields/<field_id>', methods=['DELETE'])
@_handle_service_errors
def delete_field(template_id, field_id):
    template_service.delete_field(template_id, field_id)
    return jsonify({'success': True, 'template': template_service.get_template(template_id)}), 200


# --------------------------------------------------------------- documents

@templates_bp.route('/<template_id>/documents', methods=['POST'])
@_handle_service_errors
def create_document_from_template(template_id):
    """Create a completed-document record linked to the template (content comes from the editor)."""
    if not template_service.template_exists(template_id):
        return _error(f'Template {template_id} not found.', 404)
    data = _json_body()
    content = data.get('content', '')
    if isinstance(content, dict):
        content = json.dumps(content)
    if not isinstance(content, str):
        return _error('"content" must be a string.', 400)
    title = data.get('title') or 'Untitled Document'
    if not isinstance(title, str):
        return _error('"title" must be a string.', 400)
    word_count = data.get('word_count', 0)
    doc = document_service.create_document(
        title=title,
        content=content,
        text_content=data.get('text_content', '') or '',
        word_count=word_count if isinstance(word_count, int) else 0,
        template_id=template_id,
    )
    return jsonify({'success': True, 'document': doc}), 201
