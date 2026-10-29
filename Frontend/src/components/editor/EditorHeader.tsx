import React, { useState } from 'react';
import type { Editor } from '@tiptap/react';
import {
  FileText,
  Save,
  Undo2,
  Redo2,
  FolderOpen,
  Share2,
  Check,
  CloudCheck,
  CloudUpload,
  AlertCircle,
  Download,
  Copy,
} from 'lucide-react';
import { Tooltip } from '../common/Tooltip';

interface EditorHeaderProps {
  title: string;
  onUpdateTitle: (newTitle: string) => void;
  saveStatus: 'saved' | 'saving' | 'unsaved' | 'failed';
  onManualSave: () => void;
  onOpenDocumentsModal: () => void;
  editor: Editor | null;
}

export const EditorHeader: React.FC<EditorHeaderProps> = ({
  title,
  onUpdateTitle,
  saveStatus,
  onManualSave,
  onOpenDocumentsModal,
  editor,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

  const handleCopyText = () => {
    if (!editor) return;
    const text = editor.getText();
    navigator.clipboard?.writeText(text);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const handleDownloadTxt = () => {
    if (!editor) return;
    const text = editor.getText();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'Document'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setShareMenuOpen(false);
  };

  const handleDownloadHtml = () => {
    if (!editor) return;
    const html = editor.getHTML();
    const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:Calibri,sans-serif;margin:40px;line-height:1.6;}</style></head><body>${html}</body></html>`;
    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'Document'}.html`;
    a.click();
    URL.revokeObjectURL(url);
    setShareMenuOpen(false);
  };

  return (
    <div className="bg-[#2b579a] text-white px-3 py-1.5 flex items-center justify-between select-none shadow-xs shrink-0">
      {/* Left: App Logo, Quick Access Toolbar & Title */}
      <div className="flex items-center gap-3">
        {/* Microsoft Word styled logo */}
        <div className="flex items-center gap-1.5 font-bold tracking-tight text-white cursor-pointer hover:opacity-90">
          <div className="w-6 h-6 bg-blue-700 border border-blue-400 rounded-sm flex items-center justify-center shadow-xs">
            <span className="text-white font-serif font-black text-xs">W</span>
          </div>
          <span className="text-xs font-semibold hidden sm:inline">Word</span>
        </div>

        {/* Quick Access Toolbar */}
        <div className="flex items-center gap-0.5 border-l border-blue-400/40 pl-2">
          <Tooltip content="Save Document (SQLite)" shortcut="Ctrl+S">
            <button
              onClick={onManualSave}
              className="p-1 rounded hover:bg-blue-600/70 text-blue-100 hover:text-white cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
            </button>
          </Tooltip>

          <Tooltip content="Undo" shortcut="Ctrl+Z">
            <button
              onClick={() => editor?.chain().focus().undo().run()}
              disabled={!editor?.can().undo()}
              className="p-1 rounded hover:bg-blue-600/70 text-blue-100 hover:text-white disabled:opacity-40 cursor-pointer"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
          </Tooltip>

          <Tooltip content="Redo" shortcut="Ctrl+Y">
            <button
              onClick={() => editor?.chain().focus().redo().run()}
              disabled={!editor?.can().redo()}
              className="p-1 rounded hover:bg-blue-600/70 text-blue-100 hover:text-white disabled:opacity-40 cursor-pointer"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </Tooltip>

          <Tooltip content="Open Saved Documents (SQLite)">
            <button
              onClick={onOpenDocumentsModal}
              className="p-1 rounded hover:bg-blue-600/70 text-blue-100 hover:text-white cursor-pointer ml-1"
            >
              <FolderOpen className="w-3.5 h-3.5" />
            </button>
          </Tooltip>

        </div>

        {/* Document Title Input */}
        <div className="flex items-center gap-2 border-l border-blue-400/40 pl-2">
          <input
            type="text"
            value={title}
            onChange={(e) => onUpdateTitle(e.target.value)}
            className="bg-transparent hover:bg-blue-700/60 focus:bg-blue-700/80 px-2 py-0.5 rounded text-xs font-semibold text-white focus:outline-none focus:ring-1 focus:ring-white/50 w-36 sm:w-56 truncate"
            title="Click to rename document"
          />

          {/* Auto-save Status Indicator */}
          <div className="flex items-center gap-1 text-[11px] text-blue-100">
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1 text-blue-100 opacity-90">
                <Check className="w-3 h-3 text-emerald-300" />
                <span className="hidden md:inline">Saved to SQLite</span>
              </span>
            )}
            {saveStatus === 'saving' && (
              <span className="flex items-center gap-1 text-blue-200 animate-pulse">
                <CloudUpload className="w-3 h-3" />
                <span className="hidden md:inline">Saving...</span>
              </span>
            )}
            {saveStatus === 'unsaved' && (
              <span className="flex items-center gap-1 text-blue-200">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                <span className="hidden md:inline">Unsaved changes</span>
              </span>
            )}
            {saveStatus === 'failed' && (
              <span className="flex items-center gap-1 text-red-200">
                <AlertCircle className="w-3 h-3 text-red-300" />
                <span className="hidden md:inline">Save failed</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right: Share / Export Menu & Profile */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <button
            onClick={() => setShareMenuOpen(!shareMenuOpen)}
            className="flex items-center gap-1.5 bg-blue-600/80 hover:bg-blue-600 px-2.5 py-1 rounded text-xs font-medium text-white transition-colors cursor-pointer border border-blue-400/40 shadow-xs"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share & Export</span>
          </button>

          {shareMenuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShareMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1.5 w-48 bg-white text-neutral-800 rounded-md shadow-xl border border-neutral-200 py-1.5 z-40 text-xs">
                <button
                  onClick={handleCopyText}
                  className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-neutral-100 transition-colors text-left"
                >
                  <Copy className="w-3.5 h-3.5 text-neutral-500" />
                  <span>{copyFeedback ? 'Copied!' : 'Copy Document Text'}</span>
                </button>
                <button
                  onClick={handleDownloadTxt}
                  className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-neutral-100 transition-colors text-left"
                >
                  <Download className="w-3.5 h-3.5 text-neutral-500" />
                  <span>Download Plain Text (.txt)</span>
                </button>
                <button
                  onClick={handleDownloadHtml}
                  className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-neutral-100 transition-colors text-left"
                >
                  <Download className="w-3.5 h-3.5 text-neutral-500" />
                  <span>Download Web Document (.html)</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* User profile avatar placeholder */}
        <div className="w-6 h-6 rounded-full bg-blue-800 border border-blue-400/50 flex items-center justify-center text-[10px] font-bold text-white shadow-xs">
          GM
        </div>
      </div>
    </div>
  );
};
