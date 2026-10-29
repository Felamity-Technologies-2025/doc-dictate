import React from 'react';
import { ZoomIn, ZoomOut, Check, Mic, Globe } from 'lucide-react';
import { PageLayoutConfig, DictationStatus, DictationSettings } from '../../types';
import { SUPPORTED_LANGUAGES } from '../../utils/punctuation';

interface EditorStatusBarProps {
  wordCount: number;
  charCount: number;
  layout: PageLayoutConfig;
  onUpdateZoom: (zoom: number) => void;
  dictationStatus: DictationStatus;
  dictationSettings: DictationSettings;
}

export const EditorStatusBar: React.FC<EditorStatusBarProps> = ({
  wordCount,
  charCount,
  layout,
  onUpdateZoom,
  dictationStatus,
  dictationSettings,
}) => {
  const currentLang =
    SUPPORTED_LANGUAGES.find((l) => l.code === dictationSettings.language) ||
    SUPPORTED_LANGUAGES[0];

  return (
    <div className="bg-[#2b579a] text-white px-3 py-1 flex items-center justify-between text-[11px] font-sans select-none shrink-0 border-t border-blue-900 shadow-inner">
      {/* Left: Document stats */}
      <div className="flex items-center gap-3">
        <span className="hover:bg-blue-600/70 px-1.5 py-0.5 rounded cursor-pointer transition-colors">
          Page 1 of 1
        </span>
        <span className="hover:bg-blue-600/70 px-1.5 py-0.5 rounded cursor-pointer transition-colors">
          {wordCount.toLocaleString()} {wordCount === 1 ? 'word' : 'words'}
        </span>
        <span className="hover:bg-blue-600/70 px-1.5 py-0.5 rounded cursor-pointer transition-colors hidden sm:inline">
          {charCount.toLocaleString()} characters
        </span>
        <span className="flex items-center gap-1 hover:bg-blue-600/70 px-1.5 py-0.5 rounded cursor-pointer transition-colors">
          <Globe className="w-3 h-3 text-blue-200" />
          <span>{currentLang.label}</span>
        </span>
      </div>

      {/* Center: Dictation indicator */}
      <div className="flex items-center gap-2">
        {dictationStatus === 'listening' && (
          <span className="flex items-center gap-1 text-red-200 bg-red-800/60 px-2 py-0.5 rounded text-[10px] animate-pulse">
            <Mic className="w-3 h-3 text-red-300" />
            <span>Voice Dictation Active (Browser WebSpeech)</span>
          </span>
        )}
      </div>

      {/* Right: Zoom controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onUpdateZoom(Math.max(50, layout.zoom - 10))}
          className="hover:bg-blue-600/70 p-0.5 rounded cursor-pointer transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-3 h-3 text-blue-200" />
        </button>

        <input
          type="range"
          min="50"
          max="200"
          step="10"
          value={layout.zoom}
          onChange={(e) => onUpdateZoom(Number(e.target.value))}
          className="w-20 h-1 bg-blue-300 rounded-lg appearance-none cursor-pointer accent-white"
        />

        <button
          onClick={() => onUpdateZoom(Math.min(200, layout.zoom + 10))}
          className="hover:bg-blue-600/70 p-0.5 rounded cursor-pointer transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-3 h-3 text-blue-200" />
        </button>

        <span className="w-9 text-right font-medium">{layout.zoom}%</span>
      </div>
    </div>
  );
};
