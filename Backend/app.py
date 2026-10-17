import os
import logging
from flask import Flask, jsonify
from flask_cors import CORS
from config import Config
from routes.transcription import transcription_bp
from routes.documents import documents_bp
from routes.templates import templates_bp
from services.template_extraction_service import get_llm_client

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s in %(module)s: %(message)s'
)
logger = logging.getLogger(__name__)

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Initialize CORS
    CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

    # Ensure uploads folder exists
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    # Register API blueprints
    app.register_blueprint(transcription_bp, url_prefix='/api')
    app.register_blueprint(documents_bp, url_prefix='/api/documents')
    app.register_blueprint(templates_bp, url_prefix='/api/templates')

    # Health check endpoint
    @app.route('/api/health', methods=['GET'])
    def health_check():
        return jsonify({
            'status': 'ok',
            'service': 'audio-transcription',
            'version': '1.0.0',
            'default_engine': Config.DEFAULT_SPEECH_ENGINE,
            'max_upload_size_mb': Config.MAX_CONTENT_LENGTH // (1024 * 1024),
            'database': 'sqlite3',
            'llm_gateway_configured': get_llm_client().is_configured,
            'template_max_upload_mb': Config.TEMPLATE_PDF_MAX_BYTES // (1024 * 1024),
        }), 200

    # Error Handlers
    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({'success': False, 'error': str(error.description or 'Bad request')}), 400

    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'success': False, 'error': 'Endpoint or resource not found'}), 404

    @app.errorhandler(413)
    def file_too_large(error):
        return jsonify({'success': False, 'error': 'File payload exceeds maximum allowed size'}), 413

    @app.errorhandler(500)
    def internal_error(error):
        logger.error(f"Internal server error: {error}", exc_info=True)
        return jsonify({'success': False, 'error': 'An internal server error occurred'}), 500

    return app

app = create_app()

if __name__ == '__main__':
    port = int(os.getenv('FLASK_PORT', 5000))
    host = os.getenv('HOST', '0.0.0.0')
    logger.info(f"Starting Audio_Transcription Flask backend on http://{host}:{port}")
    app.run(host=host, port=port, debug=False)
