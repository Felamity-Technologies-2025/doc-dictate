import { Extension, Mark, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontStyle: {
      setFontFamily: (fontFamily: string) => ReturnType;
      unsetFontFamily: () => ReturnType;
      setFontSize: (fontSize: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
    lineHeight: {
      setLineHeight: (lineHeight: string) => ReturnType;
      unsetLineHeight: () => ReturnType;
    };
    subscript: {
      toggleSubscript: () => ReturnType;
    };
    superscript: {
      toggleSuperscript: () => ReturnType;
    };
  }
}

/** Font family + font size stored as attributes on the textStyle mark. */
export const FontStyle = Extension.create({
  name: 'fontStyle',

  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontFamily: {
            default: null,
            parseHTML: (el) => (el as HTMLElement).style.fontFamily?.replace(/['"]/g, '') || null,
            renderHTML: (attrs) =>
              attrs.fontFamily ? { style: `font-family: ${attrs.fontFamily}` } : {},
          },
          fontSize: {
            default: null,
            parseHTML: (el) => (el as HTMLElement).style.fontSize || null,
            renderHTML: (attrs) =>
              attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {},
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setFontFamily:
        (fontFamily) =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontFamily }).run(),
      unsetFontFamily:
        () =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontFamily: null }).removeEmptyTextStyle().run(),
      setFontSize:
        (fontSize) =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    };
  },
});

/** Paragraph/heading line spacing. */
export const LineHeight = Extension.create({
  name: 'lineHeight',

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (el) => (el as HTMLElement).style.lineHeight || null,
            renderHTML: (attrs) =>
              attrs.lineHeight ? { style: `line-height: ${attrs.lineHeight}` } : {},
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setLineHeight:
        (lineHeight) =>
        ({ commands }) =>
          ['paragraph', 'heading'].every((t) =>
            commands.updateAttributes(t, { lineHeight })
          ),
      unsetLineHeight:
        () =>
        ({ commands }) =>
          ['paragraph', 'heading'].every((t) =>
            commands.resetAttributes(t, 'lineHeight')
          ),
    };
  },
});

export const Subscript = Mark.create({
  name: 'subscript',
  excludes: 'superscript',
  parseHTML() {
    return [{ tag: 'sub' }, { style: 'vertical-align=sub' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['sub', mergeAttributes(HTMLAttributes), 0];
  },
  addCommands() {
    return {
      toggleSubscript:
        () =>
        ({ commands }) =>
          commands.toggleMark(this.name),
    };
  },
  addKeyboardShortcuts() {
    return { 'Mod-,': () => this.editor.commands.toggleSubscript() };
  },
});

export const Superscript = Mark.create({
  name: 'superscript',
  excludes: 'subscript',
  parseHTML() {
    return [{ tag: 'sup' }, { style: 'vertical-align=super' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['sup', mergeAttributes(HTMLAttributes), 0];
  },
  addCommands() {
    return {
      toggleSuperscript:
        () =>
        ({ commands }) =>
          commands.toggleMark(this.name),
    };
  },
  addKeyboardShortcuts() {
    return { 'Mod-.': () => this.editor.commands.toggleSuperscript() };
  },
});
