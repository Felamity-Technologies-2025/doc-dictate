import React from 'react';
import { EditorContent, type Editor } from '@tiptap/react';
import { PageLayoutConfig } from '../../types';

interface DocumentCanvasProps {
  editor: Editor | null;
  layout: PageLayoutConfig;
  isDarkMode: boolean;
}

export const DocumentCanvas: React.FC<DocumentCanvasProps> = ({
  editor,
  layout,
  isDarkMode,
}) => {
  // Page size pixel equivalents for 96 DPI screen
  const getPageDimensions = () => {
    let width = 816; // Letter width 8.5in
    let minHeight = 1056; // Letter height 11in

    if (layout.size === 'a4') {
      width = 794; // 8.27in
      minHeight = 1123; // 11.69in
    } else if (layout.size === 'legal') {
      width = 816;
      minHeight = 1344;
    }

    if (layout.orientation === 'landscape') {
      const temp = width;
      width = minHeight;
      minHeight = temp;
    }

    return { width, minHeight };
  };

  const getPaddingClass = () => {
    switch (layout.margins) {
      case 'narrow':
        return 'p-8 sm:p-12'; // 0.5 in
      case 'moderate':
        return 'p-12 sm:p-16'; // 0.75 in
      case 'wide':
        return 'p-16 sm:p-24'; // 1.5 in
      case 'normal':
      default:
        return 'p-12 sm:p-20'; // 1.0 in
    }
  };

  const { width, minHeight } = getPageDimensions();
  const zoomScale = layout.zoom / 100;

  return (
    <div
      className={`flex-1 overflow-auto flex justify-center py-8 px-4 transition-colors ${
        isDarkMode ? 'bg-neutral-900' : 'bg-[#e9ecef]'
      }`}
    >
      <div
        style={{
          transform: `scale(${zoomScale})`,
          transformOrigin: 'top center',
          width: `${width}px`,
          minHeight: `${minHeight}px`,
        }}
        className={`transition-transform duration-75 relative shrink-0 ${
          isDarkMode
            ? 'bg-neutral-800 text-neutral-100 shadow-2xl border border-neutral-700'
            : 'bg-white text-neutral-900 shadow-xl border border-neutral-300'
        } ${getPaddingClass()} rounded-xs`}
        onClick={() => {
          if (editor && !editor.isFocused) {
            editor.chain().focus().run();
          }
        }}
      >
        <EditorContent
          editor={editor}
          className="prose prose-neutral max-w-none focus:outline-none min-h-[500px] font-sans selection:bg-blue-200"
        />
      </div>
    </div>
  );
};
