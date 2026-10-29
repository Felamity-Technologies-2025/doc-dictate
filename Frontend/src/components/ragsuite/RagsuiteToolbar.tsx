import React, { useEffect, useState } from 'react';
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
  ChevronDown,
  Settings,
  Undo2,
  Redo2,
  Scissors,
  Copy,
  ClipboardPaste,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  ArrowUpDown,
  PanelLeftClose,
  PanelLeftOpen,
  SlidersHorizontal,
  Plus,
  Settings2,
  X,
} from 'lucide-react';
interface RagsuiteToolbarProps {
  editor: Editor | null;
  onOpenTableDialog: () => void;
  onOpenFindReplace: () => void;
  /** Template fields; only passed while a template document is open */
  onAddField?: () => void;
  onManageFields?: () => void;
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

/** Default text color for all 6 headings ("Dark Blue, Accent 1, Darker 25%") */
const HEADING_COLOR = '#0f4761';

const TEXT_COLORS = [
  // Monochrome & Neutrals
  '#000000', '#1e293b', '#475569', '#64748b', '#94a3b8', '#cbd5e1', '#ffffff',
  // Blues & Teals (including Dark Blue, Accent 1, Darker 25%: #0f4761)
  '#0f4761', '#1e3a8a', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#06b6d4',
  // Greens & Emeralds
  '#064e3b', '#047857', '#10b981', '#34d399', '#6ee7b7', '#84cc16', '#a3e635',
  // Yellows, Ambers & Oranges
  '#78350f', '#b45309', '#d97706', '#f59e0b', '#fbbf24', '#ea580c', '#f97316',
  // Reds, Roses & Purples
  '#991b1b', '#dc2626', '#ef4444', '#f87171', '#e11d48', '#9333ea', '#c084fc',
];

const HIGHLIGHT_COLORS = [
  // Yellows & Ambers
  '#fef08a', '#fde047', '#facc15', '#fed7aa', '#fdba74', '#fb923c', '#ffedd5',
  // Greens & Mints
  '#bbf7d0', '#86efac', '#4ade80', '#22c55e', '#99f6e4', '#5eead4', '#dcfce7',
  // Blues, Cyans & Lavenders
  '#bae6fd', '#7dd3fc', '#38bdf8', '#c7d2fe', '#a5b4fc', '#ddd6fe', '#e0f2fe',
  // Pinks, Roses & Neutrals
  '#fbcfe8', '#f472b6', '#ec4899', '#fecdd3', '#fda4af', '#e2e8f0', '#cbd5e1',
];

const SELECT_CLASS =
  'bg-[#18233a] border border-[#23334d] hover:border-blue-500/50 text-white rounded-lg px-2 h-8 text-xs focus:outline-none cursor-pointer';

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
}

/**
 * Swatch palette plus a custom picker with RGB sliders/inputs, hex field and native color dialog.
 * Rendered inline in the sidebar (instead of floating) so the scrolling panel never clips it.
 */
