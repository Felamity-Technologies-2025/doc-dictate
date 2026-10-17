import os
import time
import logging
import speech_recognition as sr
from config import Config
from utils.audio_utils import convert_to_wav, cleanup_file

logger = logging.getLogger(__name__)

class SpeechService:
    def __init__(self):
        self.recognizer = sr.Recognizer()
        # Tune recognizer parameters for clear speech dictation
        self.recognizer.energy_threshold = 300
        self.recognizer.dynamic_energy_threshold = True
        self.recognizer.pause_threshold = 0.8

    def transcribe_audio_file(self, filepath: str, language: str = "en-US", engine: str = None) -> dict:
        """
        Transcribes an audio file using speech_recognition.
        Supports languages like 'en-US', 'en-IN', 'ta-IN', 'hi-IN', etc.
        """
        engine = engine or Config.DEFAULT_SPEECH_ENGINE
        converted_wav = None
        start_time = time.time()

        try:
            # Convert source audio to 16kHz mono WAV if not already in that format
            converted_wav = convert_to_wav(filepath)

            # Load audio using SpeechRecognition AudioFile
            with sr.AudioFile(converted_wav) as source:
                # Adjust for ambient noise slightly
                self.recognizer.adjust_for_ambient_noise(source, duration=0.2)
                audio_data = self.recognizer.record(source)

            # Perform speech recognition
            text = ""
            if engine == "google":
                # Google Web Speech API (free tier built into SpeechRecognition)
                # Formats language: en-US, en-IN, ta-IN, hi-IN
                text = self.recognizer.recognize_google(audio_data, language=language)
            elif engine == "whisper":
                # If OpenAI API key is set, use OpenAI Whisper API
                if Config.OPENAI_API_KEY:
                    with open(converted_wav, "rb") as af:
                        import requests
                        headers = {"Authorization": f"Bearer {Config.OPENAI_API_KEY}"}
                        files = {"file": (os.path.basename(converted_wav), af, "audio/wav")}
                        data = {"model": "whisper-1", "language": language.split("-")[0]}
                        resp = requests.post("https://api.openai.com/v1/audio/transcriptions", headers=headers, files=files, data=data, timeout=30)
                        if resp.status_code == 200:
                            text = resp.json().get("text", "")
                        else:
                            raise RuntimeError(f"OpenAI Whisper API error: {resp.text}")
                else:
                    # Fallback to Google engine if Whisper key not configured
                    logger.info("OpenAI key not found, falling back to Google Speech engine")
                    text = self.recognizer.recognize_google(audio_data, language=language)
                    engine = "google (fallback)"
            else:
                text = self.recognizer.recognize_google(audio_data, language=language)

            duration = time.time() - start_time
            return {
                "success": True,
                "text": text.strip(),
                "language": language,
                "engine": engine,
                "duration_seconds": round(duration, 2)
            }

        except sr.UnknownValueError:
            duration = time.time() - start_time
            return {
                "success": False,
                "error": "No speech was detected or the audio was unintelligible. Please speak clearly into your microphone.",
                "text": "",
                "language": language,
                "engine": engine,
                "duration_seconds": round(duration, 2)
            }
        except sr.RequestError as e:
            duration = time.time() - start_time
            logger.error(f"Speech recognition service error: {e}")
            return {
                "success": False,
                "error": f"Speech recognition service request error: {str(e)}. Please check your internet connectivity.",
                "text": "",
                "language": language,
                "engine": engine,
                "duration_seconds": round(duration, 2)
            }
        except Exception as e:
            duration = time.time() - start_time
            logger.error(f"Unexpected error during transcription: {e}")
            return {
                "success": False,
                "error": str(e),
                "text": "",
                "language": language,
                "engine": engine,
                "duration_seconds": round(duration, 2)
            }
        finally:
            if converted_wav and converted_wav != filepath:
                cleanup_file(converted_wav)

# Singleton instance
speech_service = SpeechService()
