import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  FilePlus2,
  FileText,
  LayoutTemplate,
  Loader2,
  Pencil,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { ApiService } from '../../services/api';
import { TemplateModel, TemplateSummary } from '../../types';

interface TemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Start a new document from the template */
  onOpenTemplate: (template: TemplateModel) => void;
  /** Called after a template is renamed or deleted so the open document can react */
  onTemplateRenamed?: (template: TemplateModel) => void;
  onTemplateDeleted?: (templateId: string) => void;
  activeTemplateId: string | null;
  llmConfigured?: boolean;
  maxUploadMb?: number;
}

type UploadStage = 'idle' | 'uploading' | 'processing' | 'done' | 'error';

const METHOD_LABELS: Record<string, string> = {
  text: 'text layer',
  vision: 'scanned pages read by vision model',
  'text+vision': 'text layer + scanned pages read by vision model',
};

const TYPE_LABELS: Record<string, string> = { field: 'Field', section: 'Section', paragraph: 'Paragraph' };

export const TemplatesModal: React.FC<TemplatesModalProps> = ({
  isOpen,
  onClose,
  onOpenTemplate,
  onTemplateRenamed,
  onTemplateDeleted,
  activeTemplateId,
  llmConfigured,
  maxUploadMb = 10,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [nameOverride, setNameOverride] = useState('');
  const [stage, setStage] = useState<UploadStage>('idle');
  const [progress, setProgress] = useState(0);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, TemplateModel | 'loading'>>({});
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const loadTemplates = async () => {
    setIsLoading(true);
    setListError(null);
    try {
      setTemplates(await ApiService.listTemplates());
    } catch (err) {
      setListError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
      setExpanded({});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isBusyUploading = stage === 'uploading' || stage === 'processing';

  const handleFileChosen = (chosen: File | null) => {
    setUploadMessage(null);
    setStage('idle');
    setProgress(0);
    if (!chosen) return;
    if (!chosen.name.toLowerCase().endsWith('.pdf') && chosen.type !== 'application/pdf') {
      setFile(null);
      setStage('error');
      setUploadMessage('Please choose a PDF file.');
      return;
    }
    if (chosen.size > maxUploadMb * 1024 * 1024) {
      setFile(null);
      setStage('error');
      setUploadMessage(`The PDF is larger than the ${maxUploadMb} MB limit.`);
      return;
    }
    setFile(chosen);
  };

  const handleUpload = async () => {
    if (!file) return;
    setStage('uploading');
    setProgress(0);
    setUploadMessage(null);
    try {
      const result = await ApiService.uploadTemplate(
        file,
        (percent) => {
          setProgress(percent);
          if (percent >= 100) setStage('processing');
        },
        nameOverride
      );
      setStage('done');
      const method = METHOD_LABELS[result.extraction.method] || result.extraction.method;
      setUploadMessage(
        `Saved "${result.template.template_name}" with ${result.template.fields.length} heading(s), extracted from ${result.extraction.page_count} page(s) using the ${method}.`
      );
      setHighlightId(result.template.id);
      setExpanded((prev) => ({ ...prev, [result.template.id]: result.template }));
      setFile(null);
      setNameOverride('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadTemplates();
    } catch (err) {
      setStage('error');
      setUploadMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const toggleExpanded = async (id: string) => {
    if (expanded[id]) {
      setExpanded((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }
    setExpanded((prev) => ({ ...prev, [id]: 'loading' }));
    try {
      const template = await ApiService.getTemplate(id);
      setExpanded((prev) => ({ ...prev, [id]: template }));
    } catch (err) {
      setListError(err instanceof Error ? err.message : String(err));
      setExpanded((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const handleOpen = async (id: string) => {
    setBusyId(id);
    try {
      const template = await ApiService.getTemplate(id);
      onOpenTemplate(template);
      onClose();
    } catch (err) {
      setListError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  const handleRename = async (id: string) => {
    const name = renameValue.trim();
    if (!name) return;
    setBusyId(id);
    try {
      const updated = await ApiService.renameTemplate(id, name);
      setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, template_name: updated.template_name } : t)));
      setExpanded((prev) => (prev[id] && prev[id] !== 'loading' ? { ...prev, [id]: updated } : prev));
      setRenamingId(null);
      onTemplateRenamed?.(updated);
    } catch (err) {
      setListError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (template: TemplateSummary) => {
    const docs = template.document_count;
    const docNote =
      docs > 0
        ? `\n\n${docs} saved document${docs === 1 ? ' was' : 's were'} created from it. ${docs === 1 ? 'It' : 'They'} will be kept with all content, but no longer linked to this template.`
        : '';
    if (!window.confirm(`Delete the template "${template.template_name}"?${docNote}`)) return;
    setBusyId(template.id);
    try {
      await ApiService.deleteTemplate(template.id);
      setTemplates((prev) => prev.filter((t) => t.id !== template.id));
      onTemplateDeleted?.(template.id);
    } catch (err) {
      setListError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-4">
      <div className="bg-[#0f172a] rounded-xl shadow-2xl border border-[#1e2c47] w-full max-w-2xl max-h-[calc(100dvh-1.5rem)] flex flex-col overflow-hidden animate-in fade-in duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1e2c47] bg-[#0c1222] shrink-0">
          <div className="flex items-center gap-2">
            <LayoutTemplate className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold text-white text-sm">Document Templates</h3>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white p-1 rounded-sm cursor-pointer" title="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Upload */}
          <section className="border border-[#1e2c47] rounded-lg bg-[#131b2e] p-3.5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  Create a template from a PDF
                </div>
                <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                  The LLM reads the PDF and keeps only its headings and field labels (From, To, Subject,
                  section titles...). Names, dates and other filled-in content are not saved.
                </p>
              </div>
            </div>

            {llmConfigured === false && (
              <div className="p-2.5 bg-amber-950/40 text-amber-300 border border-amber-800/50 rounded-lg text-[11px] flex gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  The LLM gateway is not configured on the backend (DJANGO_LLM_EMAIL / DJANGO_LLM_OTP in
                  Backend/.env). Uploads will fail until it is.
                </span>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => handleFileChosen(e.target.files?.[0] || null)}
            />

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isBusyUploading}
                className="px-3 py-1.5 bg-[#18233a] hover:bg-[#1f2d48] border border-[#23334d] text-white rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="w-3.5 h-3.5 text-blue-400" />
                Choose PDF
              </button>
              <span className="text-xs text-neutral-300 truncate max-w-[16rem]" title={file?.name}>
                {file ? `${file.name} (${(file.size / 1024).toFixed(0)} KB)` : `No file selected (max ${maxUploadMb} MB)`}
              </span>
            </div>

            {file && (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={nameOverride}
                  onChange={(e) => setNameOverride(e.target.value)}
                  placeholder="Template name (optional - suggested by the LLM)"
                  disabled={isBusyUploading}
                  className="flex-1 min-w-[12rem] bg-[#18233a] border border-[#23334d] focus:border-blue-500/60 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                />
                <button
                  onClick={handleUpload}
                  disabled={isBusyUploading}
                  className="px-3 py-1.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isBusyUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  Upload & Extract Headings
                </button>
              </div>
            )}

            {isBusyUploading && (
              <div className="space-y-1.5">
                <div className="h-1.5 bg-[#18233a] rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-blue-500 transition-all ${stage === 'processing' ? 'animate-pulse' : ''}`}
                    style={{ width: `${stage === 'processing' ? 100 : progress}%` }}
                  />
                </div>
                <div className="text-[11px] text-neutral-400 flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                  {stage === 'uploading'
                    ? `Uploading PDF... ${progress}%`
                    : 'Reading the PDF and extracting headings with the LLM (this can take up to a minute)...'}
                </div>
              </div>
            )}

            {uploadMessage && stage === 'done' && (
              <div className="p-2.5 bg-emerald-950/40 text-emerald-300 border border-emerald-800/50 rounded-lg text-[11px] flex gap-2">
                <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{uploadMessage}</span>
              </div>
            )}
            {uploadMessage && stage === 'error' && (
              <div className="p-2.5 bg-red-950/40 text-red-300 border border-red-800/50 rounded-lg text-[11px] flex gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{uploadMessage}</span>
              </div>
            )}
          </section>

          {/* Saved templates */}
          <section className="space-y-2">
            <div className="text-xs text-neutral-400">
              {templates.length} saved template{templates.length !== 1 ? 's' : ''}
            </div>

            {listError && (
              <div className="p-2.5 bg-red-950/40 text-red-300 border border-red-800/50 rounded-lg text-[11px] flex items-start justify-between gap-2">
                <span>{listError}</span>
                <button onClick={() => setListError(null)} className="text-red-400 hover:text-white cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {isLoading && templates.length === 0 ? (
              <div className="py-10 flex flex-col items-center justify-center text-neutral-400 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                <span className="text-xs">Loading templates...</span>
              </div>
            ) : templates.length === 0 ? (
              <div className="py-8 text-center text-neutral-400 text-xs">
                No templates yet. Upload a PDF to create your first reusable template.
              </div>
            ) : (
              <div className="divide-y divide-[#1e2c47] border border-[#1e2c47] rounded-lg bg-[#131b2e]">
                {templates.map((template) => {
                  const details = expanded[template.id];
                  const isActive = template.id === activeTemplateId;
                  const isBusy = busyId === template.id;
                  return (
                    <div
                      key={template.id}
                      className={`${highlightId === template.id ? 'bg-blue-950/20' : ''} ${
                        isActive ? 'border-l-2 border-l-blue-500' : ''
                      }`}
                    >
                      <div className="p-3 flex items-center justify-between gap-2">
                        <button
                          onClick={() => toggleExpanded(template.id)}
                          className="flex items-start gap-2 min-w-0 text-left cursor-pointer flex-1"
                          title="View headings"
                        >
                          {details ? (
                            <ChevronDown className="w-3.5 h-3.5 text-neutral-400 mt-0.5 shrink-0" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-neutral-400 mt-0.5 shrink-0" />
                          )}
                          <FileText className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            {renamingId === template.id ? null : (
                              <div className="text-xs text-white font-medium truncate flex items-center gap-2">
                                <span className="truncate">{template.template_name}</span>
                                {isActive && (
                                  <span className="text-[10px] text-blue-400 bg-blue-950/60 px-1.5 rounded-full border border-blue-500/30 shrink-0">
                                    In use
                                  </span>
                                )}
                              </div>
                            )}
                            <div className="text-[11px] text-neutral-400 mt-0.5 truncate">
                              {template.field_count} heading{template.field_count !== 1 ? 's' : ''}
                              {template.custom_field_count > 0 && ` (${template.custom_field_count} custom)`}
                              {' • '}
                              {template.document_count} document{template.document_count !== 1 ? 's' : ''}
                              {template.original_filename && ` • ${template.original_filename}`}
                            </div>
                          </div>
                        </button>

                        {renamingId === template.id && (
                          <div className="flex items-center gap-1 flex-1">
                            <input
                              autoFocus
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRename(template.id);
                                if (e.key === 'Escape') setRenamingId(null);
                              }}
                              className="flex-1 min-w-0 bg-[#18233a] border border-[#23334d] focus:border-blue-500/60 rounded-md px-2 py-1 text-xs text-white focus:outline-none"
                            />
                            <button
                              onClick={() => handleRename(template.id)}
                              disabled={!renameValue.trim() || isBusy}
                              className="p-1.5 text-emerald-400 hover:bg-emerald-500/20 rounded-md cursor-pointer disabled:opacity-40"
                              title="Save name"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setRenamingId(null)}
                              className="p-1.5 text-neutral-400 hover:text-white rounded-md cursor-pointer"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        {renamingId !== template.id && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleOpen(template.id)}
                              disabled={isBusy}
                              className="px-2.5 py-1 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-md text-[11px] font-medium flex items-center gap-1 cursor-pointer disabled:opacity-60"
                              title="Create a new document from this template"
                            >
                              {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <FilePlus2 className="w-3 h-3" />}
                              Open
                            </button>
                            <button
                              onClick={() => {
                                setRenamingId(template.id);
                                setRenameValue(template.template_name);
                              }}
                              className="p-1.5 text-neutral-400 hover:text-white hover:bg-[#1a2842] rounded-md cursor-pointer"
                              title="Rename template"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(template)}
                              disabled={isBusy}
                              className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-red-500/20 rounded-md cursor-pointer disabled:opacity-40"
                              title="Delete template"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {details && (
                        <div className="px-3 pb-3 pl-10">
                          {details === 'loading' ? (
                            <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                          ) : (
                            <ol className="border border-[#1e2c47] rounded-md bg-[#0f1626] divide-y divide-[#1a2540]">
                              {details.fields.map((field) => (
                                <li
                                  key={field.id}
                                  className="px-2.5 py-1.5 flex items-center justify-between gap-2 text-[11px]"
                                  style={{ paddingLeft: `${0.625 + (field.level - 1) * 1}rem` }}
                                >
                                  <span className="text-neutral-200 truncate">
                                    <span className="text-neutral-500 mr-1.5">{field.field_order}.</span>
                                    {field.heading}
                                  </span>
                                  <span className="flex items-center gap-1 shrink-0">
                                    {field.is_custom && (
                                      <span className="text-[9px] uppercase tracking-wide text-emerald-400 border border-emerald-500/40 rounded-full px-1.5">
                                        Custom
                                      </span>
                                    )}
                                    <span className="text-[10px] text-neutral-500">{TYPE_LABELS[field.field_type]}</span>
                                  </span>
                                </li>
                              ))}
                            </ol>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
