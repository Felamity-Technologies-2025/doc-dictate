import os
import sys
import logging
import socket
from urllib.parse import urlsplit
from flask import Flask, jsonify
from flask_cors import CORS
from config import Config
from ragsuite_agent_client import ragsuite_agent_bp
from routes.documents import documents_bp
from routes.templates import templates_bp
from services.template_extraction_service import get_llm_client


# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s in %(module)s: %(message)s'
)
logger = logging.getLogger(__name__)

def resource_path(relative_path):
    """ Get absolute path to resource (works for dev and PyInstaller) """
    try:
        base_path = sys._MEIPASS  # PyInstaller temp folder
    except Exception:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)

def find_free_port(start=5643, end=6000):
    for port in range(start, end):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(('127.0.0.1', port)) != 0:
                return port
    raise RuntimeError("No free port found between 6000–9000")

def create_app():
    app = Flask(__name__,
    template_folder=resource_path("templates"),
    static_folder=resource_path("static")
    )
    app.config.from_object(Config)

    # Initialize CORS
    CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

    # Register API blueprints
    app.register_blueprint(documents_bp, url_prefix='/api/documents')
    app.register_blueprint(templates_bp, url_prefix='/api/templates')
    app.register_blueprint(ragsuite_agent_bp)

    # Health check endpoint
    @app.route('/api/health', methods=['GET'])
    def health_check():
        return jsonify({
            'status': 'ok',
            'service': 'document-editor',
            'version': '1.0.0',
            'max_upload_size_mb': Config.MAX_CONTENT_LENGTH // (1024 * 1024),
            'database': 'json',
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
    port = find_free_port()
    print(f"Running on port: {port}")
    logger.info(f"Starting Audio_Transcription Flask backend on http://127.0.0.1:{port}")
    logger.info(f"Data file: {Config.DATABASE_PATH}")
    logger.info(f"LLM client: RAGSUITE | model: {Config.RAGSUITE_MODEL_ID or '(whichever is loaded in RAGSUITE)'} "
                f"| endpoint: {Config.RAGSUITE_ENDPOINT}")
    try:
        socket.create_connection((urlsplit(Config.RAGSUITE_ENDPOINT).hostname,
                                  urlsplit(Config.RAGSUITE_ENDPOINT).port or 80), timeout=2).close()
        logger.info("RAGSUITE is reachable")
    except OSError:
        logger.warning("RAGSUITE is NOT running - open the RAGSUITE app before extracting headings")
    app.run(port=port, debug=False)
