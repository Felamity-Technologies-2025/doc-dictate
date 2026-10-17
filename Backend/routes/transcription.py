import os
import logging
from flask import Blueprint, request, jsonify
from config import Config
from utils.audio_utils import allowed_file, secure_save_audio, cleanup_file
from services.speech_service import speech_service

logger = logging.getLogger(__name__)
transcription_bp = Blueprint('transcription', __name__)

@transcription_bp.route('/transcribe', methods=['POST'])
def transcribe_audio():
    """
    Accepts multipart/form-data with:
    - audio: audio file (.wav, .mp3, .m4a, .ogg, .webm, etc.)
    - language: optional language locale (e.g., 'en-US', 'en-IN', 'ta-IN', 'hi-IN')
    - engine: optional recognition engine ('google', 'whisper')
    """
    if 'audio' not in request.files:
        return jsonify({
            'success': False,
            'error': 'No audio file provided in request. Expecting form-data field "audio".'
        }), 400

    audio_file = request.files['audio']

    if audio_file.filename == '':
        return jsonify({
            'success': False,
            'error': 'Uploaded file has an empty filename.'
        }), 400

    if not allowed_file(audio_file.filename):
        return jsonify({
            'success': False,
            'error': f'Unsupported audio format. Allowed formats: {", ".join(sorted(Config.ALLOWED_EXTENSIONS))}'
        }), 400

    language = request.form.get('language', 'en-US')
    engine = request.form.get('engine', Config.DEFAULT_SPEECH_ENGINE)

    saved_path = None
    try:
        # Save securely to temporary upload folder
        saved_path = secure_save_audio(audio_file, Config.UPLOAD_FOLDER)
        
        # Check file size
        file_size = os.path.getsize(saved_path)
        if file_size > Config.MAX_CONTENT_LENGTH:
            return jsonify({
                'success': False,
                'error': f'Audio file exceeds maximum allowed size ({Config.MAX_CONTENT_LENGTH // (1024 * 1024)} MB).'
            }), 413

        # Transcribe audio file
        result = speech_service.transcribe_audio_file(saved_path, language=language, engine=engine)
        
        if result.get('success'):
            return jsonify(result), 200
        else:
            # If no speech was detected or request error, return structured error
            status_code = 422 if "No speech" in result.get('error', '') else 502
            return jsonify(result), status_code

    except Exception as e:
        logger.error(f"Error handling transcription request: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'error': f'Internal server error during audio transcription: {str(e)}'
        }), 500

    finally:
        if saved_path:
            cleanup_file(saved_path)
            