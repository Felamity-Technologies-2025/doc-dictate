import React, { useState } from 'react';
import { ChevronDown, Download, LayoutTemplate, ListPlus, Loader2, Mic, Plus, RefreshCw, Settings2 } from 'lucide-react';
import { ExportFormat, TemplateModel } from '../../types';
import type { TemplateFieldAttrs } from '../../utils/templateField';

interface TemplateBarProps {
  template: TemplateModel;
  activeField: TemplateFieldAttrs | null;
  isDictating: boolean;
  onAddField: () => void;
  onManageFields: () => void;
  onExport: (format: ExportFormat) => void;
  exportingFormat: ExportFormat | null;
  /** The open document's fields differ from the template's current definition */
  outOfSync: boolean;
  onApplyTemplateChanges: () => void;
}

/** Shown above the editor while a document created from a template is open */
export const TemplateBar: React.FC<TemplateBarProps> = ({
  template,
  activeField,
  isDictating,
  onAddField,
  onManageFields,
  onExport,
  exportingFormat,
  outOfSync,
  onApplyTemplateChanges,
}) => {
  const [exportOpen, setExportOpen] = useState(false);

  return (
    <div className="bg-[#121929] border border-[#1e2c47] rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-300 select-none shrink-0">
      <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
        <span className="flex items-center gap-1.5 font-semibold text-white min-w-0">
          <LayoutTemplate className="w-4 h-4 text-blue-400 shrink-0" />
          <span className="truncate max-w-[10rem] sm:max-w-[14rem]" title={template.template_name}>
            {template.template_name}
          </span>
        </span>
        <span className="text-[11px] text-[#7082a4]">{template.fields.length} fields</span>
        <span
          className={`flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full border min-w-0 max-w-full ${
            isDictating
              ? 'text-red-300 border-red-500/40 bg-red-500/10'
              : 'text-blue-300 border-blue-500/30 bg-blue-500/10'
          }`}
          title="Typing and dictation are inserted into this field. Click a field or press Tab / Shift+Tab to move."
        >
          <Mic className="w-3 h-3 shrink-0" />
          {activeField ? (
            <>
              {isDictating ? 'Dictating into' : 'Active field'}:{' '}
              <strong className="font-semibold truncate max-w-[12rem]">{activeField.heading}</strong>
            </>
          ) : (
            'Click a field to start typing or dictating'
          )}
        </span>
        {outOfSync && (
          <button
            onClick={onApplyTemplateChanges}
            className="flex items-center gap-1 text-[11px] text-amber-300 border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded-full cursor-pointer"
            title="This document's fields differ from the template's current fields"
          >
            <RefreshCw className="w-3 h-3" />
            Apply template changes
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5 ml-auto">
        <button
          onClick={onAddField}
          className="px-2.5 py-1.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer"
          title="Add your own field to this template"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Add Custom Field</span>
          <span className="sm:hidden">Field</span>
        </button>
        <button
          onClick={onManageFields}
          className="px-2.5 py-1.5 bg-[#18233a] hover:bg-[#1f2d48] border border-[#23334d] text-white rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer"
          title="Rename, reorder or remove fields"
        >
          <Settings2 className="w-3.5 h-3.5 text-neutral-400" />
          <span className="hidden sm:inline">Manage Fields</span>
          <ListPlus className="w-3.5 h-3.5 text-neutral-400 sm:hidden" />
        </button>
        <div className="relative">
          <button
            onClick={() => setExportOpen(!exportOpen)}
            disabled={!!exportingFormat}
            className="px-2.5 py-1.5 bg-[#18233a] hover:bg-[#1f2d48] border border-[#23334d] text-white rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            title="Download the completed document"
          >
            {exportingFormat ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
            ) : (
              <Download className="w-3.5 h-3.5 text-blue-400" />
            )}
            <span className="hidden sm:inline">Download</span>
            <ChevronDown className="w-3 h-3 text-neutral-400" />
          </button>
          {exportOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setExportOpen(false)} />
              <div className="absolute right-0 top-full mt-1.5 w-44 bg-[#121929] border border-[#23334d] rounded-lg shadow-2xl py-1.5 z-40 text-xs text-neutral-200">
                {(['docx', 'pdf'] as ExportFormat[]).map((format) => (
                  <button
                    key={format}
                    onClick={() => {
                      setExportOpen(false);
                      onExport(format);
                    }}
                    className="w-full px-3 py-2 flex items-center gap-2 hover:bg-[#1a2842] text-left"
                  >
                    <Download className="w-3.5 h-3.5 text-neutral-400" />
                    Download as {format.toUpperCase()}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
