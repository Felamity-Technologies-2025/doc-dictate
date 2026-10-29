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
  Eye,
  RefreshCw,
  Mic,
  ZoomIn,
  ZoomOut,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { PageLayoutConfig } from '../../types';
import type { TemplateFieldAttrs } from '../../utils/templateField';

interface TemplateControls {
  fieldsCount: number;
  activeField: TemplateFieldAttrs | null;
  isDictating: boolean;
  outOfSync: boolean;
  onApplyTemplateChanges: () => void;
}

interface RagsuiteEditorCardProps {
  editor: Editor | null;
  documentTitle: string;
  wordCount: number;
  charCount: number;
  layout: PageLayoutConfig;
  onUpdateZoom?: (zoom: number) => void;
  onClearDocument: () => void;
  onCopyText: () => void;
  onPreview: () => void;
  templateControls?: TemplateControls;
}

export const RagsuiteEditorCard: React.FC<RagsuiteEditorCardProps> = ({
  editor,
  documentTitle,
  wordCount,
  charCount,
  layout,
  onUpdateZoom,
  onClearDocument,
  onCopyText,
  onPreview,
  templateControls,
}) => {
  const [copied, setCopied] = useState(false);
  const [isPrintLayout, setIsPrintLayout] = useState(true);
  const [isDetailsBarVisible, setIsDetailsBarVisible] = useState(true);

  const handleCopy = () => {
    onCopyText();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const zoomScale = layout.zoom / 100;

  return (
    <div className="flex-1 h-full min-h-0 flex flex-col min-w-0 overflow-hidden relative">
      {/* RAGSUITE Main Content Card - Fixed height, never scrolls */}
      <div className="relative bg-[#131b2e] border border-[#1e2b42] rounded-xl shadow-xl flex flex-col h-full min-h-0 flex-1 overflow-hidden transition-all">
        {/* Document Details Bar (Top Bar) - Overlaps/pinned at top without scrolling, or hidden */}
        {isDetailsBarVisible ? (
          <div className="shrink-0 px-3 sm:px-5 py-2 sm:py-2.5 border-b border-[#1b263b] bg-[#111827]/90 backdrop-blur-md flex items-center justify-between gap-2 z-20 transition-all">
            {/* Left badge */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-6 h-6 shrink-0 rounded-md bg-[#1a2844] border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold text-white tracking-wide truncate">
                {documentTitle || 'Document Editor'}
              </span>
              <span className="text-[11px] text-[#7082a4] hidden sm:inline shrink-0 whitespace-nowrap">
                • {wordCount} words • {charCount} characters
              </span>
              {templateControls && (
                <>
                  <span className="text-[11px] text-[#7082a4] hidden md:inline shrink-0 whitespace-nowrap">
                    • {templateControls.fieldsCount} fields
                  </span>
                  <span
                    className={`flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full border min-w-0 shrink ${
                      templateControls.isDictating
                        ? 'text-red-300 border-red-500/40 bg-red-500/10'
                        : 'text-blue-300 border-blue-500/30 bg-blue-500/10'
                    }`}
                    title={
                      templateControls.activeField
                        ? `${templateControls.fieldsCount} fields • ${
                            templateControls.isDictating ? 'Dictating into' : 'Active field'
                          }: ${templateControls.activeField.heading}`
                        : `${templateControls.fieldsCount} fields • Click a field to start typing or dictating`
                    }
                  >
                    <Mic className="w-3 h-3 shrink-0" />
                    <span className="truncate">
                      {templateControls.activeField ? (
                        <>
                          <span className="hidden lg:inline">
                            {templateControls.isDictating ? 'Dictating into' : 'Active field'}:{' '}
                          </span>
                          <strong className="font-semibold">{templateControls.activeField.heading}</strong>
                        </>
                      ) : (
                        <>
                          <span className="hidden xl:inline">Click a field to start typing or dictating</span>
                          <span className="xl:hidden">No active field</span>
                        </>
                      )}
                    </span>
                  </span>
                </>
              )}
            </div>

            {/* Right Action Icons matching RAGSUITE Assistant card header */}
            <div className="flex items-center gap-1 shrink-0">
              {templateControls?.outOfSync && (
                <button
                  onClick={templateControls.onApplyTemplateChanges}
                  className="flex items-center gap-1 text-[11px] text-amber-300 border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-1 rounded-md cursor-pointer"
                  title="This document's fields differ from the template's current fields — apply template changes"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span className="hidden md:inline">Apply template changes</span>
                </button>
              )}
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

              {/* Preview the document as it will be downloaded (tables included) */}
              <button
                onClick={onPreview}
                className="px-2 py-1 rounded-md text-[11px] font-medium text-[#8da0bd] hover:text-white hover:bg-[#18233a] transition-colors cursor-pointer flex items-center gap-1.5"
                title="Preview the document structure before downloading"
              >
                <Eye className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Preview</span>
              </button>

              {/* Clear Document Button (Red trash icon matching RAGSUITE) */}
              <button
                onClick={onClearDocument}
                className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition-colors cursor-pointer"
                title="Clear Document"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              {/* Hide / Collapse Top Details Bar */}
              <button
                onClick={() => setIsDetailsBarVisible(false)}
                className="p-1.5 text-[#7082a4] hover:text-white hover:bg-[#18233a] rounded-lg transition-colors cursor-pointer ml-0.5"
                title="Hide details bar (Focus mode)"
                aria-label="Hide details bar"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          /* Subtle floating pill when details bar is hidden */
          <button
            onClick={() => setIsDetailsBarVisible(true)}
            className="absolute top-2.5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 bg-[#111827]/90 hover:bg-[#162238] text-neutral-300 hover:text-white border border-[#23334d] px-3 py-1 rounded-full text-xs shadow-xl backdrop-blur-md cursor-pointer transition-all animate-in fade-in slide-in-from-top-2 duration-200"
            title="Show document details bar"
          >
            <Bot className="w-3.5 h-3.5 text-blue-400" />
            <span className="truncate max-w-[180px] font-medium">{documentTitle || 'Document'}</span>
            <span className="text-[10px] text-[#7082a4]">({wordCount}w)</span>
            <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
          </button>
        )}

        {/* Content Writing Card - ONLY THIS SCROLLS */}
        <div
          className={`flex-1 min-h-0 p-3 sm:p-6 md:p-8 transition-colors overflow-auto ${
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
              transform: `scale(${zoomScale})`,
              transformOrigin: 'top center',
              marginBottom: zoomScale > 1 ? `${Math.round((zoomScale - 1) * 750)}px` : undefined,
            }}
            className={
              isPrintLayout
                ? 'paper-page w-[794px] max-w-full min-h-[60vh] sm:min-h-[900px] bg-white text-neutral-900 p-5 sm:p-10 md:p-12 shadow-2xl rounded-xs transition-transform duration-100'
                : 'w-full max-w-4xl mx-auto transition-transform duration-100'
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

        {/* Floating Zoom Controls at the bottom right corner of document view */}
        <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 z-20 flex items-center gap-1 sm:gap-1.5 bg-[#0e1627]/90 hover:bg-[#0e1627] backdrop-blur-md border border-[#23334d] px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg shadow-2xl text-neutral-200 select-none transition-all">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onUpdateZoom?.(Math.max(50, layout.zoom - 10));
              }}
              disabled={layout.zoom <= 50}
              className="p-1 hover:text-white hover:bg-[#1a2842] rounded-md cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Zoom Out"
              aria-label="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            <input
              type="range"
              min="50"
              max="200"
              step="10"
              value={layout.zoom}
              onChange={(e) => {
                e.stopPropagation();
                onUpdateZoom?.(Number(e.target.value));
              }}
              className="w-14 sm:w-20 h-1 bg-[#23334d] rounded-lg appearance-none cursor-pointer accent-blue-500 hidden sm:inline-block"
              title={`Zoom: ${layout.zoom}%`}
              aria-label="Zoom percentage slider"
            />

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onUpdateZoom?.(100);
              }}
              className="text-[11px] font-mono font-medium px-1.5 py-0.5 rounded hover:bg-[#1a2842] hover:text-white cursor-pointer transition-colors min-w-[42px] text-center"
              title="Click to reset zoom to 100%"
            >
              {layout.zoom}%
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onUpdateZoom?.(Math.min(200, layout.zoom + 10));
              }}
              disabled={layout.zoom >= 200}
              className="p-1 hover:text-white hover:bg-[#1a2842] rounded-md cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Zoom In"
              aria-label="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
        </div>
      </div>
    </div>
  );
};
