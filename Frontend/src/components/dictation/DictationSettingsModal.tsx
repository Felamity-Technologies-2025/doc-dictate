import React from 'react';
import { X, Mic, Globe, CheckCircle2, ShieldCheck } from 'lucide-react';
import { DictationSettings } from '../../types';
import { SUPPORTED_LANGUAGES } from '../../utils/punctuation';
import { isBrowserSpeechSupported } from '../../services/speechRecognition';

interface DictationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: DictationSettings;
  onSaveSettings: (newSettings: DictationSettings) => void;
}

export const DictationSettingsModal: React.FC<DictationSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}) => {
  const [localSettings, setLocalSettings] = React.useState<DictationSettings>(settings);
  const browserSupported = isBrowserSpeechSupported();

  React.useEffect(() => {
    setLocalSettings(settings);
  }, [settings, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveSettings(localSettings);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-4">
      <div className="bg-[#0f172a] rounded-xl shadow-2xl border border-[#1e2c47] w-full max-w-lg max-h-[calc(100dvh-1.5rem)] overflow-y-auto animate-in fade-in duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1e2c47] bg-[#0c1222]">
          <div className="flex items-center gap-2">
            <Mic className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold text-white text-sm">Dictation Settings</h3>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1 rounded-sm cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 text-xs text-neutral-300 max-h-[75vh] overflow-y-auto">
          {/* Speech Recognition */}
          <div>
            <label className="block font-semibold text-white mb-2 flex items-center gap-1.5">
              <Mic className="w-4 h-4 text-blue-400" />
              Speech Recognition
            </label>
            <div className="p-3 rounded-lg border border-blue-500 bg-blue-950/40 ring-1 ring-blue-500/50">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-white">Browser Web Speech (default)</span>
                <CheckCircle2 className="w-4 h-4 text-blue-400" />
              </div>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Real-time continuous voice typing with instant streaming directly into the document.
              </p>
              {!browserSupported && (
                <span className="inline-block mt-1.5 text-[10px] text-red-400 font-medium">
                  (Not supported in current browser)
                </span>
              )}
            </div>
          </div>

          {/* Language Selection */}
          <div>
            <label className="block font-semibold text-white mb-1.5 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-blue-400" />
              Spoken Language & Dialect
            </label>
            <select
              value={localSettings.language}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, language: e.target.value })
              }
              className="w-full bg-[#131b2e] border border-[#1e2c47] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code} className="bg-[#0f172a] text-white">
                  {lang.flag} {lang.label} ({lang.nativeName})
                </option>
              ))}
            </select>
          </div>

          {/* Auto-Punctuation */}
          <div className="pt-2 border-t border-[#1e2c47]">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={localSettings.autoPunctuation}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    autoPunctuation: e.target.checked,
                  })
                }
                className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 bg-[#131b2e] border-[#1e2c47]"
              />
              <div>
                <span className="font-medium text-white block">
                  Automatic Spoken Punctuation
                </span>
                <span className="text-[11px] text-neutral-400 leading-relaxed block">
                  Translates spoken commands (*"period"*, *"comma"*, *"question mark"*, *"new line"*, *"new paragraph"*) into punctuation marks.
                </span>
              </div>
            </label>
          </div>

          {/* Privacy & Permissions note */}
          <div className="bg-[#131b2e] rounded-lg p-3 border border-[#1e2c47] flex items-start gap-2 text-[11px] text-neutral-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-white">Privacy & Audio Stream</p>
              <p className="text-neutral-400 mt-0.5">
                Microphone audio is captured only during active dictation. No background recording takes place.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[#1e2c47] bg-[#0c1222]">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 border border-[#1e2c47] hover:bg-[#162035] rounded-lg text-neutral-300 font-medium cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-lg font-medium cursor-pointer shadow-xs transition-colors"
          >
            Apply Settings
          </button>
        </div>
      </div>
    </div>
  );
};
