// Type declarations for Web Speech API
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: {
        transcript: string;
        confidence: number;
      };
    };
  };
}

interface SpeechRecognitionErrorEventLike {
  error: string;
  message?: string;
}

interface SpeechRecognitionInstanceLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstanceLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export function isBrowserSpeechSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export class AudioLevelAnalyzer {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private dataArray: Uint8Array<ArrayBuffer> | null = null;
  private animationFrameId: number | null = null;

  start(stream: MediaStream, onLevel: (level: number) => void) {
    try {
      this.audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.microphone = this.audioCtx.createMediaStreamSource(stream);
      this.microphone.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      this.dataArray = dataArray;

      const update = () => {
        if (!this.analyser || !this.dataArray) return;
        this.analyser.getByteFrequencyData(this.dataArray);
        let sum = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
          sum += this.dataArray[i];
        }
        const avg = sum / this.dataArray.length;
        // Normalize 0 - 100
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        onLevel(normalized);
        this.animationFrameId = requestAnimationFrame(update);
      };
      update();
    } catch (err) {
      console.warn('AudioLevelAnalyzer failed to initialize:', err);
    }
  }

  stop() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.microphone) {
      this.microphone.disconnect();
      this.microphone = null;
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
    this.analyser = null;
    this.dataArray = null;
  }
}

export class BrowserSpeechManager {
  private recognition: SpeechRecognitionInstanceLike | null = null;
  private isListening = false;
  private shouldRestart = false;

  constructor(
    private onFinalResult: (transcript: string) => void,
    private onInterimResult: (transcript: string) => void,
    private onError: (errorMsg: string) => void,
    private onStateChange: (listening: boolean) => void
  ) {}

  start(lang = 'en-US', continuous = true) {
    if (!isBrowserSpeechSupported()) {
      this.onError('Web Speech API is not supported in this browser. Please use the Flask Backend engine or Google Chrome/Edge.');
      return;
    }

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) return;

    this.shouldRestart = continuous;
    this.recognition = new SpeechRec();
    this.recognition.continuous = continuous;
    this.recognition.interimResults = true;
    this.recognition.lang = lang;
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.onStateChange(true);
    };

    this.recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const item = event.results[i];
        const transcript = item[0]?.transcript || '';
        if (item.isFinal) {
          this.onFinalResult(transcript);
        } else {
          interimTranscript += transcript;
        }
      }
      this.onInterimResult(interimTranscript);
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      const err = event.error;
      let msg = `Speech recognition error: ${err}`;
      if (err === 'not-allowed') {
        msg = 'Microphone permission was denied. Please allow microphone access in your browser settings to use Dictation.';
        this.shouldRestart = false;
      } else if (err === 'no-speech') {
        // No speech detected is common during pauses, ignore or report gently
        return;
      } else if (err === 'network') {
        msg = 'Network connection issue with speech recognition service.';
      } else if (err === 'audio-capture') {
        msg = 'No microphone was detected. Please ensure a microphone is connected.';
        this.shouldRestart = false;
      }
      this.onError(msg);
    };

    this.recognition.onend = () => {
      this.onInterimResult('');
      if (this.shouldRestart) {
        try {
          this.recognition?.start();
          return;
        } catch {
          // Ignore restart race condition
        }
      }
      this.isListening = false;
      this.onStateChange(false);
    };

    try {
      this.recognition.start();
    } catch (e) {
      this.onError(`Failed to start speech recognition: ${e}`);
      this.isListening = false;
      this.onStateChange(false);
    }
  }

  stop() {
    this.shouldRestart = false;
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {
        // Ignore
      }
    }
    this.isListening = false;
    this.onStateChange(false);
    this.onInterimResult('');
  }
}
