import React from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { DictationStatus } from '../../types';
import { SUPPORTED_LANGUAGES } from '../../utils/punctuation';

interface DictationOverlayBadgeProps {
  status: DictationStatus;
  interimText: string;
  audioLevel: number;
  language: string;
  engine: string;
  onStop: () => void;
}

export const DictationOverlayBadge: React.FC<DictationOverlayBadgeProps> = ({
  status,
  interimText,
  audioLevel,
  language,
  engine,
  onStop,
}) => {
  const isListening = status === 'listening';
  const isTranscribing = status === 'transcribing';

  if (!isListening && !isTranscribing && !interimText) return null;

  const currentLang = SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];

  // Dynamic audio bars based on real-time audioLevel (0-100)
  const barHeights = [
    Math.max(15, (audioLevel * 0.6) % 100),
    Math.max(25, (audioLevel * 1.1) % 100),
    Math.max(35, (audioLevel * 1.4) % 100),
    Math.max(20, (audioLevel * 0.9) % 100),
    Math.max(10, (audioLevel * 0.4) % 100),
  ];

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 max-w-xl w-[90%] sm:w-auto animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="bg-[#0f172a]/95 backdrop-blur-md text-white rounded-xl px-4 py-2.5 shadow-2xl border border-[#23334d] flex items-center gap-3">
        {/* Mic Icon with Audio Level animation */}
        <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 shrink-0 border border-blue-500/30">
          {isTranscribing ? (
            <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
          ) : (
            <Mic className="w-4 h-4 text-red-400 animate-pulse" />
          )}
        </div>

        {/* Live Audio Visualizer Bars */}
        {isListening && (
          <div className="flex items-center gap-0.5 h-5 px-1 shrink-0">
            {barHeights.map((h, i) => (
              <span
                key={i}
                className="w-1 bg-red-400 rounded-full transition-all duration-75"
                style={{ height: `${Math.min(20, Math.max(4, (h / 100) * 20))}px` }}
              />
            ))}
          </div>
        )}

        {/* Status & Interim Text Display */}
        <div className="flex flex-col min-w-[140px] max-w-[260px] sm:max-w-md truncate">
          <div className="flex items-center gap-1.5 text-[11px] text-[#7082a4]">
            <span className="font-semibold text-white uppercase tracking-wider text-[10px]">
              {isTranscribing ? 'Transcribing...' : 'Listening'}
            </span>
            <span>•</span>
            <span>{currentLang.flag} {currentLang.label}</span>
            <span>•</span>
            <span className="text-[10px] text-blue-400">{engine === 'browser' ? 'Browser' : 'Flask'}</span>
          </div>

          <p className="text-xs text-neutral-200 truncate italic">
            {interimText || 'Speak clearly into your microphone...'}
          </p>
        </div>

        {/* Stop Button */}
        <button
          onClick={onStop}
          className="ml-auto bg-[#18233a] hover:bg-[#1e2d48] text-neutral-200 hover:text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors border border-[#253552] shrink-0"
          title="Stop Dictation"
        >
          <Square className="w-3 h-3 text-red-400 fill-red-400" />
          <span>Stop</span>
        </button>
      </div>
    </div>
  );
};
