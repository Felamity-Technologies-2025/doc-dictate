import React, { useState, useRef } from 'react';
import { X, Upload, FileAudio, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { ApiService } from '../../services/api';
import { SUPPORTED_LANGUAGES } from '../../utils/punctuation';

interface AudioFileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertText: (text: string) => void;
  currentLanguage: string;
}

export const AudioFileUploadModal: React.FC<AudioFileUploadModalProps> = ({
  isOpen,
  onClose,
  onInsertText,
  currentLanguage,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState(currentLanguage);
  const [engine, setEngine] = useState('google');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultText, setResultText] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setResultText(null);
    }
  };

  const handleTranscribe = async () => {
    if (!file) {
      setError('Please choose an audio file first.');
      return;
    }

    setIsUploading(true);
    setError(null);
    setResultText(null);

    try {
      const response = await ApiService.transcribeAudio(file, file.name, language, engine);
      if (response.success && response.text) {
        setResultText(response.text);
      } else {
        setError(response.error || 'Failed to transcribe audio file.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Upload error: ${msg}. Make sure Python Flask backend is running on port 5000.`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleInsertAndClose = () => {
    if (resultText) {
      onInsertText(resultText);
      handleClose();
    }
  };

  const handleClose = () => {
    setFile(null);
    setError(null);
    setResultText(null);
    setIsUploading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-4">
      <div className="bg-[#0f172a] rounded-xl shadow-2xl border border-[#1e2c47] w-full max-w-lg max-h-[calc(100dvh-1.5rem)] overflow-y-auto animate-in fade-in duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1e2c47] bg-[#0c1222]">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold text-white text-sm">
              Transcribe Audio File (Flask API)
            </h3>
          </div>
          <button
            onClick={handleClose}
            className="text-neutral-400 hover:text-white p-1 rounded-sm cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs text-neutral-300">
          <p className="text-neutral-400 text-[11px]">
            Upload an existing voice memo or recording (.wav, .mp3, .m4a, .webm, .ogg) to transcribe via the Python Flask backend.
          </p>

          {/* Drag & drop / upload target */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[#1e2c47] hover:border-blue-500 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer bg-[#131b2e] hover:bg-[#162238] transition-colors"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".wav,.mp3,.m4a,.ogg,.webm,.flac,.aac"
              className="hidden"
            />
            <FileAudio className="w-8 h-8 text-blue-400 mb-2" />
            <span className="font-medium text-white text-center">
              {file ? file.name : 'Click to select audio file'}
            </span>
            <span className="text-[11px] text-neutral-400 mt-1">
              {file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : 'Supported: WAV, MP3, M4A, OGG, WEBM (Max 25MB)'}
            </span>
          </div>

          {/* Options */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-neutral-300 mb-1">Spoken Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full bg-[#131b2e] border border-[#1e2c47] rounded-lg px-3 py-1.5 text-xs text-white"
              >
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code} className="bg-[#0f172a] text-white">
                    {l.flag} {l.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-neutral-300 mb-1">Backend Engine</label>
              <select
                value={engine}
                onChange={(e) => setEngine(e.target.value)}
                className="w-full bg-[#131b2e] border border-[#1e2c47] rounded-lg px-3 py-1.5 text-xs text-white"
              >
                <option value="google" className="bg-[#0f172a] text-white">Google SpeechRecognition</option>
                <option value="whisper" className="bg-[#0f172a] text-white">OpenAI Whisper (if configured)</option>
              </select>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-lg text-red-300 flex items-start gap-2 text-[11px]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Result Text */}
          {resultText && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-emerald-400 font-medium">
                <span className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" />
                  Transcription Result:
                </span>
              </div>
              <div className="p-3 bg-[#131b2e] border border-[#1e2c47] rounded-lg max-h-36 overflow-y-auto text-neutral-200 leading-relaxed font-sans select-text">
                {resultText}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[#1e2c47] bg-[#0c1222]">
          <button
            onClick={handleClose}
            className="px-3.5 py-1.5 border border-[#1e2c47] hover:bg-[#162035] rounded-lg text-neutral-300 font-medium cursor-pointer"
          >
            Cancel
          </button>
          {resultText ? (
            <button
              onClick={handleInsertAndClose}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium cursor-pointer shadow-xs transition-colors"
            >
              Insert into Document
            </button>
          ) : (
            <button
              onClick={handleTranscribe}
              disabled={!file || isUploading}
              className="px-4 py-1.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-lg font-medium cursor-pointer shadow-xs transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {isUploading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isUploading ? 'Transcribing...' : 'Transcribe Audio'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
