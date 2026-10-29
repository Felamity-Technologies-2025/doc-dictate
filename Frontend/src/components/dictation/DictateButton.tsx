import React, { useState } from 'react';
import { Mic, ChevronDown, Settings, Globe, Check } from 'lucide-react';
import { DictationStatus, DictationSettings } from '../../types';
import { SUPPORTED_LANGUAGES } from '../../utils/punctuation';

interface DictateButtonProps {
  status: DictationStatus;
  settings: DictationSettings;
  onToggleDictation: () => void;
  onOpenSettings: () => void;
  onUpdateLanguage: (lang: string) => void;
}

export const DictateButton: React.FC<DictateButtonProps> = ({
  status,
  settings,
  onToggleDictation,
  onOpenSettings,
  onUpdateLanguage,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const isRecording = status === 'listening';
  const isRequesting = status === 'requesting-permission';

  const currentLang = SUPPORTED_LANGUAGES.find((l) => l.code === settings.language) || SUPPORTED_LANGUAGES[0];

  return (
    <div className="relative inline-flex flex-col items-center">
      <div
        className={`flex items-stretch rounded border transition-all shadow-xs ${
          isRecording
            ? 'bg-red-50 border-red-300 ring-2 ring-red-400/30'
            : 'bg-white hover:bg-neutral-50 border-neutral-200'
        }`}
      >
        {/* Main Action Button */}
        <button
          onClick={onToggleDictation}
          disabled={isRequesting}
          className={`flex flex-col items-center justify-center px-3 py-1 text-center cursor-pointer min-w-[62px] transition-colors ${
            isRecording
              ? 'text-red-600'
              : 'text-neutral-700 hover:text-blue-700'
          }`}
          title={isRecording ? 'Click to stop dictation' : 'Click to start voice dictation'}
        >
          <div className="relative my-0.5">
            <Mic
              className={`w-6 h-6 transition-transform ${
                isRecording
                  ? 'animate-pulse text-red-600 scale-110'
                  : 'text-blue-600'
              }`}
            />
            {isRecording && (
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
              </span>
            )}
          </div>
          <span className="text-[11px] font-semibold leading-tight">
            {isRecording
              ? 'Dictating...'
              : isRequesting
              ? 'Starting...'
              : 'Dictate'}
          </span>
        </button>

        {/* Dropdown Chevron */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setDropdownOpen(!dropdownOpen);
          }}
          className="px-1 border-l border-neutral-200 hover:bg-neutral-100 text-neutral-600 flex items-center justify-center cursor-pointer transition-colors"
          title="Dictation options & settings"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Voice Ribbon Category Label */}
      <span className="text-[10px] text-neutral-400 uppercase tracking-wider mt-0.5">
        Voice
      </span>

      {/* Dropdown Menu */}
      {dropdownOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setDropdownOpen(false)}
          />
          <div className="absolute top-full right-0 mt-1 w-64 bg-white rounded-md shadow-xl border border-neutral-200 py-1.5 z-50 text-xs">
            <div className="px-3 py-1.5 border-b border-neutral-100 flex items-center justify-between text-neutral-500">
              <span className="font-semibold text-neutral-700">Dictation Options</span>
              <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase">
                Browser WebSpeech
              </span>
            </div>

            {/* Quick Language Selection */}
            <div className="px-3 py-1 text-[11px] font-medium text-neutral-400 uppercase tracking-wider">
              Language ({currentLang.label})
            </div>
            <div className="max-h-36 overflow-y-auto">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    onUpdateLanguage(lang.code);
                    setDropdownOpen(false);
                  }}
                  className={`w-full px-3 py-1.5 flex items-center justify-between hover:bg-blue-50 text-left transition-colors ${
                    settings.language === lang.code ? 'text-blue-700 font-medium bg-blue-50/50' : 'text-neutral-700'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span>{lang.flag}</span>
                    <span>{lang.label}</span>
                  </span>
                  {settings.language === lang.code && <Check className="w-3.5 h-3.5 text-blue-600" />}
                </button>
              ))}
            </div>

            {/* Dictation Settings */}
            <button
              onClick={() => {
                setDropdownOpen(false);
                onOpenSettings();
              }}
              className="w-full px-3 py-1.5 flex items-center gap-2 text-neutral-700 hover:bg-neutral-100 transition-colors"
            >
              <Settings className="w-3.5 h-3.5 text-neutral-500" />
              <span>Dictation Settings...</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};
