import React, { useState } from 'react';
import { EditorContent, type Editor } from '@tiptap/react';
import {
  Bot,
  Trash2,
  Edit2,
  Copy,
  Check,
  FileText,
  Maximize2,
  Minimize2,
  Layers,
} from 'lucide-react';
import { PageLayoutConfig } from '../../types';

interface RagsuiteEditorCardProps {
  editor: Editor | null;
  documentTitle: string;
  wordCount: number;
  charCount: number;
  layout: PageLayoutConfig;
  onClearDocument: () => void;
  onCopyText: () => void;
}

export const RagsuiteEditorCard: React.FC<RagsuiteEditorCardProps> = ({
  editor,
  documentTitle,
  wordCount,
  charCount,
  layout,
  onClearDocument,
  onCopyText,
}) => {
  const [copied, setCopied] = useState(false);
  const [isPrintLayout, setIsPrintLayout] = useState(true);

  const handleCopy = () => {
    onCopyText();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const zoomScale = layout.zoom / 100;

  return (
    <div className="flex-1 min-h-[24rem] flex flex-col min-w-0 overflow-y-auto sm:px-1 pb-2 sm:pb-4">
      {/* RAGSUITE Main Content Card */}
      <div className="bg-[#131b2e] border border-[#1e2b42] rounded-xl shadow-xl flex flex-col min-h-[420px] sm:min-h-[560px] shrink-0 overflow-hidden transition-all">
        {/* Card Header matching RAGSUITE card top row */}
        <div className="px-3 sm:px-5 py-2.5 sm:py-3 border-b border-[#1b263b] bg-[#111827]/70 flex items-center justify-between gap-2">
          {/* Left badge */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 shrink-0 rounded-md bg-[#1a2844] border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-semibold text-white tracking-wide truncate">
              {documentTitle || 'Document Editor'}
            </span>
            <span className="text-[11px] text-[#7082a4] hidden sm:inline shrink-0">
              • {wordCount} words • {charCount} characters
            </span>
          </div>

          {/* Right Action Icons matching RAGSUITE Assistant card header */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Toggle Print vs Dark Card View */}
            <button
              onClick={() => setIsPrintLayout(!isPrintLayout)}
              className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                isPrintLayout
                  ? 'bg-blue-600 text-white'
                  : 'text-[#8da0bd] hover:text-white hover:bg-[#18233a]'
              }`}
              title="Toggle Print Sheet vs Dark Mode"
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{isPrintLayout ? 'Print View' : 'Dark Mode'}</span>
            </button>

            {/* Copy Button */}
            <button
              onClick={handleCopy}
              className="p-1.5 text-[#8da0bd] hover:text-white hover:bg-[#1a2844] rounded-lg transition-colors cursor-pointer"
              title="Copy text"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            {/* Clear Document Button (Red trash icon matching RAGSUITE) */}
            <button
              onClick={onClearDocument}
              className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition-colors cursor-pointer"
              title="Clear Document"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Card Body / Editor Canvas */}
        <div
          className={`flex-1 p-3 sm:p-6 md:p-8 transition-colors ${
            isPrintLayout ? 'bg-neutral-200 flex justify-center py-3 sm:py-6 md:py-8' : 'bg-[#131b2e]'
          }`}
          onClick={() => {
            if (editor && !editor.isFocused) {
              editor.chain().focus().run();
            }
          }}
        >
          <div
            style={{
              transform: isPrintLayout ? `scale(${zoomScale})` : 'none',
              transformOrigin: 'top center',
            }}
            className={
              isPrintLayout
                ? 'paper-page w-[794px] max-w-full min-h-[60vh] sm:min-h-[900px] bg-white text-neutral-900 p-5 sm:p-10 md:p-12 shadow-2xl rounded-xs'
                : 'w-full'
            }
          >
            <EditorContent
              editor={editor}
              className={`focus:outline-none min-h-[320px] sm:min-h-[460px] ${
                isPrintLayout ? 'text-neutral-900' : 'text-neutral-100'
              }`}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
