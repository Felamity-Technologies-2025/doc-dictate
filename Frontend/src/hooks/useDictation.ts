import { useState, useRef, useCallback, useEffect } from 'react';
import type { Editor } from '@tiptap/react';
import { DictationSettings, DictationStatus } from '../types';
import { formatSpokenPunctuation } from '../utils/punctuation';
import {
  isBrowserSpeechSupported,
  BrowserSpeechManager,
  AudioLevelAnalyzer,
} from '../services/speechRecognition';
import { ApiService } from '../services/api';

export function useDictation(editor: Editor | null) {
  const [settings, setSettings] = useState<DictationSettings>({
    engine: isBrowserSpeechSupported() ? 'browser' : 'flask',
    language: 'en-US',
    autoPunctuation: true,
    continuous: true,
  });

  const [status, setStatus] = useState<DictationStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [interimText, setInterimText] = useState<string>('');
  const [audioLevel, setAudioLevel] = useState<number>(0);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const levelAnalyzerRef = useRef<AudioLevelAnalyzer | null>(null);
  const browserManagerRef = useRef<BrowserSpeechManager | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Cleanup helper
  const stopAudioStreams = useCallback(() => {
    if (levelAnalyzerRef.current) {
      levelAnalyzerRef.current.stop();
      levelAnalyzerRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  // Insert finalized text into editor safely using Tiptap transaction
  const insertRecognizedText = useCallback(
    (rawText: string) => {
      if (!rawText.trim() || !editor) return;

      const formatted = settings.autoPunctuation
        ? formatSpokenPunctuation(rawText.trim())
        : rawText.trim();

      // Ensure a space before the inserted text if needed
      editor.commands.insertContent(`${formatted} `);
    },
    [editor, settings.autoPunctuation]
  );

  // Stop dictation
  const stopDictation = useCallback(() => {
    if (browserManagerRef.current) {
      browserManagerRef.current.stop();
      browserManagerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Ignore
      }
      mediaRecorderRef.current = null;
    }

    stopAudioStreams();
    setInterimText('');
    setStatus('idle');
  }, [stopAudioStreams]);

  // Start dictation
  const startDictation = useCallback(async () => {
    setErrorMessage(null);
    setStatus('requesting-permission');

    try {
      // 1. Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      // 2. Start audio visualizer level analyzer
      const analyzer = new AudioLevelAnalyzer();
      levelAnalyzerRef.current = analyzer;
      analyzer.start(stream, (level) => {
        setAudioLevel(level);
      });

      // 3. Start speech recognition according to selected engine
      if (settings.engine === 'browser') {
        if (!isBrowserSpeechSupported()) {
          throw new Error(
            'Browser Speech Recognition is not supported. Please choose Flask Backend engine in Dictate Settings.'
          );
        }

        const manager = new BrowserSpeechManager(
          (finalTranscript) => {
            insertRecognizedText(finalTranscript);
            setInterimText('');
          },
          (interimTranscript) => {
            setInterimText(interimTranscript);
          },
          (err) => {
            setErrorMessage(err);
            setStatus('error');
            stopAudioStreams();
          },
          (isListening) => {
            setStatus(isListening ? 'listening' : 'idle');
          }
        );

        browserManagerRef.current = manager;
        manager.start(settings.language, settings.continuous);
      } else {
        // Flask Backend speech recognition using MediaRecorder audio capture
        setStatus('listening');
        audioChunksRef.current = [];

        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/ogg';

        const recorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        recorder.onstop = async () => {
          if (audioChunksRef.current.length === 0) return;
          setStatus('transcribing');
          setInterimText('Transcribing audio via Python Flask backend...');

          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          try {
            const resp = await ApiService.transcribeAudio(
              audioBlob,
              'voice_dictation.webm',
              settings.language,
              'google'
            );
            if (resp.success && resp.text) {
              insertRecognizedText(resp.text);
            } else if (resp.error) {
              setErrorMessage(resp.error);
            }
          } catch (e) {
            setErrorMessage(`Backend transcription failed: ${e}`);
          } finally {
            setInterimText('');
            setStatus('idle');
            stopAudioStreams();
          }
        };

        recorder.start(1000); // 1-second slices
      }
    } catch (err: unknown) {
      stopAudioStreams();
      setStatus('error');
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Permission denied') || msg.includes('not-allowed')) {
        setErrorMessage(
          'Microphone permission denied. Please allow microphone access in your browser or iframe permissions to dictate.'
        );
      } else {
        setErrorMessage(`Microphone error: ${msg}`);
      }
    }
  }, [settings, insertRecognizedText, stopAudioStreams]);

  // Toggle dictation
  const toggleDictation = useCallback(() => {
    if (status === 'listening' || status === 'transcribing' || status === 'requesting-permission') {
      stopDictation();
    } else {
      startDictation();
    }
  }, [status, startDictation, stopDictation]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopDictation();
    };
  }, [stopDictation]);

  return {
    status,
    settings,
    setSettings,
    errorMessage,
    setErrorMessage,
    interimText,
    audioLevel,
    isListening: status === 'listening',
    isTranscribing: status === 'transcribing',
    toggleDictation,
    startDictation,
    stopDictation,
  };
}
