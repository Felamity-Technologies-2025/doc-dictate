import React, { useState } from 'react';
import {
  Cpu,
  ChevronDown,
  FileText,
  ChevronRight,
  Settings as SettingsIcon,
  Check,
  CloudUpload,
  AlertCircle,
  Download,
  Plus,
  LayoutTemplate,
  FileDown,
  Loader2,
  Mic,
} from 'lucide-react';
import { DictationSettings, DictationStatus, ExportFormat } from '../../types';
import { SUPPORTED_LANGUAGES } from '../../utils/punctuation';

interface RagsuiteTopBarProps {
  documentTitle: string;
  onUpdateTitle: (title: string) => void;
  saveStatus: 'saved' | 'saving' | 'unsaved' | 'failed';
  onManualSave: () => void;
  onNewDocument?: () => void;
  dictationSettings: DictationSettings;
  onOpenDictationSettings: () => void;
  onOpenDocuments: () => void;
  onOpenTemplates: () => void;
  onExportDocument: (format: ExportFormat) => void;
  exportingFormat: ExportFormat | null;
  onUpdateDictationLanguage: (language: string) => void;
  dictationStatus: DictationStatus;
  onToggleDictation: () => void;
}

export const RagsuiteTopBar: React.FC<RagsuiteTopBarProps> = ({
  documentTitle,
  onUpdateTitle,
  saveStatus,
  onManualSave,
  onNewDocument,
  dictationSettings,
  onOpenDictationSettings,
  onOpenDocuments,
  onOpenTemplates,
  onExportDocument,
  exportingFormat,
  onUpdateDictationLanguage,
  dictationStatus,
  onToggleDictation,
}) => {
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [engineDropdownOpen, setEngineDropdownOpen] = useState(false);
  const [dictationMenuOpen, setDictationMenuOpen] = useState(false);
  const isRecording = dictationStatus === 'listening';
  const isTranscribing = dictationStatus === 'transcribing';
  const isRequesting = dictationStatus === 'requesting-permission';
  const currentLang =
    SUPPORTED_LANGUAGES.find((language) => language.code === dictationSettings.language) ??
    SUPPORTED_LANGUAGES[0];

  return (
    <header className="min-h-14 bg-[#0b101e] border-b border-[#19243a] px-2.5 sm:px-4 py-2 flex flex-wrap sm:flex-nowrap items-center justify-between gap-x-2 sm:gap-x-3 gap-y-2 select-none shrink-0 z-30">
      {/* Left Action Pills (icon-only on small screens) */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Select AI Model / Speech Engine Dropdown */}
        <div className="relative">
          <button
            onClick={() => setEngineDropdownOpen(!engineDropdownOpen)}
            className="bg-[#162035] hover:bg-[#1a2842] border border-[#23334d] text-white rounded-lg px-2 sm:px-3 py-1.5 text-xs font-normal flex items-center gap-1.5 sm:gap-2 cursor-pointer transition-colors shadow-xs"
            title="Speech-to-Text Engine"
          >
            <Cpu className="w-4 h-4 text-blue-400" />
            <span className="font-medium hidden xl:inline">
              {dictationSettings.engine === 'browser' ? 'Browser WebSpeech' : 'Flask Backend'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
          </button>

          {engineDropdownOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setEngineDropdownOpen(false)} />
              <div className="absolute top-full left-0 mt-1.5 w-60 max-w-[calc(100vw-1.25rem)] bg-[#121929] border border-[#23334d] rounded-lg shadow-2xl py-1.5 z-40 text-xs text-neutral-200">
                <div className="px-3 py-1 text-[10px] uppercase font-bold text-neutral-500 tracking-wider">
                  Speech-to-Text Engines
                </div>
                <button
                  onClick={() => {
                    onOpenDictationSettings();
                    setEngineDropdownOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-[#1a2842] flex items-center justify-between"
                >
                  <div className="flex flex-col">
                    <span className="font-medium text-white">Browser WebSpeech API</span>
                    <span className="text-[10px] text-neutral-400">Zero latency real-time voice typing</span>
                  </div>
                  {dictationSettings.engine === 'browser' && <Check className="w-4 h-4 text-blue-400" />}
                </button>
                <button
                  onClick={() => {
                    onOpenDictationSettings();
                    setEngineDropdownOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-[#1a2842] flex items-center justify-between"
                >
                  <div className="flex flex-col">
                    <span className="font-medium text-white">Python Flask Backend</span>
                    <span className="text-[10px] text-neutral-400">Google / Whisper audio API</span>
                  </div>
                  {dictationSettings.engine === 'flask' && <Check className="w-4 h-4 text-blue-400" />}
                </button>
                <div className="border-t border-[#1e2c47] my-1" />
                <button
                  onClick={() => {
                    onOpenDictationSettings();
                    setEngineDropdownOpen(false);
                  }}
                  className="w-full px-3 py-1.5 text-left text-blue-400 hover:bg-[#1a2842] text-[11px]"
                >
                  Engine & Language Settings...
                </button>
              </div>
            </>
          )}
        </div>

        {/* New Document Button */}
        {onNewDocument && (
          <button
            onClick={onNewDocument}
            className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
            title="Create New Document (Ctrl+N)"
          >
            <Plus className="w-4 h-4 md:w-3.5 md:h-3.5" />
            <span className="hidden md:inline">New Document</span>
          </button>
        )}

        {/* File Viewer > Pill */}
        <button
          onClick={onOpenDocuments}
          className="bg-[#162035] hover:bg-[#1a2842] border border-[#23334d] text-neutral-200 hover:text-white rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-normal flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
          title="File Viewer"
        >
          <FileText className="w-4 h-4 text-neutral-400" />
          <span className="hidden lg:inline">File Viewer</span>
          <ChevronRight className="w-3.5 h-3.5 text-neutral-400 hidden lg:block" />
        </button>

        {/* Reusable PDF Templates */}
        <button
          onClick={onOpenTemplates}
          className="bg-[#162035] hover:bg-[#1a2842] border border-[#23334d] text-neutral-200 hover:text-white rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-normal flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
          title="Upload PDF or DOCX templates and create documents from them"
        >
          <LayoutTemplate className="w-4 h-4 text-blue-400" />
          <span className="hidden lg:inline">Templates</span>
        </button>
      </div>

      {/* Document Title: its own full-width row on phones, fills the middle from sm up */}
      <div className="order-last sm:order-none basis-full sm:basis-auto flex-1 min-w-0 flex items-center gap-2">
        <input
          type="text"
          value={documentTitle}
          onChange={(e) => onUpdateTitle(e.target.value)}
          className="bg-[#121929] hover:bg-[#162035] focus:bg-[#162035] border border-transparent focus:border-[#2b3c5a] rounded-lg px-2.5 py-1 text-xs font-medium text-white focus:outline-none flex-1 sm:flex-none w-full sm:w-52 min-w-0 transition-colors truncate"
          title="Click to rename document"
        />

        {/* Save Status Badge */}
        <div className="flex items-center gap-1.5 text-[11px] shrink-0">
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1 text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded-full text-[10px]">
              <Check className="w-3 h-3" />
              <span className="hidden md:inline">Saved</span>
            </span>
          )}
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1 text-blue-400 bg-blue-950/40 border border-blue-800/40 px-2 py-0.5 rounded-full text-[10px] animate-pulse">
              <CloudUpload className="w-3 h-3" />
              <span className="hidden md:inline">Saving...</span>
            </span>
          )}
          {saveStatus === 'unsaved' && (
            <span className="flex items-center gap-1 text-amber-400 bg-amber-950/40 border border-amber-800/40 px-2 py-0.5 rounded-full text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
              <span className="hidden md:inline">Unsaved</span>
            </span>
          )}
          {saveStatus === 'failed' && (
            <span className="flex items-center gap-1 text-red-400 bg-red-950/40 border border-red-800/40 px-2 py-0.5 rounded-full text-[10px]">
              <AlertCircle className="w-3 h-3" />
              <span className="hidden md:inline">Save error</span>
            </span>
          )}
        </div>
      </div>

      {/* Right Action Buttons */}
      <div className="flex items-center gap-0.5 sm:gap-2 shrink-0">
        {/* Settings Gear Icon */}
        <button
          onClick={onOpenDictationSettings}
          className="p-2 text-[#8da0bd] hover:text-white hover:bg-[#162035] rounded-lg transition-colors cursor-pointer"
          title="Settings & Dictation Configuration"
        >
          <SettingsIcon className="w-4 h-4" />
        </button>

        {/* Primary Dictation Control */}
        <div className="relative flex items-center">
          <div
            className={`flex items-stretch rounded-lg border transition-all ${
              isRecording
                ? 'bg-red-500/20 border-red-500/60 ring-2 ring-red-500/30'
                : isTranscribing
                ? 'bg-amber-500/20 border-amber-500/50'
                : 'bg-[#18233a] hover:bg-[#1e2b47] border-[#253552]'
            }`}
          >
            <button
              onClick={onToggleDictation}
              disabled={isRequesting}
              className={`flex items-center gap-2 px-2.5 sm:px-3 py-1.5 text-xs font-semibold cursor-pointer transition-colors disabled:opacity-60 ${
                isRecording
                  ? 'text-red-400'
                  : isTranscribing
                  ? 'text-amber-400'
                  : 'text-white hover:text-blue-400'
              }`}
              title={isRecording ? 'Click to stop dictating' : 'Click to start voice dictation'}
            >
              <Mic
                className={`w-4 h-4 ${
                  isRecording
                    ? 'text-red-500 animate-pulse scale-110'
                    : isTranscribing
                    ? 'text-amber-400 animate-spin'
                    : 'text-blue-400'
                }`}
              />
              <span>
                {isRecording
                  ? 'Recording...'
                  : isTranscribing
                  ? 'Transcribing...'
                  : isRequesting
                  ? 'Starting...'
                  : 'Dictate'}
              </span>
            </button>
            <button
              onClick={() => setDictationMenuOpen(!dictationMenuOpen)}
              className="px-1.5 border-l border-[#253552] text-neutral-400 hover:text-white hover:bg-[#202f4e] cursor-pointer flex items-center justify-center transition-colors rounded-r-lg"
              title="Dictation options"
              aria-haspopup="menu"
              aria-expanded={dictationMenuOpen}
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {dictationMenuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setDictationMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1.5 w-64 max-w-[calc(100vw-1.5rem)] bg-[#121929] border border-[#23334d] rounded-lg shadow-2xl py-1.5 z-40 text-xs text-neutral-200">
                <div className="px-3 py-1 border-b border-[#1e2c47] flex items-center justify-between text-neutral-400">
                  <span className="font-semibold text-white">Voice Dictation</span>
                  <span className="text-[10px] text-blue-400 uppercase font-mono">
                    {dictationSettings.engine}
                  </span>
                </div>
                <div className="px-3 py-1.5 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                  Language ({currentLang.label})
                </div>
                <div className="max-h-36 overflow-y-auto">
                  {SUPPORTED_LANGUAGES.map((language) => (
                    <button
                      key={language.code}
                      onClick={() => {
                        onUpdateDictationLanguage(language.code);
                        setDictationMenuOpen(false);
                      }}
                      className={`w-full px-3 py-1.5 flex items-center justify-between hover:bg-[#1a2842] text-left transition-colors ${
                        dictationSettings.language === language.code
                          ? 'text-blue-400 bg-blue-950/40 font-medium'
                          : 'text-neutral-300'
                      }`}
                    >
                      <span>
                        {language.flag} {language.label}
                      </span>
                      {dictationSettings.language === language.code && (
                        <Check className="w-3.5 h-3.5 text-blue-400" />
                      )}
                    </button>
                  ))}
                </div>
                <div className="border-t border-[#1e2c47] my-1" />
                <button
                  onClick={() => {
                    setDictationMenuOpen(false);
                    onOpenDictationSettings();
                  }}
                  className="w-full px-3 py-2 flex items-center gap-2 hover:bg-[#1a2842] text-neutral-300 hover:text-white"
                >
                  <SettingsIcon className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Dictation Settings & Engines...</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Download Menu */}
        <div className="relative">
          <button
            onClick={() => setDownloadMenuOpen(!downloadMenuOpen)}
            disabled={!!exportingFormat}
            className="bg-[#162035] hover:bg-[#1a2842] border border-[#23334d] text-white rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-60"
            title="Download or export document"
          >
            {exportingFormat ? (
              <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5 text-blue-400" />
            )}
            <span>Download</span>
            <ChevronDown className="w-3 h-3 text-neutral-400" />
          </button>

          {downloadMenuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setDownloadMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-[#121929] border border-[#23334d] text-neutral-200 rounded-lg shadow-2xl py-1.5 z-40 text-xs">
                {(['docx', 'pdf'] as ExportFormat[]).map((format) => (
                  <button
                    key={format}
                    disabled={!!exportingFormat}
                    onClick={() => {
                      onExportDocument(format);
                      setDownloadMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 flex items-center gap-2 hover:bg-[#1a2842] transition-colors text-left disabled:opacity-60"
                  >
                    <FileDown className="w-3.5 h-3.5 text-blue-400" />
                    <span>Download as {format.toUpperCase()} (.{format})</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
