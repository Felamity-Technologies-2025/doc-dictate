import React, { useState, useEffect } from 'react';
import { FileText, Plus, Trash2, Clock, Check, X, Loader2, Database } from 'lucide-react';
import { DocumentModel } from '../../types';
import { ApiService } from '../../services/api';

interface DocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDocument: (doc: DocumentModel) => void;
  onNewDocument: () => void;
  currentDocumentId: string | null;
}

export const DocumentsModal: React.FC<DocumentsModalProps> = ({
  isOpen,
  onClose,
  onSelectDocument,
  onNewDocument,
  currentDocumentId,
}) => {
  const [documents, setDocuments] = useState<DocumentModel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDocs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await ApiService.listDocuments();
      setDocuments(list);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Could not load documents: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadDocs();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Delete this document from SQLite database?')) {
      try {
        await ApiService.deleteDocument(id);
        setDocuments((prev) => prev.filter((d) => d.id !== id));
      } catch (err) {
        alert('Failed to delete document: ' + err);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-4">
      <div className="bg-[#0f172a] rounded-xl shadow-2xl border border-[#1e2c47] w-full max-w-lg max-h-[calc(100dvh-1.5rem)] overflow-y-auto animate-in fade-in duration-150">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1e2c47] bg-[#0c1222]">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold text-white text-sm">
              Document Library (SQLite Storage)
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1 rounded-sm cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-400">
              {documents.length} document{documents.length !== 1 ? 's' : ''} stored in SQLite
            </span>
            <button
              onClick={() => {
                onNewDocument();
                onClose();
              }}
              className="px-3 py-1.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Document</span>
            </button>
          </div>

          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-neutral-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
              <span className="text-xs">Loading documents from SQLite...</span>
            </div>
          ) : error ? (
            <div className="p-3 bg-red-950/40 text-red-300 border border-red-800/50 rounded-lg text-xs">
              {error}
            </div>
          ) : documents.length === 0 ? (
            <div className="py-10 text-center text-neutral-400 text-xs">
              No saved documents yet. Type or dictate to automatically persist your document.
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto divide-y divide-[#1e2c47] border border-[#1e2c47] rounded-lg bg-[#131b2e]">
              {documents.map((doc) => {
                const isCurrent = doc.id === currentDocumentId;
                const formattedDate = new Date(doc.updated_at).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={doc.id}
                    onClick={() => {
                      onSelectDocument(doc);
                      onClose();
                    }}
                    className={`p-3 flex items-center justify-between hover:bg-[#18233a] cursor-pointer transition-colors ${
                      isCurrent ? 'bg-[#18233a] font-medium border-l-2 border-l-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <FileText className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                      <div className="truncate">
                        <div className="text-xs text-white font-medium truncate flex items-center gap-2">
                          <span>{doc.title}</span>
                          {isCurrent && (
                            <span className="text-[10px] text-blue-400 bg-blue-950/60 px-1.5 py-0.2 rounded-full border border-blue-500/30">
                              Current
                            </span>
                          )}
                          {doc.template_id && (
                            <span className="text-[10px] text-emerald-400 bg-emerald-950/40 px-1.5 py-0.2 rounded-full border border-emerald-500/30">
                              Template
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-neutral-400 flex items-center gap-2 mt-0.5">
                          <span>{doc.word_count || 0} words</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formattedDate}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={(e) => handleDelete(e, doc.id)}
                      className="p-1.5 text-neutral-400 hover:text-red-400 rounded-lg hover:bg-red-500/20 cursor-pointer transition-colors ml-2 shrink-0"
                      title="Delete document"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
