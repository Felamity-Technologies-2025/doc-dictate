import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import type { JSONContent } from '@tiptap/core';
import { FontStyle, LineHeight, Subscript, Superscript } from './utils/editorExtensions';
import {
  TemplateFieldNode,
  TemplateTableNode,
  TemplateTableRowNode,
  TemplateTableCellNode,
  TemplatePageNode,
  TemplateImageNode,
  buildTemplateDocument,
  clearTemplateFields,
  documentMatchesTemplate,
  fieldHasContent,
  fieldsWithContentMissingFrom,
  getActiveTemplateField,
  isTemplateDocument,
  syncTemplateDocument,
} from './utils/templateField';

import { RagsuiteTopBar } from './components/ragsuite/RagsuiteTopBar';
import { RagsuiteToolbar } from './components/ragsuite/RagsuiteToolbar';
import { RagsuiteEditorCard } from './components/ragsuite/RagsuiteEditorCard';

import { DictationOverlayBadge } from './components/dictation/DictationOverlayBadge';
import { DictationSettingsModal } from './components/dictation/DictationSettingsModal';
import { AudioFileUploadModal } from './components/dictation/AudioFileUploadModal';
import { DocumentsModal } from './components/layout/DocumentsModal';
import { PreviewModal } from './components/editor/PreviewModal';
import { TableDialog } from './components/editor/TableDialog';
import { FindReplaceModal } from './components/editor/FindReplaceModal';
import { TemplatesModal } from './components/templates/TemplatesModal';
import { TemplateFieldsModal } from './components/templates/TemplateFieldsModal';

import { useDictation } from './hooks/useDictation';
import { ApiService } from './services/api';
import { PageLayoutConfig, DocumentModel, BackendHealth, ExportFormat, TemplateModel } from './types';
import { AlertTriangle, X } from 'lucide-react';

