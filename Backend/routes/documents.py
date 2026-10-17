import io
import logging
from flask import Blueprint, request, jsonify, send_file
from services.document_service import document_service
from services.export_service import ExportError, export_document, export_filename

logger = logging.getLogger(__name__)
documents_bp = Blueprint('documents', __name__)

@documents_bp.route('', methods=['GET'])
def list_documents():
    """Retrieve all saved documents."""
    try:
        docs = document_service.get_all_documents()
        return jsonify({
            'success': True,
            'documents': docs,
            'count': len(docs)
        }), 200
    except Exception as e:
        logger.error(f"Error listing documents: {e}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500

@documents_bp.route('/<document_id>', methods=['GET'])
def get_document(document_id):
    """Retrieve a single document by ID."""
    try:
        doc = document_service.get_document(document_id)
        if not doc:
            return jsonify({'success': False, 'error': f'Document {document_id} not found.'}), 404
        return jsonify({'success': True, 'document': doc}), 200
    except Exception as e:
        logger.error(f"Error retrieving document {document_id}: {e}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500

@documents_bp.route('', methods=['POST'])
def create_document():
    """Create a new document."""
    try:
        data = request.get_json(silent=True) or {}
        title = data.get('title', 'Untitled Document')
        content = data.get('content', '')
        text_content = data.get('text_content', '')
        word_count = data.get('word_count', 0)

        # Content can be html string or serialized json string
        if isinstance(content, dict):
            import json
            content = json.dumps(content)

        doc = document_service.create_document(
            title=title,
            content=str(content),
            text_content=text_content,
            word_count=word_count
        )
        return jsonify({'success': True, 'document': doc}), 201
    except Exception as e:
        logger.error(f"Error creating document: {e}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500

@documents_bp.route('/<document_id>', methods=['PUT'])
def update_document(document_id):
    """Update an existing document."""
    try:
        data = request.get_json(silent=True) or {}
        title = data.get('title')
        content = data.get('content')
        text_content = data.get('text_content')
        word_count = data.get('word_count')

        if isinstance(content, dict):
            import json
            content = json.dumps(content)

        updated_doc = document_service.update_document(
            doc_id=document_id,
            title=title,
            content=str(content) if content is not None else None,
            text_content=text_content,
            word_count=word_count
        )

        if not updated_doc:
            return jsonify({'success': False, 'error': f'Document {document_id} not found.'}), 404

        return jsonify({'success': True, 'document': updated_doc}), 200
    except Exception as e:
        logger.error(f"Error updating document {document_id}: {e}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500

@documents_bp.route('/<document_id>', methods=['DELETE'])
def delete_document(document_id):
    """Delete a document by ID."""
    try:
        deleted = document_service.delete_document(document_id)
        if not deleted:
            return jsonify({'success': False, 'error': f'Document {document_id} not found.'}), 404
        return jsonify({'success': True, 'message': f'Document {document_id} deleted successfully.'}), 200
    except Exception as e:
        logger.error(f"Error deleting document {document_id}: {e}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500

EXPORT_MIMETYPES = {
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'pdf': 'application/pdf',
}

@documents_bp.route('/<document_id>/export', methods=['GET'])
def export_document_file(document_id):
    """Download a saved document as DOCX or PDF: ?format=docx|pdf"""
    fmt = (request.args.get('format') or '').lower()
    if fmt not in EXPORT_MIMETYPES:
        return jsonify({'success': False, 'error': 'Query parameter "format" must be "docx" or "pdf".'}), 400
    try:
        doc = document_service.get_document(document_id)
    except Exception as e:
        logger.error(f"Error loading document {document_id} for export: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'The document could not be loaded.'}), 500
    if not doc:
        return jsonify({'success': False, 'error': f'Document {document_id} not found.'}), 404

    try:
        data = export_document(doc.get('content') or '', doc.get('title') or 'Document', fmt)
    except ExportError as e:
        return jsonify({'success': False, 'error': str(e)}), 422
    except Exception as e:
        logger.error(f"Error exporting document {document_id} as {fmt}: {e}", exc_info=True)
        return jsonify({'success': False, 'error': f'The {fmt.upper()} file could not be generated.'}), 500

    return send_file(
        io.BytesIO(data),
        mimetype=EXPORT_MIMETYPES[fmt],
        as_attachment=True,
        download_name=export_filename(doc.get('title'), fmt),
    )