const ColorPopover: React.FC<ColorPopoverProps> = ({
  colors,
  initial,
  columns,
  onPick,
  onClear,
  clearLabel = 'No color',
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
    <div className="bg-[#0f1626] border border-[#23334d] rounded-lg p-2 animate-in fade-in duration-150">
      <div className="grid gap-1 justify-items-center" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {colors.map((c) => (
          <button
            key={c}
            onClick={() => onPick(c)}
            style={{ backgroundColor: c }}
            title={c.toLowerCase() === HEADING_COLOR.toLowerCase() ? `Dark Blue, Accent 1, Darker 25% (${c})` : c}
            className="w-5 h-5 rounded-[4px] border border-white/20 hover:border-white/80 hover:scale-115 shadow-xs transition-all cursor-pointer"
          />
        ))}
      </div>
      {onClear && (
        <button
          onClick={onClear}
          className="mt-2 w-full text-left px-2 py-1 rounded hover:bg-[#1a2842] text-neutral-300 text-[11px]"
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
              className="flex-1 min-w-0 h-1 cursor-pointer"
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
            className="w-7 h-7 shrink-0 p-0 bg-transparent border border-[#23334d] rounded cursor-pointer"
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
            className="w-full min-w-0 flex-1 bg-[#18233a] border border-[#23334d] rounded px-1.5 py-1 text-white text-[11px] font-mono focus:outline-none"
          />
          <button
            onClick={() => onPick(toHex(...rgb))}
            className="shrink-0 px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold cursor-pointer"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};

interface ToolButtonProps {
  onClick: () => void;
  title: string;
  active?: boolean;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

/** Square icon button used throughout the sidebar; stretches to fill its grid cell. */
const ToolButton: React.FC<ToolButtonProps> = ({ onClick, title, active, disabled, className = '', children }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    aria-label={title}
    aria-pressed={active}
    className={`h-8 min-w-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
      active ? 'bg-blue-600 text-white' : 'text-neutral-300 hover:bg-[#1a2842] hover:text-white'
    } ${className}`}
  >
    {children}
  </button>
);

const ToolSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="py-3 border-t border-[#1e2c47] first:border-t-0 first:pt-1">
    <h3 className="mb-2 px-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#7082a4]">{title}</h3>
    <div className="flex flex-col gap-1.5">{children}</div>
  </section>
);

/**
 * Editing tools as a side bar.
 * - md and up: docked panel left of the document, collapsible to a slim rail.
 * - Phones: a compact quick bar (Tools, B/I/U) that opens the same panel as a slide-in drawer.
 */
export const RagsuiteToolbar: React.FC<RagsuiteToolbarProps> = ({
  editor,
  onOpenTableDialog,
  onOpenFindReplace,
  onAddField,
  onManageFields,
}) => {
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [highlightPickerOpen, setHighlightPickerOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Escape closes the phone drawer
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  if (!editor) return null;

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
  const textAlignments = [
    { value: 'left' as const, label: 'Align left', Icon: AlignLeft },
    { value: 'center' as const, label: 'Align center', Icon: AlignCenter },
    { value: 'right' as const, label: 'Align right', Icon: AlignRight },
    { value: 'justify' as const, label: 'Justify', Icon: AlignJustify },
  ];
  const currentTextAlignment =
    textAlignments.find(({ value }) => editor.isActive({ textAlign: value })) ??
    textAlignments[0];

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
    if (value) editor.chain().focus().setLineHeight(value).run();
    else editor.chain().focus().unsetLineHeight().run();
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

  // Dialogs open over the page, so the phone drawer gets out of the way first
  const openTableDialog = () => {
    setMobileOpen(false);
    onOpenTableDialog();
  };

  const openFindReplace = () => {
    setMobileOpen(false);
    onOpenFindReplace();
  };

  const addField = () => {
    setMobileOpen(false);
    onAddField?.();
  };

  const manageFields = () => {
    setMobileOpen(false);
    onManageFields?.();
  };

  const insertItems = [
    { label: 'Table', title: 'Insert Table', Icon: TableIcon, color: 'text-blue-400', onClick: openTableDialog },
    { label: 'Image', title: 'Insert Image URL', Icon: ImageIcon, color: 'text-emerald-400', onClick: handleInsertImageByUrl },
    { label: 'Link', title: 'Insert Link', Icon: LinkIcon, color: 'text-blue-400', onClick: handleInsertLink },
    { label: 'Divider', title: 'Insert Divider', Icon: Minus, color: 'text-neutral-400', onClick: () => editor.chain().focus().setHorizontalRule().run() },
  ];

  const boldButton = (
    <ToolButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold (Ctrl+B)">
      <Bold className="w-3.5 h-3.5" />
    </ToolButton>
  );
  const italicButton = (
    <ToolButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic (Ctrl+I)">
      <Italic className="w-3.5 h-3.5" />
    </ToolButton>
  );
  const underlineButton = (
    <ToolButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline (Ctrl+U)">
      <UnderlineIcon className="w-3.5 h-3.5" />
    </ToolButton>
  );

  const toolSections = (
    <>
      {/* Edit: history, clipboard, find */}
      <ToolSection title="Edit">
        <div className="grid grid-cols-6 gap-1">
          <ToolButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo (Ctrl+Z)">
            <Undo2 className="w-3.5 h-3.5" />
          </ToolButton>
          <ToolButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo (Ctrl+Y)">
            <Redo2 className="w-3.5 h-3.5" />
          </ToolButton>
          <ToolButton onClick={handlePaste} title="Paste (Ctrl+V)">
            <ClipboardPaste className="w-3.5 h-3.5" />
          </ToolButton>
          <ToolButton onClick={handleCut} title="Cut (Ctrl+X)">
            <Scissors className="w-3.5 h-3.5" />
          </ToolButton>
          <ToolButton onClick={handleCopy} title="Copy (Ctrl+C)">
            <Copy className="w-3.5 h-3.5" />
          </ToolButton>
          <ToolButton onClick={openFindReplace} title="Find and Replace (Ctrl+F)">
            <Search className="w-3.5 h-3.5 text-neutral-400" />
          </ToolButton>
        </div>
      </ToolSection>

      {/* Font family & size */}
      <ToolSection title="Font">
        <select
          value={currentFont}
          onChange={(e) => handleFontFamilyChange(e.target.value)}
          className={`${SELECT_CLASS} w-full`}
          title="Font Family"
        >
          <option value="">Default</option>
          {FONT_FAMILIES.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1">
          <select
            value={currentSize}
            onChange={(e) => handleFontSizeChange(e.target.value)}
            className={`${SELECT_CLASS} flex-1 min-w-0`}
            title="Font Size"
          >
            {!FONT_SIZES.includes(currentSize) && <option value={currentSize}>{currentSize} pt</option>}
            {FONT_SIZES.map((s) => (
              <option key={s} value={s}>
                {s} pt
              </option>
            ))}
          </select>
          <ToolButton onClick={() => stepFontSize(2)} title="Increase Font Size" className="text-[11px] font-bold">
            A<sup>+</sup>
          </ToolButton>
          <ToolButton onClick={() => stepFontSize(-2)} title="Decrease Font Size" className="text-[10px] font-bold">
            A<sup>-</sup>
          </ToolButton>
        </div>
      </ToolSection>

      {/* Character formatting & colors */}
      <ToolSection title="Text">
        <div className="grid grid-cols-6 gap-1">
          {boldButton}
          {italicButton}
          {underlineButton}
          <ToolButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough">
            <Strikethrough className="w-3.5 h-3.5" />
          </ToolButton>
          <ToolButton onClick={() => editor.chain().focus().toggleSubscript().run()} active={editor.isActive('subscript')} title="Subscript (Ctrl+,)">
            <SubscriptIcon className="w-3.5 h-3.5" />
          </ToolButton>
          <ToolButton onClick={() => editor.chain().focus().toggleSuperscript().run()} active={editor.isActive('superscript')} title="Superscript (Ctrl+.)">
            <SuperscriptIcon className="w-3.5 h-3.5" />
          </ToolButton>
        </div>
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => {
              setColorPickerOpen(!colorPickerOpen);
              setHighlightPickerOpen(false);
            }}
            className={`flex-1 h-7.5 px-2 rounded-lg border flex items-center gap-1.5 cursor-pointer transition-colors ${
              colorPickerOpen
                ? 'bg-[#1a2842] border-blue-500/50 text-white'
                : 'bg-[#18233a] border-[#23334d] text-neutral-300 hover:text-white hover:border-blue-500/50'
            }`}
            title="Text Color"
            aria-expanded={colorPickerOpen}
          >
            <Palette className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="w-2.5 h-2.5 rounded-[2px] border border-white/30 shrink-0" style={{ backgroundColor: currentTextColor }} />
            <span className="flex-1 text-left truncate text-xs">Color</span>
            <ChevronDown className={`w-2.5 h-2.5 text-neutral-500 transition-transform ${colorPickerOpen ? 'rotate-180' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => {
              setHighlightPickerOpen(!highlightPickerOpen);
              setColorPickerOpen(false);
            }}
            className={`flex-1 h-7.5 px-2 rounded-lg border flex items-center gap-1.5 cursor-pointer transition-colors ${
              highlightPickerOpen
                ? 'bg-[#1a2842] border-blue-500/50 text-white'
                : 'bg-[#18233a] border-[#23334d] text-neutral-300 hover:text-white hover:border-blue-500/50'
            }`}
            title="Highlight Text"
            aria-expanded={highlightPickerOpen}
          >
            <Highlighter className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="w-2.5 h-2.5 rounded-[2px] border border-white/30 shrink-0" style={{ backgroundColor: currentHighlight }} />
            <span className="flex-1 text-left truncate text-xs">Mark</span>
            <ChevronDown className={`w-2.5 h-2.5 text-neutral-500 transition-transform ${highlightPickerOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
        <button
          type="button"
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          className="h-8 w-full px-2 rounded-lg bg-[#18233a] hover:bg-[#1f2d48] border border-[#23334d] text-neutral-300 hover:text-white flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          title="Clear Formatting"
        >
          <RemoveFormatting className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
          <span className="truncate">Clear formatting</span>
        </button>
        {colorPickerOpen && (
          <ColorPopover
            colors={TEXT_COLORS}
            initial={currentTextColor}
            columns={7}
            onPick={applyTextColor}
            onClear={clearTextColor}
            clearLabel="Automatic (remove color)"
          />
        )}
        {highlightPickerOpen && (
          <ColorPopover
            colors={HIGHLIGHT_COLORS}
            initial={currentHighlight}
            columns={7}
            onPick={applyHighlight}
            onClear={clearHighlight}
            clearLabel="No highlight"
          />
        )}
      </ToolSection>

      {/* Alignment, lists, indents, spacing, headings */}
      <ToolSection title="Paragraph">
        {/* Text Alignment Row */}
        <div>
          <div className="text-[10px] text-neutral-400 mb-1 font-medium">Text Alignment</div>
          <div className="grid grid-cols-4 gap-1">
            {textAlignments.map(({ value, label, Icon }) => (
              <ToolButton
                key={value}
                onClick={() => editor.chain().focus().setTextAlign(value).run()}
                active={currentTextAlignment.value === value}
                title={label}
              >
                <Icon className="w-3.5 h-3.5" />
              </ToolButton>
            ))}
          </div>
        </div>

        {/* Lists & Indentation Row (Cleanly separated from text alignment) */}
        <div>
          <div className="text-[10px] text-neutral-400 mb-1 font-medium">Lists & Indent</div>
          <div className="grid grid-cols-4 gap-1">
            <ToolButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bulleted list">
              <List className="w-3.5 h-3.5" />
            </ToolButton>
            <ToolButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list">
              <ListOrdered className="w-3.5 h-3.5" />
            </ToolButton>
            <ToolButton onClick={outdent} disabled={!editor.can().liftListItem('listItem')} title="Decrease Indent">
              <Outdent className="w-3.5 h-3.5" />
            </ToolButton>
            <ToolButton onClick={indent} disabled={!editor.can().sinkListItem('listItem')} title="Increase Indent">
              <Indent className="w-3.5 h-3.5" />
            </ToolButton>
          </div>
        </div>

        {/* Line Spacing */}
        <div className="relative">
          <ArrowUpDown className="w-3.5 h-3.5 text-neutral-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          <select
            value={currentLineHeight}
            onChange={(e) => applyLineSpacing(e.target.value)}
            className={`${SELECT_CLASS} w-full pl-7`}
            title="Line Spacing"
          >
            <option value="">Default line spacing</option>
            {currentLineHeight && !LINE_SPACINGS.includes(currentLineHeight) && (
              <option value={currentLineHeight}>{currentLineHeight}</option>
            )}
            {LINE_SPACINGS.map((v) => (
              <option key={v} value={v}>
                {v}x spacing
              </option>
            ))}
          </select>
        </div>

        {/* Headings (All 6 levels + Normal text) & Quote */}
        <div className="flex items-center gap-1">
          <select
            value={
              ([1, 2, 3, 4, 5, 6] as const).find((level) =>
                editor.isActive('heading', { level })
              )?.toString() ?? 'p'
            }
            onChange={(event) => {
              const val = event.target.value;
              if (val === 'p') {
                editor.chain().focus().setParagraph().unsetColor().run();
              } else {
                const level = ([1, 2, 3, 4, 5, 6] as const).find(
                  (headingLevel) => String(headingLevel) === val
                );
                if (level) {
                  editor.chain().focus().setHeading({ level }).setColor(HEADING_COLOR).run();
                }
              }
            }}
            className={`${SELECT_CLASS} flex-1 min-w-0 font-medium`}
            title="Apply heading style or normal text"
            aria-label="Heading level"
          >
            <option value="p">Headings</option>
            {([1, 2, 3, 4, 5, 6] as const).map((level) => (
              <option key={level} value={level}>
                Heading {level}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`h-8 px-2.5 rounded-lg text-xs cursor-pointer transition-colors flex items-center justify-center gap-1 shrink-0 ${
              editor.isActive('blockquote')
                ? 'bg-blue-600 text-white'
                : 'bg-[#18233a] hover:bg-[#1f2d48] text-neutral-300'
            }`}
            title="Quote Block"
          >
            <Quote className="w-3.5 h-3.5" />
            <span>Quote</span>
          </button>
        </div>
      </ToolSection>

      {/* Insert elements */}
      <ToolSection title="Insert">
        <div className="grid grid-cols-4 gap-1">
          {insertItems.map(({ label, title, Icon, color, onClick }) => (
            <button
              key={label}
              type="button"
              onClick={onClick}
              title={title}
              className="h-12 rounded-lg bg-[#18233a] hover:bg-[#1f2d48] border border-transparent hover:border-[#23334d] text-neutral-300 hover:text-white cursor-pointer transition-colors flex flex-col items-center justify-center gap-1"
            >
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-[10px]">{label}</span>
            </button>
          ))}
        </div>
      </ToolSection>

      {/* Template fields */}
      {(onAddField || onManageFields) && (
        <ToolSection title="Fields">
          {onAddField && (
            <button
              type="button"
              onClick={addField}
              className="h-8 w-full px-2.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              title="Add your own field to this template"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Add Custom Field</span>
            </button>
          )}
          {onManageFields && (
            <button
              type="button"
              onClick={manageFields}
              className="h-8 w-full px-2.5 bg-[#18233a] hover:bg-[#1f2d48] border border-[#23334d] text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              title="Rename, reorder or remove fields"
            >
              <Settings2 className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              <span className="truncate">Manage Fields</span>
            </button>
          )}
        </ToolSection>
      )}
    </>
  );

  return (
    <>
      {/* Phones: quick bar with the most used tools; "Tools" opens the full side bar */}
      <div className="rag-toolbar md:hidden bg-[#121929] border border-[#1e2c47] rounded-xl px-2 py-1.5 flex items-center gap-1 text-xs text-neutral-300 select-none shadow-md shrink-0">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="h-8 px-2.5 rounded-lg bg-[#18233a] hover:bg-[#1f2d48] text-neutral-200 font-medium cursor-pointer flex items-center gap-1.5 shrink-0"
          title="Show all editing tools"
          aria-controls="rag-edit-tools"
          aria-expanded={mobileOpen}
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-blue-400" />
          <span className="max-[359px]:hidden">Tools</span>
        </button>
        <div className="w-[1px] h-5 bg-[#1e2c47] mx-0.5 shrink-0" />
        {boldButton}
        {italicButton}
        {underlineButton}
      </div>

      {/* Phones: backdrop behind the drawer */}
      <div
        className={`md:hidden fixed inset-0 z-40 bg-black/60 transition-opacity duration-200 ${
          mobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      {/* Edit tools side bar: drawer on phones, docked panel from md up */}
      <aside
        id="rag-edit-tools"
        aria-label="Edit tools"
        className={`rag-toolbar flex flex-col bg-[#121929] text-xs text-neutral-300 select-none
          fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] border-r border-[#1e2c47] shadow-2xl transition-transform duration-200 ease-out
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          md:relative md:inset-auto md:z-20 md:translate-none md:max-w-none md:shrink-0 md:border md:rounded-xl md:shadow-md md:transition-[width]
          ${collapsed ? 'md:w-12' : 'md:w-60'}`}
      >
        {/* Collapsed rail (md and up) */}
        {collapsed && (
          <div className="hidden md:flex flex-col items-center gap-2 py-3">
            <ToolButton onClick={() => setCollapsed(false)} title="Show edit tools">
              <PanelLeftOpen className="w-4 h-4" />
            </ToolButton>
          </div>
        )}

        {/* Full panel (always shown in the phone drawer) */}
        <div className={`flex-1 min-h-0 flex flex-col ${collapsed ? 'md:hidden' : ''}`}>
          {/* Header */}
          <div className="px-3 pt-3 pb-2.5 border-b border-[#1e2c47] flex flex-col gap-2.5 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-xs font-semibold text-white tracking-wide">
                <SlidersHorizontal className="w-3.5 h-3.5 text-blue-400" />
                Edit Tools
              </span>
              {/* Visibility sits on wrappers: the touch-screen rule in index.css sets display on toolbar buttons */}
              <div className="md:hidden">
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-[#1a2842] cursor-pointer"
                  title="Close edit tools"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="hidden md:block">
                <button
                  type="button"
                  onClick={() => {
                    setCollapsed(true);
                    setColorPickerOpen(false);
                    setHighlightPickerOpen(false);
                  }}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-[#1a2842] cursor-pointer"
                  title="Collapse edit tools"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Scrollable tool groups */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 pt-2 pb-3">{toolSections}</div>
        </div>
      </aside>
    </>
  );
};
