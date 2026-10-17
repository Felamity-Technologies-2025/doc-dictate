import React, { useRef } from 'react';
import type { Editor } from '@tiptap/react';
import { Table, Image as ImageIcon, Link as LinkIcon, Minus, Quote, SplitSquareVertical } from 'lucide-react';
import { Tooltip } from '../common/Tooltip';

interface InsertTabProps {
  editor: Editor | null;
  onOpenTableDialog: () => void;
}

export const InsertTab: React.FC<InsertTabProps> = ({ editor, onOpenTableDialog }) => {
  const imageInputRef = useRef<HTMLInputElement>(null);

  if (!editor) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (readerEvent) => {
        const url = readerEvent.target?.result as string;
        if (url) {
          editor.chain().focus().setImage({ src: url }).run();
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleInsertLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('Enter Web URL (https://...):', previousUrl || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const handleInsertImageByUrl = () => {
    const url = window.prompt('Enter Image URL (https://...):');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  return (
    <div className="flex items-center gap-3 h-full px-4 py-1 text-xs text-neutral-700 select-none">
      {/* Tables */}
      <div className="flex flex-col items-center justify-between h-full pr-3 border-r border-neutral-200">
        <button
          onClick={onOpenTableDialog}
          className="flex flex-col items-center p-1.5 rounded hover:bg-neutral-100 text-neutral-700 cursor-pointer my-auto"
        >
          <Table className="w-5 h-5 text-blue-600 mb-0.5" />
          <span className="text-[11px] font-medium">Table</span>
        </button>
        <span className="text-[10px] text-neutral-400 uppercase tracking-wider">Tables</span>
      </div>

      {/* Illustrations & Media */}
      <div className="flex flex-col items-center justify-between h-full px-3 border-r border-neutral-200">
        <div className="flex items-center gap-2 my-auto">
          <input
            type="file"
            ref={imageInputRef}
            onChange={handleImageUpload}
            accept="image/*"
            className="hidden"
          />
          <button
            onClick={() => imageInputRef.current?.click()}
            className="flex flex-col items-center p-1.5 rounded hover:bg-neutral-100 text-neutral-700 cursor-pointer"
          >
            <ImageIcon className="w-5 h-5 text-emerald-600 mb-0.5" />
            <span className="text-[11px] font-medium">Upload Image</span>
          </button>
          <button
            onClick={handleInsertImageByUrl}
            className="flex flex-col items-center p-1.5 rounded hover:bg-neutral-100 text-neutral-700 cursor-pointer"
          >
            <span className="text-xs text-neutral-500 font-semibold mb-0.5">URL</span>
            <span className="text-[11px]">Image URL</span>
          </button>
        </div>
        <span className="text-[10px] text-neutral-400 uppercase tracking-wider">Illustrations</span>
      </div>

      {/* Links & Break */}
      <div className="flex flex-col items-center justify-between h-full px-3 border-r border-neutral-200">
        <div className="flex items-center gap-2 my-auto">
          <button
            onClick={handleInsertLink}
            className="flex flex-col items-center p-1.5 rounded hover:bg-neutral-100 text-neutral-700 cursor-pointer"
          >
            <LinkIcon className="w-5 h-5 text-blue-600 mb-0.5" />
            <span className="text-[11px] font-medium">Link</span>
          </button>

          <button
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            className="flex flex-col items-center p-1.5 rounded hover:bg-neutral-100 text-neutral-700 cursor-pointer"
          >
            <Minus className="w-5 h-5 text-neutral-500 mb-0.5" />
            <span className="text-[11px] font-medium">Horizontal Line</span>
          </button>

          <button
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className="flex flex-col items-center p-1.5 rounded hover:bg-neutral-100 text-neutral-700 cursor-pointer"
          >
            <Quote className="w-5 h-5 text-amber-600 mb-0.5" />
            <span className="text-[11px] font-medium">Quote Box</span>
          </button>
        </div>
        <span className="text-[10px] text-neutral-400 uppercase tracking-wider">Elements</span>
      </div>
    </div>
  );
};
