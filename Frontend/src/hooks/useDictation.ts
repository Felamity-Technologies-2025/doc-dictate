import { useState, useRef, useCallback, useEffect } from 'react';
import type { Editor } from '@tiptap/react';
import { DictationSettings, DictationStatus } from '../types';
import { formatSpokenPunctuation } from '../utils/punctuation';
import {
  isBrowserSpeechSupported,
  BrowserSpeechManager,
  AudioLevelAnalyzer,
} from '../services/speechRecognition';

export function useDictation(editor: Editor | null) {
  const [settings, setSettings] = useState<DictationSettings>({
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

      // 3. Start browser-based speech recognition
      if (!isBrowserSpeechSupported()) {
        throw new Error(
          'Web Speech API is not supported in this browser. Please use a supported browser such as Chrome or Edge.'
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
    if (status === 'listening' || status === 'requesting-permission') {
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
    toggleDictation,
    startDictation,
    stopDictation,
  };
}