export default function App() {
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [documentTitle, setDocumentTitle] = useState<string>('Untitled document');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | 'failed'>('saved');
  const [wordCount, setWordCount] = useState<number>(0);
  const [charCount, setCharCount] = useState<number>(0);
  const [backendHealth, setBackendHealth] = useState<BackendHealth | null>(null);

  // Layout configuration
  const [layout, setLayout] = useState<PageLayoutConfig>({
    size: 'letter',
    orientation: 'portrait',
    margins: 'normal',
    zoom: 100,
  });

  // Modal dialog states
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isDocsModalOpen, setIsDocsModalOpen] = useState(false);
  const [isTableDialogOpen, setIsTableDialogOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isFindReplaceOpen, setIsFindReplaceOpen] = useState(false);
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false);
  const [fieldsModal, setFieldsModal] = useState<{ open: boolean; focusAdd: boolean }>({
    open: false,
    focusAdd: false,
  });

  // Template the open document was created from (null for plain documents)
  const [activeTemplate, setActiveTemplate] = useState<TemplateModel | null>(null);
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Autosave timer reference
  const autosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The document that saves write to. Read through a ref so autosave timers and editor
  // callbacks never write one document's content into another after switching documents.
  const docRef = useRef<{ id: string | null; title: string; templateId: string | null }>({
    id: null,
    title: 'Untitled document',
    templateId: null,
  });
  // Saves run one at a time so the first save's created id is used by the next (no duplicates)
  const saveQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const saveRef = useRef<() => Promise<string | null>>(async () => null);

  // Initialize Tiptap Rich-Text Editor
  const editor = useEditor({
    // Keep toolbar state (active marks, font, size, undo/redo availability) in sync
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TextStyle,
      FontStyle,
      LineHeight,
      Subscript,
      Superscript,
      Color,
      Highlight.configure({
        multicolor: true,
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Link.configure({
        openOnClick: false,
      }),
      Image.configure({
        inline: true,
      }),
      TemplateTableNode,
      TemplateTableRowNode,
      TemplateTableCellNode,
      TemplatePageNode,
      TemplateImageNode,
      TemplateFieldNode,
    ],
    content: '<p></p>',
    onUpdate: ({ editor: ed }) => {
      const text = ed.getText();
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      setWordCount(words);
      setCharCount(text.length);
      setSaveStatus('unsaved');

      // Debounce autosave 1.5 seconds
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
      autosaveTimeoutRef.current = setTimeout(() => {
        autosaveTimeoutRef.current = null;
        saveRef.current();
      }, 1500);
    },
  });

  // Dictation Hook
  const {
    status: dictationStatus,
    settings: dictationSettings,
    setSettings: setDictationSettings,
    errorMessage: dictationError,
    setErrorMessage: setDictationError,
    interimText,
    audioLevel,
    toggleDictation,
    stopDictation,
  } = useDictation(editor);

  // Initial Health
  useEffect(() => {
    ApiService.checkHealth().then((health) => {
      setBackendHealth(health);
    });
  }, []);

  // Update initial word counts
  useEffect(() => {
    if (editor) {
      const text = editor.getText();
      setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0);
      setCharCount(text.length);
    }
  }, [editor]);

  // Save document to SQLite persistence. Resolves with the saved document id (null on failure).
  const saveDocumentToBackend = useCallback((): Promise<string | null> => {
    if (!editor) return Promise.resolve(null);
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
      autosaveTimeoutRef.current = null;
    }

    const run = async (): Promise<string | null> => {
      const target = docRef.current;
      setSaveStatus('saving');

      const content = editor.getHTML();
      const textContent = editor.getText();
      const words = textContent.trim() ? textContent.trim().split(/\s+/).length : 0;
      const payload = { title: target.title, content, text_content: textContent, word_count: words };

      try {
        if (target.id) {
          await ApiService.updateDocument(target.id, payload);
        } else {
          const created = target.templateId
            ? await ApiService.createDocumentFromTemplate(target.templateId, payload)
            : await ApiService.createDocument(payload);
          target.id = created.id;
          if (docRef.current === target) setDocumentId(created.id);
        }
        if (docRef.current === target) setSaveStatus('saved');
        return target.id;
      } catch {
        if (docRef.current === target) setSaveStatus('failed');
        return null;
      }
    };

    const next = saveQueueRef.current.then(run, run);
    saveQueueRef.current = next.catch(() => null);
    return next;
  }, [editor]);
  saveRef.current = saveDocumentToBackend;

  const updateCounts = useCallback(() => {
    if (!editor) return;
    const text = editor.getText();
    setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0);
    setCharCount(text.length);
  }, [editor]);

  /**
   * Replace the open document. Pending edits of the current document are saved first,
   * and loading the new content does not trigger an autosave.
   */
  const switchDocument = useCallback(
    async (next: {
      id: string | null;
      title: string;
      templateId: string | null;
      template: TemplateModel | null;
      content: string | JSONContent;
    }) => {
      if (!editor) return;
      if (autosaveTimeoutRef.current) {
        await saveDocumentToBackend();
      } else {
        await saveQueueRef.current;
      }
      docRef.current = { id: next.id, title: next.title, templateId: next.templateId };
      setDocumentId(next.id);
      setDocumentTitle(next.title);
      setActiveTemplate(next.template);
      editor.commands.setContent(next.content, { emitUpdate: false });
      updateCounts();
      setSaveStatus(next.id ? 'saved' : 'unsaved');
    },
    [editor, saveDocumentToBackend, updateCounts]
  );

  // Load existing document from SQLite (the list endpoint has no content, so fetch the full record)
  const handleSelectDocument = async (doc: DocumentModel) => {
    try {
      const full = await ApiService.getDocument(doc.id);
      const template = full.template_id
        ? await ApiService.getTemplate(full.template_id).catch(() => null)
        : null;
      await switchDocument({
        id: full.id,
        title: full.title,
        templateId: full.template_id ?? null,
        template,
        content: full.content || '<p></p>',
      });
    } catch (err) {
      setNotice(`Could not open the document: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Create clean new document
  const handleNewDocument = () => {
    switchDocument({
      id: null,
      title: 'Untitled document',
      templateId: null,
      template: null,
      content: '<p></p>',
    });
  };

  // Start a new document from a saved template: its headings with empty content areas
  const handleOpenTemplate = async (template: TemplateModel) => {
    if (!editor) return;
    const date = new Date().toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
    await switchDocument({
      id: null,
      title: `${template.template_name} - ${date}`,
      templateId: template.id,
      template,
      content: buildTemplateDocument(template.fields, template),
    });
    if (template.fields.length) {
      editor.chain().focus().focusTemplateField(template.fields[0].id, 'start').run();
    }
  };

  // Field definitions changed (add / rename / reorder / remove): update the open document to match
  const handleTemplateFieldsChanged = (updated: TemplateModel) => {
    setActiveTemplate(updated);
    if (editor && docRef.current.templateId === updated.id) {
      syncTemplateDocument(editor, updated.fields, updated);
    }
  };

  const handleApplyTemplateChanges = () => {
    if (!editor || !activeTemplate) return;
    const lost = fieldsWithContentMissingFrom(editor, activeTemplate.fields);
    if (
      lost.length &&
      !window.confirm(
        `These fields are no longer in the template and their text will be removed from this document:\n\n${lost.join(
          '\n'
        )}\n\nContinue?`
      )
    ) {
      return;
    }
    syncTemplateDocument(editor, activeTemplate.fields, activeTemplate);
  };

  const handleTemplateDeleted = (templateId: string) => {
    if (docRef.current.templateId === templateId) {
      // The document keeps its fields and content; it is simply no longer linked
      docRef.current.templateId = null;
      setActiveTemplate(null);
    }
  };

  // Generate DOCX / PDF on the backend from the saved document
  const handleExportDocument = async (format: ExportFormat) => {
    if (!editor) return;
    setExportingFormat(format);
    try {
      const id = await saveDocumentToBackend(); // export exactly what is on screen
      if (!id) throw new Error('The document could not be saved, so it cannot be exported.');
      await ApiService.exportDocument(id, format, docRef.current.title);
    } catch (err) {
      setNotice(`${format.toUpperCase()} export failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setExportingFormat(null);
    }
  };

  // Clear current document text
  const handleClearDocument = () => {
    if (!editor) return;
    if (isTemplateDocument(editor)) {
      if (window.confirm('Clear everything typed into the template fields? The headings are kept.')) {
        clearTemplateFields(editor);
      }
      return;
    }
    if (window.confirm('Clear all content in the current document?')) {
      editor.commands.setContent('<p></p>');
      setWordCount(0);
      setCharCount(0);
      setSaveStatus('unsaved');
    }
  };

  // Copy document text
  const handleCopyDocumentText = () => {
    if (!editor) return;
    const text = editor.getText();
    navigator.clipboard?.writeText(text);
  };

  // Keyboard shortcut listener (Ctrl+S for save, Ctrl+F for find)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveDocumentToBackend();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setIsFindReplaceOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveDocumentToBackend]);

  return (
    <div className="flex flex-col h-dvh w-full overflow-hidden bg-[#070a12] text-neutral-200 font-sans select-none">
      {/* Main Application Area - Full Available Width */}
      <main className="flex-1 flex flex-col w-full min-w-0 bg-[#090d16] overflow-hidden">
        {/* Top Bar with AI Model Selector, File Viewer, New Document, and Save */}
        <RagsuiteTopBar
          documentTitle={documentTitle}
          onUpdateTitle={(title) => {
            docRef.current.title = title;
            setDocumentTitle(title);
            setSaveStatus('unsaved');
          }}
          saveStatus={saveStatus}
          onManualSave={saveDocumentToBackend}
          onNewDocument={handleNewDocument}
          dictationSettings={dictationSettings}
          onOpenDictationSettings={() => setIsSettingsModalOpen(true)}
          onOpenDocuments={() => setIsDocsModalOpen(true)}
          onOpenTemplates={() => setIsTemplatesModalOpen(true)}
          onExportDocument={handleExportDocument}
          exportingFormat={exportingFormat}
          onUpdateDictationLanguage={(lang) =>
            setDictationSettings((prev) => ({ ...prev, language: lang }))
          }
          dictationStatus={dictationStatus}
          onToggleDictation={toggleDictation}
        />

        {/* Template / export error banner */}
        {notice && (
          <div className="bg-red-950/60 border-b border-red-800/60 px-3 sm:px-4 py-2 flex items-center justify-between gap-2 text-xs text-red-300 animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{notice}</span>
            </div>
            <button
              onClick={() => setNotice(null)}
              className="text-red-400 hover:text-white p-0.5 rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Dictation / Microphone Error Banner */}
        {dictationError && (
          <div className="bg-red-950/60 border-b border-red-800/60 px-3 sm:px-4 py-2 flex items-center justify-between gap-2 text-xs text-red-300 animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{dictationError}</span>
            </div>
            <button
              onClick={() => setDictationError(null)}
              className="text-red-400 hover:text-white p-0.5 rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Document Work Area: Edit Tools Side Bar & Editor Card */}
        {/* Phones: scrolls as a whole so the editor keeps a usable height; md+: side bar and document scroll separately */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row p-1.5 sm:p-2 gap-1.5 sm:gap-2 overflow-y-auto md:overflow-hidden">
          {/* Integrated RAGSUITE Edit Tools Side Bar */}
          <RagsuiteToolbar
            editor={editor}
            onOpenTableDialog={() => setIsTableDialogOpen(true)}
            onOpenFindReplace={() => setIsFindReplaceOpen(true)}
            onAddField={activeTemplate ? () => setFieldsModal({ open: true, focusAdd: true }) : undefined}
            onManageFields={activeTemplate ? () => setFieldsModal({ open: true, focusAdd: false }) : undefined}
          />

          {/* Document column: template controls + editor card */}
          <div className="flex-1 min-w-0 flex flex-col gap-2.5 sm:gap-3.5 md:min-h-0 md:overflow-y-auto">
            {/* RAGSUITE Main Document Card */}
            <RagsuiteEditorCard
              editor={editor}
              documentTitle={documentTitle}
              wordCount={wordCount}
              charCount={charCount}
              layout={layout}
              onClearDocument={handleClearDocument}
              onCopyText={handleCopyDocumentText}
              onPreview={() => setIsPreviewOpen(true)}
              templateControls={
                activeTemplate
                  ? {
                      fieldsCount: activeTemplate.fields.length,
                      activeField: getActiveTemplateField(editor),
                      isDictating: dictationStatus === 'listening' || dictationStatus === 'transcribing',
                      outOfSync: !documentMatchesTemplate(editor, activeTemplate.fields, activeTemplate),
                      onApplyTemplateChanges: handleApplyTemplateChanges,
                    }
                  : undefined
              }
            />
          </div>
        </div>

      </main>

      {/* Floating Waveform & Interim Speech Overlay Badge */}
      <DictationOverlayBadge
        status={dictationStatus}
        interimText={interimText}
        audioLevel={audioLevel}
        language={dictationSettings.language}
        engine={dictationSettings.engine}
        onStop={stopDictation}
      />

      {/* Modals & Dialogs (All styled in RAGSUITE dark theme) */}
      <DictationSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={dictationSettings}
        onSaveSettings={setDictationSettings}
      />

      <AudioFileUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onInsertText={(text) => {
          if (editor) editor.commands.insertContent(`${text} `);
        }}
        currentLanguage={dictationSettings.language}
      />

      <DocumentsModal
        isOpen={isDocsModalOpen}
        onClose={() => setIsDocsModalOpen(false)}
        onSelectDocument={handleSelectDocument}
        onNewDocument={handleNewDocument}
        currentDocumentId={documentId}
      />

      <PreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        getContent={() => editor?.getHTML() ?? ''}
        title={documentTitle}
      />

      <TableDialog
        isOpen={isTableDialogOpen}
        onClose={() => setIsTableDialogOpen(false)}
        editor={editor}
      />

      <FindReplaceModal
        isOpen={isFindReplaceOpen}
        onClose={() => setIsFindReplaceOpen(false)}
        editor={editor}
      />

      <TemplatesModal
        isOpen={isTemplatesModalOpen}
        onClose={() => setIsTemplatesModalOpen(false)}
        onOpenTemplate={handleOpenTemplate}
        onTemplateRenamed={(updated) => {
          if (activeTemplate?.id === updated.id) setActiveTemplate(updated);
        }}
        onTemplateDeleted={handleTemplateDeleted}
        activeTemplateId={activeTemplate?.id ?? null}
        llmConfigured={backendHealth?.llm_gateway_configured}
        maxUploadMb={backendHealth?.template_max_upload_mb}
      />

      {activeTemplate && (
        <TemplateFieldsModal
          isOpen={fieldsModal.open}
          onClose={() => {
            setFieldsModal({ open: false, focusAdd: false });
            editor?.commands.focus();
          }}
          template={activeTemplate}
          onTemplateChange={handleTemplateFieldsChanged}
          fieldHasContent={(fieldId) => fieldHasContent(editor, fieldId)}
          focusAdd={fieldsModal.focusAdd}
        />
      )}
    </div>
  );
}
