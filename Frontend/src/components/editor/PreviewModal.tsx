import React, { useEffect, useState } from 'react';
import { AlertTriangle, Eye, Loader2, X } from 'lucide-react';
import { ApiService } from '../../services/api';

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Current editor HTML, read when the preview opens */
  getContent: () => string;
  title: string;
}

/** Shows the document as the downloaded PDF/DOCX will lay it out (headings, tables, ...) */
export const PreviewModal: React.FC<PreviewModalProps> = ({ isOpen, onClose, getContent, title }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    setUrl(null);
    setError(null);
    ApiService.previewDocument(getContent(), title)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // The preview is a snapshot taken when it opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="bg-[#0f172a] rounded-xl shadow-2xl border border-[#1e2c47] w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#1e2c47] bg-[#0c1222] shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Eye className="w-4 h-4 text-blue-400 shrink-0" />
            <h3 className="font-semibold text-white text-sm truncate">Preview - {title}</h3>
            <span className="text-[11px] text-[#7082a4] hidden sm:inline">As it will appear in the downloaded file</span>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white p-1 rounded-sm cursor-pointer" title="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 min-h-0 bg-neutral-700 flex items-center justify-center">
          {error ? (
            <div className="flex items-center gap-2 text-sm text-red-300 px-6 text-center">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : url ? (
            <iframe title="Document preview" src={url} className="w-full h-full border-0 bg-white" />
          ) : (
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          )}
        </div>
      </div>
    </div>
  );
};
