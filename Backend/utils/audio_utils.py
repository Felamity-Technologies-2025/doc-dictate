import os
import uuid
import logging
from pathlib import Path
from pydub import AudioSegment
from werkzeug.utils import secure_filename
from config import Config

logger = logging.getLogger(__name__)

def allowed_file(filename: str) -> bool:
    """Check if file has an allowed audio extension."""
    if not filename or '.' not in filename:
        return False
    ext = filename.rsplit('.', 1)[1].lower()
    return ext in Config.ALLOWED_EXTENSIONS

def secure_save_audio(file_storage, target_dir: str) -> str:
    """Safely save uploaded audio file with a unique filename."""
    os.makedirs(target_dir, exist_ok=True)
    orig_name = secure_filename(file_storage.filename or 'audio.wav')
    ext = orig_name.rsplit('.', 1)[1].lower() if '.' in orig_name else 'wav'
    unique_filename = f"{uuid.uuid4().hex}.{ext}"
    saved_path = os.path.join(target_dir, unique_filename)
    file_storage.save(saved_path)
    return saved_path

def convert_to_wav(source_path: str) -> str:
    """
    Converts any audio file (webm, mp3, m4a, ogg, etc.) to 16kHz mono WAV
    which is optimal for SpeechRecognition engines.
    Returns path to converted WAV file.
    """
    if source_path.lower().endswith('.wav'):
        # Verify if it's already PCM wav; if so return, or re-encode to ensure 16kHz mono
        try:
            sound = AudioSegment.from_file(source_path)
            if sound.channels == 1 and sound.frame_rate == 16000 and sound.sample_width == 2:
                return source_path
        except Exception:
            pass

    try:
        sound = AudioSegment.from_file(source_path)
        # Normalize to mono, 16kHz, 16-bit PCM
        sound = sound.set_channels(1)
        sound = sound.set_frame_rate(16000)
        sound = sound.set_sample_width(2)
        
        wav_path = f"{os.path.splitext(source_path)[0]}_converted.wav"
        sound.export(wav_path, format="wav")
        return wav_path
    except Exception as e:
        logger.error(f"Error converting audio to WAV: {e}")
        # If conversion fails and original was .wav, try returning original
        if source_path.lower().endswith('.wav'):
            return source_path
        raise RuntimeError(f"Audio conversion failed: {str(e)}")

def cleanup_file(filepath: str):
    """Safely remove a temporary file if it exists."""
    try:
        if filepath and os.path.exists(filepath):
            os.remove(filepath)
    except Exception as e:
        logger.warning(f"Failed to cleanup temporary file {filepath}: {e}")
