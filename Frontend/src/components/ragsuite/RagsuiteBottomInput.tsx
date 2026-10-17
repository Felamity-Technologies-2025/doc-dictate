import React, { useState } from 'react';
import { Plus, Send, Mic, Square, Loader2 } from 'lucide-react';
import { DictationStatus } from '../../types';

interface RagsuiteBottomInputProps {
  onInsertText: (text: string) => void;
  dictationStatus: DictationStatus;
  interimText: string;
  onToggleDictation: () => void;
  onOpenQuickMenu: () => void;
  wordCount: number;
  charCount: number;
  engine: string;
  language: string;
}

export const RagsuiteBottomInput: React.FC<RagsuiteBottomInputProps> = ({
  onInsertText,
  dictationStatus,
  interimText,
  onToggleDictation,
  onOpenQuickMenu,
  wordCount,
  charCount,
  engine,
  language,
}) => {
  const [inputText, setInputText] = useState('');

  const isRecording = dictationStatus === 'listening';
  const isTranscribing = dictationStatus === 'transcribing';

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (inputText.trim()) {
      onInsertText(inputText.trim());
      setInputText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="px-2.5 sm:px-6 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-4 bg-[#090d16] border-t border-[#162035] select-none shrink-0 z-20">
      {/* Input Pill matching RAGSUITE screenshot */}
      <form
        onSubmit={handleSend}
        className="bg-[#131b2e] border border-[#202e48] rounded-xl px-2.5 sm:px-3.5 py-2 flex items-center gap-2 sm:gap-3 shadow-lg focus-within:border-blue-500/60 transition-colors"
      >
        {/* Plus action button (+) */}
        <button
          type="button"
          onClick={onOpenQuickMenu}
          className="text-[#8da0bd] hover:text-white p-1 rounded-full hover:bg-[#1a2842] transition-colors cursor-pointer"
          title="Quick Insert (Table, Image, Link)"
        >
          <div className="w-5 h-5 rounded-full border border-[#8da0bd]/60 flex items-center justify-center">
            <Plus className="w-3.5 h-3.5" />
          </div>
        </button>

        {/* Input Text or Live Speech Stream */}
        <input
          type="text"
          value={isRecording && interimText ? interimText : inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isRecording
              ? 'Listening... Speak into your microphone...'
              : 'Send a message or voice note to document...'
          }
          className={`flex-1 min-w-0 bg-transparent text-xs text-white focus:outline-none placeholder-[#64748b] ${
            isRecording ? 'italic text-blue-300' : ''
          }`}
        />

        {/* Mic Toggle Button */}
        <button
          type="button"
          onClick={onToggleDictation}
          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
            isRecording
              ? 'bg-red-500 text-white animate-pulse'
              : isTranscribing
              ? 'bg-amber-500 text-white'
              : 'text-[#8da0bd] hover:text-white hover:bg-[#1a2842]'
          }`}
          title={isRecording ? 'Stop Dictating' : 'Voice Dictation'}
        >
          {isTranscribing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isRecording ? (
            <Square className="w-4 h-4 fill-white" />
          ) : (
            <Mic className="w-4 h-4" />
          )}
        </button>

        {/* Send Arrow Button (->) matching RAGSUITE screenshot */}
        <button
          type="submit"
          disabled={!inputText.trim() && !interimText}
          className="text-[#8da0bd] hover:text-blue-400 disabled:opacity-40 p-1.5 rounded-lg hover:bg-[#1a2842] transition-colors cursor-pointer"
          title="Insert into Document"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      {/* Bottom subtle metadata row */}
      <div className="flex items-center justify-between gap-2 text-[11px] text-[#64748b] px-1 sm:px-2 pt-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <span className="whitespace-nowrap">{wordCount} words</span>
          <span>•</span>
          <span className="whitespace-nowrap">{charCount} characters</span>
          <span className="hidden md:inline">•</span>
          <span className="text-[#8da0bd] hidden md:inline">Engine: {engine === 'browser' ? 'Browser WebSpeech' : 'Flask Backend'}</span>
        </div>
        <div className="flex items-center gap-2 text-emerald-400 shrink-0" title="SQLite Database Connected">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          <span className="hidden sm:inline">SQLite Database Connected</span>
        </div>
      </div>
    </div>
  );
};
