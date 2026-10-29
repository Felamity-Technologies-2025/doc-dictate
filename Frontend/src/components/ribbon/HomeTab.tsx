import React, { useState } from 'react';
import type { Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Indent,
  Outdent,
  RemoveFormatting,
  Search,
  Check,
  ChevronDown,
  Palette,
  Highlighter,
} from 'lucide-react';
import { DictateButton } from '../dictation/DictateButton';
import { Tooltip } from '../common/Tooltip';
import { DictationStatus, DictationSettings } from '../../types';

interface HomeTabProps {
  editor: Editor | null;
  dictationStatus: DictationStatus;
  dictationSettings: DictationSettings;
  onToggleDictation: () => void;
  onOpenDictationSettings: () => void;
  onUpdateDictationLanguage: (lang: string) => void;
  onOpenFindReplace: () => void;
}

const FONT_FAMILIES = [
  { label: 'Calibri (Body)', value: 'Calibri, sans-serif' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Times New Roman', value: '"Times New Roman", serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Segoe UI', value: '"Segoe UI", sans-serif' },
  { label: 'Courier New', value: '"Courier New", monospace' },
];

const FONT_SIZES = ['9', '10', '11', '12', '14', '16', '18', '20', '24', '28', '36', '48', '72'];

export const HomeTab: React.FC<HomeTabProps> = ({
  editor,
  dictationStatus,
  dictationSettings,
  onToggleDictation,
  onOpenDictationSettings,
  onUpdateDictationLanguage,
  onOpenFindReplace,
}) => {
  const [selectedFont, setSelectedFont] = useState('Calibri, sans-serif');
  const [selectedFontSize, setSelectedFontSize] = useState('11');
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [highlightPickerOpen, setHighlightPickerOpen] = useState(false);

  if (!editor) return null;

  const handleFontFamilyChange = (val: string) => {
    setSelectedFont(val);
    editor.chain().focus().run();
  };

  const handleFontSizeChange = (val: string) => {
    setSelectedFontSize(val);
  };

  const applyTextColor = (color: string) => {
    editor.chain().focus().setColor(color).run();
    setColorPickerOpen(false);
  };

  const applyHighlight = (color: string) => {
    if (color === 'transparent') {
      editor.chain().focus().unsetHighlight().run();
    } else {
      editor.chain().focus().toggleHighlight({ color }).run();
    }
    setHighlightPickerOpen(false);
  };

  return (
    <div className="flex items-center gap-2 h-full overflow-x-auto py-1 px-3 text-xs text-neutral-700 select-none">
      {/* 1. Clipboard Group */}
      <div className="flex flex-col items-center justify-between h-full pr-2 border-r border-neutral-200 shrink-0">
        <div className="flex items-center gap-1 my-auto">
          <Tooltip content="Paste" shortcut="Ctrl+V">
            <button
              onClick={() => {
                navigator.clipboard?.readText().then((text) => {
                  if (text) editor.commands.insertContent(text);
                });
              }}
              className="p-1.5 rounded hover:bg-neutral-100 text-neutral-700 cursor-pointer"
            >
              <span className="text-[11px] font-semibold">Paste</span>
            </button>
          </Tooltip>
          <div className="flex flex-col gap-0.5">
            <Tooltip content="Cut" shortcut="Ctrl+X">
              <button
                onClick={() => {
                  document.execCommand('cut');
                }}
                className="px-1.5 py-0.5 rounded hover:bg-neutral-100 text-[11px] cursor-pointer"
              >
                Cut
              </button>
            </Tooltip>
            <Tooltip content="Copy" shortcut="Ctrl+C">
              <button
                onClick={() => {
                  document.execCommand('copy');
                }}
                className="px-1.5 py-0.5 rounded hover:bg-neutral-100 text-[11px] cursor-pointer"
              >
                Copy
              </button>
            </Tooltip>
          </div>
        </div>
        <span className="text-[10px] text-neutral-400 uppercase tracking-wider">Clipboard</span>
      </div>

      {/* 2. Font Group */}
      <div className="flex flex-col items-center justify-between h-full px-2 border-r border-neutral-200 shrink-0">
        <div className="flex flex-col gap-1 my-auto">
          {/* Top row: font family & size */}
          <div className="flex items-center gap-1">
            <select
              value={selectedFont}
              onChange={(e) => handleFontFamilyChange(e.target.value)}
              className="h-6 text-[11px] bg-white border border-neutral-300 rounded px-1.5 py-0 focus:outline-none focus:ring-1 focus:ring-blue-500 w-28 cursor-pointer"
            >
              {FONT_FAMILIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>

            <select
              value={selectedFontSize}
              onChange={(e) => handleFontSizeChange(e.target.value)}
              className="h-6 text-[11px] bg-white border border-neutral-300 rounded px-1 py-0 focus:outline-none focus:ring-1 focus:ring-blue-500 w-12 cursor-pointer"
            >
              {FONT_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <Tooltip content="Clear All Formatting">
              <button
                onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
                className="p-1 rounded hover:bg-neutral-100 text-neutral-600"
              >
                <RemoveFormatting className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
          </div>

          {/* Bottom row: formatting marks */}
          <div className="flex items-center gap-0.5">
            <Tooltip content="Bold" shortcut="Ctrl+B">
              <button
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`p-1 rounded transition-colors ${
                  editor.isActive('bold')
                    ? 'bg-blue-100 text-blue-700 font-bold'
                    : 'hover:bg-neutral-100 text-neutral-700'
                }`}
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
            </Tooltip>

            <Tooltip content="Italic" shortcut="Ctrl+I">
              <button
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`p-1 rounded transition-colors ${
                  editor.isActive('italic')
                    ? 'bg-blue-100 text-blue-700'
                    : 'hover:bg-neutral-100 text-neutral-700'
                }`}
              >
                <Italic className="w-3.5 h-3.5" />
              </button>
            </Tooltip>

            <Tooltip content="Underline" shortcut="Ctrl+U">
              <button
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                className={`p-1 rounded transition-colors ${
                  editor.isActive('underline')
                    ? 'bg-blue-100 text-blue-700'
                    : 'hover:bg-neutral-100 text-neutral-700'
                }`}
              >
                <UnderlineIcon className="w-3.5 h-3.5" />
              </button>
            </Tooltip>

            <Tooltip content="Strikethrough">
              <button
                onClick={() => editor.chain().focus().toggleStrike().run()}
                className={`p-1 rounded transition-colors ${
                  editor.isActive('strike')
                    ? 'bg-blue-100 text-blue-700'
                    : 'hover:bg-neutral-100 text-neutral-700'
                }`}
              >
                <Strikethrough className="w-3.5 h-3.5" />
              </button>
            </Tooltip>

            {/* Font Color Picker */}
            <div className="relative">
              <Tooltip content="Font Color">
                <button
                  onClick={() => setColorPickerOpen(!colorPickerOpen)}
                  className="p-1 rounded hover:bg-neutral-100 text-neutral-700 flex items-center gap-0.5"
                >
                  <Palette className="w-3.5 h-3.5 text-red-600" />
                  <ChevronDown className="w-2.5 h-2.5" />
                </button>
              </Tooltip>
              {colorPickerOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setColorPickerOpen(false)} />
                  <div className="absolute top-full left-0 mt-1 bg-white border border-neutral-300 shadow-lg rounded p-2 z-40 grid grid-cols-5 gap-1.5 w-36">
                    {['#000000', '#434343', '#666666', '#d32f2f', '#c2185b', '#7b1fa2', '#1976d2', '#0288d1', '#388e3c', '#fbc02d'].map((c) => (
                      <button
                        key={c}
                        onClick={() => applyTextColor(c)}
                        style={{ backgroundColor: c }}
                        className="w-5 h-5 rounded-xs border border-neutral-300 hover:scale-110 transition-transform cursor-pointer"
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Highlight Picker */}
            <div className="relative">
              <Tooltip content="Text Highlight Color">
                <button
                  onClick={() => setHighlightPickerOpen(!highlightPickerOpen)}
                  className="p-1 rounded hover:bg-neutral-100 text-neutral-700 flex items-center gap-0.5"
                >
                  <Highlighter className="w-3.5 h-3.5 text-amber-500" />
                  <ChevronDown className="w-2.5 h-2.5" />
                </button>
              </Tooltip>
              {highlightPickerOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setHighlightPickerOpen(false)} />
                  <div className="absolute top-full left-0 mt-1 bg-white border border-neutral-300 shadow-lg rounded p-2 z-40 grid grid-cols-4 gap-1.5 w-32">
                    {['#ffeb3b', '#8bc34a', '#00e5ff', '#ff80ab', '#b388ff', 'transparent'].map((c) => (
                      <button
                        key={c}
                        onClick={() => applyHighlight(c)}
                        style={{ backgroundColor: c === 'transparent' ? '#fff' : c }}
                        className="w-5 h-5 rounded-xs border border-neutral-300 text-[9px] flex items-center justify-center font-bold"
                      >
                        {c === 'transparent' ? '✕' : ''}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        <span className="text-[10px] text-neutral-400 uppercase tracking-wider">Font</span>
      </div>

      {/* 3. Paragraph Group */}
      <div className="flex flex-col items-center justify-between h-full px-2 border-r border-neutral-200 shrink-0">
        <div className="flex flex-col gap-1 my-auto">
          {/* Top row: lists & indents */}
          <div className="flex items-center gap-0.5">
            <Tooltip content="Bulleted List">
              <button
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={`p-1 rounded transition-colors ${
                  editor.isActive('bulletList')
                    ? 'bg-blue-100 text-blue-700'
                    : 'hover:bg-neutral-100 text-neutral-700'
                }`}
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </Tooltip>

            <Tooltip content="Numbered List">
              <button
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={`p-1 rounded transition-colors ${
                  editor.isActive('orderedList')
                    ? 'bg-blue-100 text-blue-700'
                    : 'hover:bg-neutral-100 text-neutral-700'
                }`}
              >
                <ListOrdered className="w-3.5 h-3.5" />
              </button>
            </Tooltip>

            <Tooltip content="Decrease Indent">
              <button
                onClick={() => {
                  if (editor.can().liftListItem('listItem')) {
                    editor.chain().focus().liftListItem('listItem').run();
                  }
                }}
                className="p-1 rounded hover:bg-neutral-100 text-neutral-700"
              >
                <Outdent className="w-3.5 h-3.5" />
              </button>
            </Tooltip>

            <Tooltip content="Increase Indent">
              <button
                onClick={() => {
                  if (editor.can().sinkListItem('listItem')) {
                    editor.chain().focus().sinkListItem('listItem').run();
                  }
                }}
                className="p-1 rounded hover:bg-neutral-100 text-neutral-700"
              >
                <Indent className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
          </div>

          {/* Bottom row: alignments */}
          <div className="flex items-center gap-0.5">
            <Tooltip content="Align Left" shortcut="Ctrl+L">
              <button
                onClick={() => editor.chain().focus().setTextAlign('left').run()}
                className={`p-1 rounded transition-colors ${
                  editor.isActive({ textAlign: 'left' })
                    ? 'bg-blue-100 text-blue-700'
                    : 'hover:bg-neutral-100 text-neutral-700'
                }`}
              >
                <AlignLeft className="w-3.5 h-3.5" />
              </button>
            </Tooltip>

            <Tooltip content="Align Center" shortcut="Ctrl+E">
              <button
                onClick={() => editor.chain().focus().setTextAlign('center').run()}
                className={`p-1 rounded transition-colors ${
                  editor.isActive({ textAlign: 'center' })
                    ? 'bg-blue-100 text-blue-700'
                    : 'hover:bg-neutral-100 text-neutral-700'
                }`}
              >
                <AlignCenter className="w-3.5 h-3.5" />
              </button>
            </Tooltip>

            <Tooltip content="Align Right" shortcut="Ctrl+R">
              <button
                onClick={() => editor.chain().focus().setTextAlign('right').run()}
                className={`p-1 rounded transition-colors ${
                  editor.isActive({ textAlign: 'right' })
                    ? 'bg-blue-100 text-blue-700'
                    : 'hover:bg-neutral-100 text-neutral-700'
                }`}
              >
                <AlignRight className="w-3.5 h-3.5" />
              </button>
            </Tooltip>

            <Tooltip content="Justify" shortcut="Ctrl+J">
              <button
                onClick={() => editor.chain().focus().setTextAlign('justify').run()}
                className={`p-1 rounded transition-colors ${
                  editor.isActive({ textAlign: 'justify' })
                    ? 'bg-blue-100 text-blue-700'
                    : 'hover:bg-neutral-100 text-neutral-700'
                }`}
              >
                <AlignJustify className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
          </div>
        </div>
        <span className="text-[10px] text-neutral-400 uppercase tracking-wider">Paragraph</span>
      </div>

      {/* 4. Styles Gallery Group (Word visual style cards) */}
      <div className="flex flex-col items-center justify-between h-full px-2 border-r border-neutral-200 shrink-0">
        <div className="flex items-center gap-1.5 my-auto">
          {/* Normal */}
          <button
            onClick={() => editor.chain().focus().setParagraph().run()}
            className={`px-2.5 py-1 rounded border text-left cursor-pointer transition-colors ${
              editor.isActive('paragraph') && !editor.isActive('heading')
                ? 'border-blue-600 bg-blue-50/50'
                : 'border-neutral-200 hover:border-neutral-300 bg-white'
            }`}
          >
            <div className="text-xs font-normal">AaBbCcDd</div>
            <div className="text-[10px] text-neutral-500">Normal</div>
          </button>

          {/* Heading 1 */}
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`px-2.5 py-1 rounded border text-left cursor-pointer transition-colors ${
              editor.isActive('heading', { level: 1 })
                ? 'border-blue-600 bg-blue-50/50'
                : 'border-neutral-200 hover:border-neutral-300 bg-white'
            }`}
          >
            <div className="text-xs font-bold text-blue-700">AaBbCcDd</div>
            <div className="text-[10px] text-neutral-500">Heading 1</div>
          </button>

          {/* Heading 2 */}
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`px-2.5 py-1 rounded border text-left cursor-pointer transition-colors ${
              editor.isActive('heading', { level: 2 })
                ? 'border-blue-600 bg-blue-50/50'
                : 'border-neutral-200 hover:border-neutral-300 bg-white'
            }`}
          >
            <div className="text-xs font-semibold text-blue-900">AaBbCcDd</div>
            <div className="text-[10px] text-neutral-500">Heading 2</div>
          </button>

          {/* Blockquote / Quote */}
          <button
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`px-2 py-1 rounded border text-left cursor-pointer transition-colors ${
              editor.isActive('blockquote')
                ? 'border-blue-600 bg-blue-50/50'
                : 'border-neutral-200 hover:border-neutral-300 bg-white'
            }`}
          >
            <div className="text-xs italic text-neutral-600">&ldquo;Quote&rdquo;</div>
            <div className="text-[10px] text-neutral-500">Quote</div>
          </button>
        </div>
        <span className="text-[10px] text-neutral-400 uppercase tracking-wider">Styles</span>
      </div>

      {/* 5. Editing Group */}
      <div className="flex flex-col items-center justify-between h-full px-2 border-r border-neutral-200 shrink-0">
        <div className="flex flex-col gap-0.5 my-auto">
          <Tooltip content="Find & Replace" shortcut="Ctrl+F">
            <button
              onClick={onOpenFindReplace}
              className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-neutral-100 text-neutral-700 cursor-pointer text-[11px]"
            >
              <Search className="w-3.5 h-3.5 text-neutral-500" />
              <span>Find</span>
            </button>
          </Tooltip>
          <button
            onClick={() => editor.chain().focus().selectAll().run()}
            className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-neutral-100 text-neutral-700 cursor-pointer text-[11px]"
          >
            <span>Select All</span>
          </button>
        </div>
        <span className="text-[10px] text-neutral-400 uppercase tracking-wider">Editing</span>
      </div>

      {/* 6. VOICE GROUP - DICTATE BUTTON (Centerpiece from User Image) */}
      <div className="flex flex-col items-center justify-between h-full pl-2 shrink-0">
        <div className="my-auto">
          <DictateButton
            status={dictationStatus}
            settings={dictationSettings}
            onToggleDictation={onToggleDictation}
            onOpenSettings={onOpenDictationSettings}
            onUpdateLanguage={onUpdateDictationLanguage}
          />
        </div>
      </div>
    </div>
  );
};
