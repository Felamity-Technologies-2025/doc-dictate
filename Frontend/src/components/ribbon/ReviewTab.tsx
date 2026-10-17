import React from 'react';
import type { Editor } from '@tiptap/react';
import { SpellCheck, Calculator, Search, Clock, CheckCircle } from 'lucide-react';

interface ReviewTabProps {
  editor: Editor | null;
  onOpenFindReplace: () => void;
}

export const ReviewTab: React.FC<ReviewTabProps> = ({ editor, onOpenFindReplace }) => {
  if (!editor) return null;

  const text = editor.getText();
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const charCount = text.length;
  const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));

  return (
    <div className="flex items-center gap-4 h-full px-4 py-1 text-xs text-neutral-700 select-none">
      {/* Proofing */}
      <div className="flex flex-col items-center justify-between h-full pr-3 border-r border-neutral-200">
        <div className="flex items-center gap-2 my-auto">
          <div className="flex flex-col items-center p-1.5 rounded bg-emerald-50 text-emerald-800">
            <CheckCircle className="w-4 h-4 text-emerald-600 mb-0.5" />
            <span className="text-[11px] font-semibold">Spellcheck OK</span>
          </div>
        </div>
        <span className="text-[10px] text-neutral-400 uppercase tracking-wider">Proofing</span>
      </div>

      {/* Statistics */}
      <div className="flex flex-col items-center justify-between h-full px-3 border-r border-neutral-200">
        <div className="flex items-center gap-3 my-auto">
          <div className="flex flex-col text-left">
            <span className="text-[11px] text-neutral-400 font-medium">Word Count</span>
            <span className="text-sm font-bold text-neutral-800">{wordCount.toLocaleString()}</span>
          </div>
          <div className="flex flex-col text-left">
            <span className="text-[11px] text-neutral-400 font-medium">Characters</span>
            <span className="text-sm font-bold text-neutral-800">{charCount.toLocaleString()}</span>
          </div>
          <div className="flex flex-col text-left">
            <span className="text-[11px] text-neutral-400 font-medium">Est. Read Time</span>
            <span className="text-sm font-bold text-neutral-800">{readingTimeMinutes} min</span>
          </div>
        </div>
        <span className="text-[10px] text-neutral-400 uppercase tracking-wider">Statistics</span>
      </div>

      {/* Editing search */}
      <div className="flex flex-col items-center justify-between h-full px-3">
        <div className="flex items-center gap-2 my-auto">
          <button
            onClick={onOpenFindReplace}
            className="flex flex-col items-center p-1.5 rounded hover:bg-neutral-100 text-neutral-700 cursor-pointer"
          >
            <Search className="w-4 h-4 text-blue-600 mb-0.5" />
            <span className="text-[11px] font-medium">Find & Replace</span>
          </button>
        </div>
        <span className="text-[10px] text-neutral-400 uppercase tracking-wider">Navigation</span>
      </div>
    </div>
  );
};
