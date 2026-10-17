import React, { useState } from 'react';
import type { Editor } from '@tiptap/react';
import { Search, X, Replace } from 'lucide-react';

interface FindReplaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  editor: Editor | null;
}

export const FindReplaceModal: React.FC<FindReplaceModalProps> = ({
  isOpen,
  onClose,
  editor,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  if (!isOpen || !editor) return null;

  const handleFindNext = () => {
    if (!searchTerm.trim()) return;
    const text = editor.getText();
    const index = text.toLowerCase().indexOf(searchTerm.toLowerCase());
    if (index !== -1) {
      setMessage(`Found occurrence in document.`);
    } else {
      setMessage(`"${searchTerm}" not found in document.`);
    }
  };

  const handleReplaceAll = () => {
    if (!searchTerm.trim()) return;
    const currentHtml = editor.getHTML();
    const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'gi');
    const matches = (currentHtml.match(regex) || []).length;

    if (matches > 0) {
      const newHtml = currentHtml.replace(regex, replaceTerm);
      editor.commands.setContent(newHtml);
      setMessage(`Replaced ${matches} occurrence(s).`);
    } else {
      setMessage(`No occurrences of "${searchTerm}" found to replace.`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-4">
      <div className="bg-[#0f172a] rounded-xl shadow-2xl border border-[#1e2c47] w-full max-w-sm max-h-[calc(100dvh-1.5rem)] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2c47] bg-[#0c1222]">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Search className="w-4 h-4 text-blue-400" />
            <span>Find & Replace</span>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3 text-xs">
          <div>
            <label className="block text-neutral-300 font-medium mb-1">Find</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search text..."
              className="w-full bg-[#131b2e] border border-[#1e2c47] rounded-lg px-3 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-neutral-300 font-medium mb-1">Replace with</label>
            <input
              type="text"
              value={replaceTerm}
              onChange={(e) => setReplaceTerm(e.target.value)}
              placeholder="Replacement text..."
              className="w-full bg-[#131b2e] border border-[#1e2c47] rounded-lg px-3 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {message && (
            <p className="text-[11px] text-blue-400 font-medium">{message}</p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1e2c47]">
            <button
              onClick={handleFindNext}
              className="px-3 py-1.5 border border-[#1e2c47] hover:bg-[#162035] rounded-lg text-neutral-300 font-medium cursor-pointer"
            >
              Find Next
            </button>
            <button
              onClick={handleReplaceAll}
              className="px-3.5 py-1.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-lg font-medium flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
            >
              <Replace className="w-3.5 h-3.5" />
              <span>Replace All</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
