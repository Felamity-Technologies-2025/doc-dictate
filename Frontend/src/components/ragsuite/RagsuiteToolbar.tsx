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
  Palette,
  Highlighter,
  Table as TableIcon,
  Image as ImageIcon,
  Link as LinkIcon,
  Minus,
  Quote,
  Search,
  Mic,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Settings,
  Upload,
  Check,
  Undo2,
  Redo2,
  Scissors,
  Copy,
  ClipboardPaste,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  ArrowUpDown,
} from 'lucide-react';
import { DictationStatus, DictationSettings } from '../../types';
import { SUPPORTED_LANGUAGES } from '../../utils/punctuation';

interface RagsuiteToolbarProps {
  editor: Editor | null;
  dictationStatus: DictationStatus;
  dictationSettings: DictationSettings;
  onToggleDictation: () => void;
  onOpenDictationSettings: () => void;
  onOpenAudioUpload: () => void;
  onUpdateDictationLanguage: (lang: string) => void;
  onOpenTableDialog: () => void;
  onOpenFindReplace: () => void;
}

const FONT_FAMILIES = [
  { label: 'System UI', value: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' },
  { label: 'Inter', value: 'Inter, sans-serif' },
  { label: 'Calibri', value: 'Calibri, sans-serif' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Segoe UI', value: 'Segoe UI, sans-serif' },
  { label: 'Fira Code', value: 'Fira Code, monospace' },
  { label: 'Courier New', value: 'Courier New, monospace' },
  { label: 'Times New Roman', value: 'Times New Roman, serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
];

const FONT_SIZES = ['8', '9', '10', '11', '12', '14', '16', '18', '20', '24', '28', '32', '36', '48', '72'];
const DEFAULT_FONT_SIZE = 14;
const LINE_SPACINGS = ['1', '1.15', '1.5', '2', '2.5', '3'];

const TEXT_COLORS = [
  '#ffffff', '#94a3b8', '#000000', '#60a5fa', '#3b82f6', '#1d4ed8',
  '#34d399', '#10b981', '#f87171', '#ef4444', '#fbbf24', '#f59e0b',
  '#c084fc', '#a855f7', '#f43f5e', '#fb923c', '#22d3ee', '#a3e635',
];
const HIGHLIGHT_COLORS = [
  '#fef08a', '#bbf7d0', '#bae6fd', '#fbcfe8', '#ddd6fe', '#fed7aa',
  '#fde047', '#4ade80', '#38bdf8', '#f472b6', '#a78bfa', '#fb923c',
];

/** On phones, popovers are centered on screen instead of anchored, so they never run off the edge */
const MOBILE_POPOVER =
  'max-sm:fixed max-sm:top-1/2 max-sm:left-1/2 max-sm:-translate-x-1/2 max-sm:-translate-y-1/2 max-sm:mt-0';

const clamp255 =(n: number) => (Number.isNaN(n) ? 0 : Math.max(0, Math.min(255, Math.round(n))));
const toHex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((v) => clamp255(v).toString(16).padStart(2, '0')).join('');
const parseHex = (hex: string): [number, number, number] | null => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

interface ColorPopoverProps {
  colors: string[];
  initial: string;
  columns: number;
  onPick: (color: string) => void;
  onClear?: () => void;
  clearLabel?: string;
  onClose: () => void;
}

/** Swatch palette plus a custom picker with RGB sliders/inputs, hex field and native color dialog. */
const ColorPopover: React.FC<ColorPopoverProps> = ({
  colors,
  initial,
  columns,
  onPick,
  onClear,
  clearLabel = 'No color',
  onClose,
}) => {
  const start = parseHex(initial) ?? [255, 255, 255];
  const [rgb, setRgb] = useState<[number, number, number]>(start);
  const [hexText, setHexText] = useState(toHex(...start));

  const update = (next: [number, number, number]) => {
    setRgb(next);
    setHexText(toHex(...next));
  };

  const channels: { label: string; idx: 0 | 1 | 2; accent: string }[] = [
    { label: 'R', idx: 0, accent: '#ef4444' },
    { label: 'G', idx: 1, accent: '#22c55e' },
    { label: 'B', idx: 2, accent: '#3b82f6' },
  ];

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className={`absolute top-full left-0 mt-1.5 bg-[#121929] border border-[#23334d] shadow-2xl rounded-lg p-2.5 z-40 w-56 ${MOBILE_POPOVER}`}>
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {colors.map((c) => (
            <button
              key={c}
              onClick={() => onPick(c)}
              style={{ backgroundColor: c }}
              title={c}
              className="w-6 h-6 rounded border border-white/20 hover:scale-110 transition-transform cursor-pointer"
            />
          ))}
        </div>
        {onClear && (
          <button
            onClick={onClear}
            className="mt-2 w-full text-left px-2 py-1 rounded hover:bg-[#1a2842] text-neutral-300"
          >
            ✕ {clearLabel}
          </button>
        )}

        <div className="mt-2 pt-2 border-t border-[#1e2c47] space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">
            Custom color (RGB)
          </div>
          {channels.map(({ label, idx, accent }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="w-3 text-[10px] font-bold" style={{ color: accent }}>
                {label}
              </span>
              <input
                type="range"
                min={0}
                max={255}
                value={rgb[idx]}
                onChange={(e) => {
                  const next = [...rgb] as [number, number, number];
                  next[idx] = clamp255(Number(e.target.value));
                  update(next);
                }}
                style={{ accentColor: accent }}
                className="flex-1 h-1 cursor-pointer"
              />
              <input
                type="number"
                min={0}
                max={255}
                value={rgb[idx]}
                onChange={(e) => {
                  const next = [...rgb] as [number, number, number];
                  next[idx] = clamp255(Number(e.target.value));
                  update(next);
                }}
                className="w-11 bg-[#18233a] border border-[#23334d] rounded px-1 py-0.5 text-white text-[11px] focus:outline-none"
              />
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <input
              type="color"
              value={toHex(...rgb)}
              onChange={(e) => {
                const p = parseHex(e.target.value);
                if (p) update(p);
              }}
              className="w-7 h-7 p-0 bg-transparent border border-[#23334d] rounded cursor-pointer"
              title="Open system color picker"
            />
            <input
              type="text"
              value={hexText}
              onChange={(e) => {
                setHexText(e.target.value);
                const p = parseHex(e.target.value);
                if (p) setRgb(p);
              }}
              maxLength={7}
              className="w-20 bg-[#18233a] border border-[#23334d] rounded px-1.5 py-1 text-white text-[11px] font-mono focus:outline-none"
            />
            <div
              className="w-5 h-5 rounded border border-white/20"
              style={{ backgroundColor: toHex(...rgb) }}
            />
            <button
              onClick={() => onPick(toHex(...rgb))}
              className="ml-auto px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold cursor-pointer"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export const RagsuiteToolbar: React.FC<RagsuiteToolbarProps> = ({
  editor,
  dictationStatus,
  dictationSettings,
  onToggleDictation,
  onOpenDictationSettings,
  onOpenAudioUpload,
  onUpdateDictationLanguage,
  onOpenTableDialog,
  onOpenFindReplace,
}) => {
  const [lineSpacingOpen, setLineSpacingOpen] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [highlightPickerOpen, setHighlightPickerOpen] = useState(false);
  const [dictateDropdownOpen, setDictateDropdownOpen] = useState(false);
  const [showAllTools, setShowAllTools] = useState(false);

  if (!editor) return null;

  // Secondary groups are always visible from md up; on phones only after "More" is pressed.
  // `contents` keeps their buttons flowing in the toolbar's own flex-wrap row.
  const secondary = showAllTools ? 'contents' : 'hidden md:contents';

  const isRecording = dictationStatus === 'listening';
  const isTranscribing = dictationStatus === 'transcribing';
  const isRequesting = dictationStatus === 'requesting-permission';

  const currentLang =
    SUPPORTED_LANGUAGES.find((l) => l.code === dictationSettings.language) ||
    SUPPORTED_LANGUAGES[0];

  const textStyle = editor.getAttributes('textStyle');
  const currentFont =
    FONT_FAMILIES.find((f) => f.value === textStyle.fontFamily)?.value ?? '';
  const currentSize = textStyle.fontSize
    ? String(parseInt(textStyle.fontSize, 10))
    : String(DEFAULT_FONT_SIZE);
  const currentTextColor: string = textStyle.color || '#ffffff';
  const currentHighlight: string = editor.getAttributes('highlight').color || '#fef08a';
  const currentLineHeight: string =
    editor.getAttributes('paragraph').lineHeight ||
    editor.getAttributes('heading').lineHeight ||
    '';

  const handleFontFamilyChange = (val: string) => {
    if (val) editor.chain().focus().setFontFamily(val).run();
    else editor.chain().focus().unsetFontFamily().run();
  };

  const handleFontSizeChange = (val: string) => {
    editor.chain().focus().setFontSize(`${val}pt`).run();
  };

  const stepFontSize = (delta: number) => {
    const next = Math.max(1, Math.min(200, Number(currentSize) + delta));
    handleFontSizeChange(String(next));
  };

  const handleCut = () => {
    editor.view.focus();
    document.execCommand('cut');
  };

  const handleCopy = () => {
    editor.view.focus();
    document.execCommand('copy');
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) editor.chain().focus().insertContent(text).run();
    } catch {
      window.alert('Clipboard access was blocked. Use Ctrl+V to paste.');
    }
  };

  const applyTextColor = (color: string) => {
    editor.chain().focus().setColor(color).run();
    setColorPickerOpen(false);
  };

  const clearTextColor = () => {
    editor.chain().focus().unsetColor().run();
    setColorPickerOpen(false);
  };

  const applyHighlight = (color: string) => {
    editor.chain().focus().setHighlight({ color }).run();
    setHighlightPickerOpen(false);
  };

  const clearHighlight = () => {
    editor.chain().focus().unsetHighlight().run();
    setHighlightPickerOpen(false);
  };

  const applyLineSpacing = (value: string) => {
    editor.chain().focus().setLineHeight(value).run();
    setLineSpacingOpen(false);
  };

  const indent = () => {
    if (editor.can().sinkListItem('listItem')) {
      editor.chain().focus().sinkListItem('listItem').run();
    }
  };

  const outdent = () => {
    if (editor.can().liftListItem('listItem')) {
      editor.chain().focus().liftListItem('listItem').run();
    }
  };

  const handleInsertLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('Enter Hyperlink URL (https://...):', previousUrl || 'https://');
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
    <div className="rag-toolbar bg-[#121929] border border-[#1e2c47] rounded-xl px-2 sm:px-3 py-2 flex items-start justify-between gap-2 sm:gap-3 text-xs text-neutral-300 select-none shadow-md shrink-0">
      {/* Left Formatting Tools: wrap inside their own column so Dictate stays top-right */}
      <div className="flex-1 min-w-0 flex items-center flex-wrap gap-x-1.5 gap-y-1.5">
        {/* Undo / Redo */}
        <button
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="p-1.5 rounded-lg hover:bg-[#1a2842] text-neutral-300 hover:text-white cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="p-1.5 rounded-lg hover:bg-[#1a2842] text-neutral-300 hover:text-white cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          title="Redo (Ctrl+Y)"
        >
          <Redo2 className="w-3.5 h-3.5" />
        </button>

        {/* Clipboard and fonts (hidden on phones until expanded) */}
        <div className={secondary}>
          <div className="w-[1px] h-5 bg-[#1e2c47] mx-0.5" />

          {/* Clipboard */}
          <button
            onClick={handlePaste}
            className="p-1.5 rounded-lg hover:bg-[#1a2842] text-neutral-300 hover:text-white cursor-pointer"
            title="Paste (Ctrl+V)"
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleCut}
            className="p-1.5 rounded-lg hover:bg-[#1a2842] text-neutral-300 hover:text-white cursor-pointer"
            title="Cut (Ctrl+X)"
          >
            <Scissors className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg hover:bg-[#1a2842] text-neutral-300 hover:text-white cursor-pointer"
            title="Copy (Ctrl+C)"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          <div className="w-[1px] h-5 bg-[#1e2c47] mx-0.5" />

          {/* Font Family */}
          <select
            value={currentFont}
            onChange={(e) => handleFontFamilyChange(e.target.value)}
            className="bg-[#18233a] border border-[#23334d] hover:border-blue-500/50 text-white rounded-lg px-2 py-1 text-xs focus:outline-none cursor-pointer w-32"
            title="Font Family"
          >
            <option value="">Default</option>
            {FONT_FAMILIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>

          {/* Font Size */}
          <select
            value={currentSize}
            onChange={(e) => handleFontSizeChange(e.target.value)}
            className="bg-[#18233a] border border-[#23334d] hover:border-blue-500/50 text-white rounded-lg px-1.5 py-1 text-xs focus:outline-none cursor-pointer w-16"
            title="Font Size"
          >
            {!FONT_SIZES.includes(currentSize) && <option value={currentSize}>{currentSize} pt</option>}
            {FONT_SIZES.map((s) => (
              <option key={s} value={s}>
                {s} pt
              </option>
            ))}
          </select>
          <button
            onClick={() => stepFontSize(2)}
            className="px-1.5 py-1 rounded-lg hover:bg-[#1a2842] text-neutral-300 hover:text-white cursor-pointer text-[11px] font-bold"
            title="Increase Font Size"
          >
            A<sup>+</sup>
          </button>
          <button
            onClick={() => stepFontSize(-2)}
            className="px-1.5 py-1 rounded-lg hover:bg-[#1a2842] text-neutral-300 hover:text-white cursor-pointer text-[10px] font-bold"
            title="Decrease Font Size"
          >
            A<sup>-</sup>
          </button>
        </div>

        {/* Separator */}
        <div className="w-[1px] h-5 bg-[#1e2c47] mx-0.5" />

        {/* Bold, Italic, Underline, Strike */}
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
            editor.isActive('bold')
              ? 'bg-blue-600 text-white'
              : 'hover:bg-[#1a2842] text-neutral-300 hover:text-white'
          }`}
          title="Bold (Ctrl+B)"
        >
          <Bold className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
            editor.isActive('italic')
              ? 'bg-blue-600 text-white'
              : 'hover:bg-[#1a2842] text-neutral-300 hover:text-white'
          }`}
          title="Italic (Ctrl+I)"
        >
          <Italic className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
            editor.isActive('underline')
              ? 'bg-blue-600 text-white'
              : 'hover:bg-[#1a2842] text-neutral-300 hover:text-white'
          }`}
          title="Underline (Ctrl+U)"
        >
          <UnderlineIcon className="w-3.5 h-3.5" />
        </button>

        {/* Extra marks, colors and alignment (hidden on phones until expanded) */}
        <div className={secondary}>
          <button
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              editor.isActive('strike')
                ? 'bg-blue-600 text-white'
                : 'hover:bg-[#1a2842] text-neutral-300 hover:text-white'
            }`}
            title="Strikethrough"
          >
            <Strikethrough className="w-3.5 h-3.5" />
          </button>

          {/* Subscript / Superscript */}
          <button
            onClick={() => editor.chain().focus().toggleSubscript().run()}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              editor.isActive('subscript')
                ? 'bg-blue-600 text-white'
                : 'hover:bg-[#1a2842] text-neutral-300 hover:text-white'
            }`}
            title="Subscript (Ctrl+,)"
          >
            <SubscriptIcon className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleSuperscript().run()}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              editor.isActive('superscript')
                ? 'bg-blue-600 text-white'
                : 'hover:bg-[#1a2842] text-neutral-300 hover:text-white'
            }`}
            title="Superscript (Ctrl+.)"
          >
            <SuperscriptIcon className="w-3.5 h-3.5" />
          </button>

          {/* Text Color Picker */}
          <div className="relative">
            <button
              onClick={() => setColorPickerOpen(!colorPickerOpen)}
              className="p-1.5 rounded-lg hover:bg-[#1a2842] text-neutral-300 hover:text-white cursor-pointer flex items-center gap-0.5"
              title="Text Color"
            >
              <span className="flex flex-col items-center leading-none">
                <Palette className="w-3.5 h-3.5 text-blue-400" />
                <span className="mt-0.5 h-[3px] w-3.5 rounded-sm" style={{ backgroundColor: currentTextColor }} />
              </span>
              <ChevronDown className="w-2.5 h-2.5 text-neutral-500" />
            </button>
            {colorPickerOpen && (
              <ColorPopover
                colors={TEXT_COLORS}
                initial={currentTextColor}
                columns={6}
                onPick={applyTextColor}
                onClear={clearTextColor}
                clearLabel="Automatic (remove color)"
                onClose={() => setColorPickerOpen(false)}
              />
            )}
          </div>

          {/* Text Highlight Picker */}
          <div className="relative">
            <button
              onClick={() => setHighlightPickerOpen(!highlightPickerOpen)}
              className="p-1.5 rounded-lg hover:bg-[#1a2842] text-neutral-300 hover:text-white cursor-pointer flex items-center gap-0.5"
              title="Highlight Text"
            >
              <span className="flex flex-col items-center leading-none">
                <Highlighter className="w-3.5 h-3.5 text-amber-400" />
                <span className="mt-0.5 h-[3px] w-3.5 rounded-sm" style={{ backgroundColor: currentHighlight }} />
              </span>
              <ChevronDown className="w-2.5 h-2.5 text-neutral-500" />
            </button>
            {highlightPickerOpen && (
              <ColorPopover
                colors={HIGHLIGHT_COLORS}
                initial={currentHighlight}
                columns={6}
                onPick={applyHighlight}
                onClear={clearHighlight}
                clearLabel="No highlight"
                onClose={() => setHighlightPickerOpen(false)}
              />
            )}
          </div>

          <button
            onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
            className="p-1.5 rounded-lg hover:bg-[#1a2842] text-neutral-400 hover:text-white cursor-pointer"
            title="Clear Formatting"
          >
            <RemoveFormatting className="w-3.5 h-3.5" />
          </button>

          {/* Separator */}
          <div className="w-[1px] h-5 bg-[#1e2c47] mx-0.5" />

          {/* Alignments */}
          <button
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              editor.isActive({ textAlign: 'left' })
                ? 'bg-blue-600 text-white'
                : 'hover:bg-[#1a2842] text-neutral-300 hover:text-white'
            }`}
            title="Align Left"
          >
            <AlignLeft className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              editor.isActive({ textAlign: 'center' })
                ? 'bg-blue-600 text-white'
                : 'hover:bg-[#1a2842] text-neutral-300 hover:text-white'
            }`}
            title="Align Center"
          >
            <AlignCenter className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              editor.isActive({ textAlign: 'right' })
                ? 'bg-blue-600 text-white'
                : 'hover:bg-[#1a2842] text-neutral-300 hover:text-white'
            }`}
            title="Align Right"
          >
            <AlignRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => editor.chain().focus().setTextAlign('justify').run()}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              editor.isActive({ textAlign: 'justify' })
                ? 'bg-blue-600 text-white'
                : 'hover:bg-[#1a2842] text-neutral-300 hover:text-white'
            }`}
            title="Justify"
          >
            <AlignJustify className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Lists & Indents */}
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
            editor.isActive('bulletList')
              ? 'bg-blue-600 text-white'
              : 'hover:bg-[#1a2842] text-neutral-300 hover:text-white'
          }`}
          title="Bulleted List"
        >
          <List className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
            editor.isActive('orderedList')
              ? 'bg-blue-600 text-white'
              : 'hover:bg-[#1a2842] text-neutral-300 hover:text-white'
          }`}
          title="Numbered List"
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </button>

        {/* Indents and line spacing (hidden on phones until expanded) */}
        <div className={secondary}>
          <button
            onClick={outdent}
            disabled={!editor.can().liftListItem('listItem')}
            className="p-1.5 rounded-lg hover:bg-[#1a2842] text-neutral-300 hover:text-white cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            title="Decrease Indent"
          >
            <Outdent className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={indent}
            disabled={!editor.can().sinkListItem('listItem')}
            className="p-1.5 rounded-lg hover:bg-[#1a2842] text-neutral-300 hover:text-white cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            title="Increase Indent"
          >
            <Indent className="w-3.5 h-3.5" />
          </button>

          {/* Line Spacing */}
          <div className="relative">
            <button
              onClick={() => setLineSpacingOpen(!lineSpacingOpen)}
              className="p-1.5 rounded-lg hover:bg-[#1a2842] text-neutral-300 hover:text-white cursor-pointer flex items-center gap-0.5"
              title="Line Spacing"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <ChevronDown className="w-2.5 h-2.5 text-neutral-500" />
            </button>
            {lineSpacingOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setLineSpacingOpen(false)} />
                <div className={`absolute top-full left-0 mt-1.5 w-28 bg-[#121929] border border-[#23334d] rounded-lg shadow-2xl py-1 z-40 ${MOBILE_POPOVER}`}>
                  {LINE_SPACINGS.map((v) => (
                    <button
                      key={v}
                      onClick={() => applyLineSpacing(v)}
                      className={`w-full px-3 py-1 text-left hover:bg-[#1a2842] flex items-center justify-between ${
                        currentLineHeight === v ? 'text-blue-400' : 'text-neutral-300'
                      }`}
                    >
                      <span>{v}</span>
                      {currentLineHeight === v && <Check className="w-3 h-3" />}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      editor.chain().focus().unsetLineHeight().run();
                      setLineSpacingOpen(false);
                    }}
                    className="w-full px-3 py-1 text-left hover:bg-[#1a2842] text-neutral-400 border-t border-[#1e2c47]"
                  >
                    Default
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Separator */}
          <div className="w-[1px] h-5 bg-[#1e2c47] mx-0.5" />
        </div>

        {/* Headings & Quote */}
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`px-2 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
            editor.isActive('heading', { level: 1 })
              ? 'bg-blue-600 text-white'
              : 'bg-[#18233a] hover:bg-[#1f2d48] text-blue-400'
          }`}
          title="Heading 1"
        >
          H1
        </button>

        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`px-2 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
            editor.isActive('heading', { level: 2 })
              ? 'bg-blue-600 text-white'
              : 'bg-[#18233a] hover:bg-[#1f2d48] text-blue-300'
          }`}
          title="Heading 2"
        >
          H2
        </button>

        {/* Quote, inserts and find (hidden on phones until expanded) */}
        <div className={secondary}>
          <button
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              editor.isActive('blockquote')
                ? 'bg-blue-600 text-white'
                : 'hover:bg-[#1a2842] text-neutral-300 hover:text-white'
            }`}
            title="Quote Block"
          >
            <Quote className="w-3.5 h-3.5" />
          </button>

          {/* Insert Elements */}
          <button
            onClick={onOpenTableDialog}
            className="p-1.5 rounded-lg hover:bg-[#1a2842] text-neutral-300 hover:text-white cursor-pointer"
            title="Insert Table"
          >
            <TableIcon className="w-3.5 h-3.5 text-blue-400" />
          </button>

          <button
            onClick={handleInsertImageByUrl}
            className="p-1.5 rounded-lg hover:bg-[#1a2842] text-neutral-300 hover:text-white cursor-pointer"
            title="Insert Image URL"
          >
            <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
          </button>

          <button
            onClick={handleInsertLink}
            className="p-1.5 rounded-lg hover:bg-[#1a2842] text-neutral-300 hover:text-white cursor-pointer"
            title="Insert Link"
          >
            <LinkIcon className="w-3.5 h-3.5 text-blue-400" />
          </button>

          <button
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            className="p-1.5 rounded-lg hover:bg-[#1a2842] text-neutral-400 hover:text-white cursor-pointer"
            title="Insert Divider"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onOpenFindReplace}
            className="p-1.5 rounded-lg hover:bg-[#1a2842] text-neutral-300 hover:text-white cursor-pointer"
            title="Find and Replace (Ctrl+F)"
          >
            <Search className="w-3.5 h-3.5 text-neutral-400" />
          </button>
        </div>

        {/* Phones: show / hide the secondary tool groups */}
        <button
          onClick={() => setShowAllTools(!showAllTools)}
          className={`md:hidden px-2 py-1 rounded-lg text-[11px] font-medium cursor-pointer flex items-center gap-1 transition-colors ${
            showAllTools ? 'bg-blue-600 text-white' : 'bg-[#18233a] hover:bg-[#1f2d48] text-neutral-300'
          }`}
          title={showAllTools ? 'Show fewer tools' : 'Show all formatting tools'}
          aria-expanded={showAllTools}
        >
          {showAllTools ? <ChevronUp className="w-3.5 h-3.5" /> : <MoreHorizontal className="w-3.5 h-3.5" />}
          <span>{showAllTools ? 'Less' : 'More'}</span>
        </button>
      </div>

      {/* Right: RAGSUITE Dictate Button */}
      <div className="relative flex items-center shrink-0 self-start">
        <div
          className={`flex items-stretch rounded-lg border transition-all ${
            isRecording
              ? 'bg-red-500/20 border-red-500/60 ring-2 ring-red-500/30'
              : isTranscribing
              ? 'bg-amber-500/20 border-amber-500/50'
              : 'bg-[#18233a] hover:bg-[#1e2b47] border-[#253552]'
          }`}
        >
          {/* Main Action */}
          <button
            onClick={onToggleDictation}
            disabled={isRequesting}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold cursor-pointer transition-colors ${
              isRecording
                ? 'text-red-400'
                : isTranscribing
                ? 'text-amber-400'
                : 'text-white hover:text-blue-400'
            }`}
            title={isRecording ? 'Click to stop dictating' : 'Click to start voice dictation'}
          >
            <div className="relative">
              <Mic
                className={`w-4 h-4 ${
                  isRecording
                    ? 'text-red-500 animate-pulse scale-110'
                    : isTranscribing
                    ? 'text-amber-400 animate-spin'
                    : 'text-blue-400'
                }`}
              />
              {isRecording && (
                <span className="absolute -top-1 -right-1 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
              )}
            </div>
            <span>
              {isRecording
                ? 'Recording...'
                : isTranscribing
                ? 'Transcribing...'
                : isRequesting
                ? 'Starting...'
                : 'Dictate'}
            </span>
          </button>

          {/* Chevron options */}
          <button
            onClick={() => setDictateDropdownOpen(!dictateDropdownOpen)}
            className="px-1.5 border-l border-[#253552] text-neutral-400 hover:text-white hover:bg-[#202f4e] cursor-pointer flex items-center justify-center transition-colors rounded-r-lg"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Dictate Dropdown Menu */}
        {dictateDropdownOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setDictateDropdownOpen(false)} />
            <div className="absolute top-full right-0 mt-1.5 w-64 max-w-[calc(100vw-1.5rem)] bg-[#121929] border border-[#23334d] rounded-lg shadow-2xl py-1.5 z-40 text-xs text-neutral-200">
              <div className="px-3 py-1 border-b border-[#1e2c47] flex items-center justify-between text-neutral-400">
                <span className="font-semibold text-white">Voice Dictation</span>
                <span className="text-[10px] text-blue-400 uppercase font-mono">
                  {dictationSettings.engine}
                </span>
              </div>

              {/* Language selection */}
              <div className="px-3 py-1.5 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                Language ({currentLang.label})
              </div>
              <div className="max-h-36 overflow-y-auto">
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      onUpdateDictationLanguage(lang.code);
                      setDictateDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-1.5 flex items-center justify-between hover:bg-[#1a2842] text-left transition-colors ${
                      dictationSettings.language === lang.code
                        ? 'text-blue-400 bg-blue-950/40 font-medium'
                        : 'text-neutral-300'
                    }`}
                  >
                    <span>
                      {lang.flag} {lang.label}
                    </span>
                    {dictationSettings.language === lang.code && (
                      <Check className="w-3.5 h-3.5 text-blue-400" />
                    )}
                  </button>
                ))}
              </div>

              <div className="border-t border-[#1e2c47] my-1" />

              <button
                onClick={() => {
                  setDictateDropdownOpen(false);
                  onOpenAudioUpload();
                }}
                className="w-full px-3 py-2 flex items-center gap-2 hover:bg-[#1a2842] text-neutral-300 hover:text-white"
              >
                <Upload className="w-3.5 h-3.5 text-neutral-400" />
                <span>Upload & Transcribe Audio File (Flask)...</span>
              </button>

              <button
                onClick={() => {
                  setDictateDropdownOpen(false);
                  onOpenDictationSettings();
                }}
                className="w-full px-3 py-2 flex items-center gap-2 hover:bg-[#1a2842] text-neutral-300 hover:text-white"
              >
                <Settings className="w-3.5 h-3.5 text-neutral-400" />
                <span>Dictation Settings & Engines...</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
