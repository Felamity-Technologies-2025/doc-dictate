import { Node, type Editor, type JSONContent } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { TemplateField, TemplateFieldType } from '../types';

export const TEMPLATE_FIELD_NODE = 'templateField';

export interface TemplateFieldAttrs {
  fieldId: string;
  heading: string;
  fieldType: TemplateFieldType;
  level: number;
  isCustom: boolean;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    templateField: {
      /** Put the cursor inside a field's content area (end by default) */
      focusTemplateField: (fieldId: string, where?: 'start' | 'end') => ReturnType;
      /** Move the cursor to the next (1) or previous (-1) field */
      goToAdjacentTemplateField: (direction: 1 | -1) => ReturnType;
    };
  }
}

export function labelText(heading: string, fieldType: string): string {
  if (fieldType === 'field' && heading && !heading.endsWith(':')) return `${heading}:`;
  return heading;
}

const PLACEHOLDERS: Record<string, string> = {
  field: '[Enter content here]',
  section: '[Enter content here]',
  paragraph: '[Enter letter content here]',
};

/** All template field nodes with their document positions, in order */
export function findTemplateFields(doc: PMNode): { node: PMNode; pos: number }[] {
  const found: { node: PMNode; pos: number }[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === TEMPLATE_FIELD_NODE) {
      found.push({ node, pos });
      return false;
    }
    return true;
  });
  return found;
}

function fieldAtSelection(doc: PMNode, from: number): { node: PMNode; pos: number } | null {
  const $from = doc.resolve(from);
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type.name === TEMPLATE_FIELD_NODE) return { node, pos: $from.before(depth) };
  }
  return null;
}

const activeFieldKey = new PluginKey('activeTemplateField');

/**
 * A template heading/label with an editable content area. The label is not editable
 * and not part of the document text; typing and dictation go into the body.
 * Serialized as:
 *   <div data-template-field data-field-id data-heading data-field-type data-level data-custom>
 *     <div data-field-label contenteditable="false">From:</div>
 *     <div data-field-body>...content...</div>
 *   </div>
 */
export const TemplateFieldNode = Node.create({
  name: TEMPLATE_FIELD_NODE,
  group: 'block',
  content: 'block+',
  defining: true,
  isolating: true,
  selectable: false,
  draggable: false,

  addAttributes() {
    return {
      fieldId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-field-id'),
        renderHTML: (attrs) => ({ 'data-field-id': attrs.fieldId }),
      },
      heading: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-heading') || '',
        renderHTML: (attrs) => ({ 'data-heading': attrs.heading }),
      },
      fieldType: {
        default: 'field',
        parseHTML: (el) => el.getAttribute('data-field-type') || 'field',
        renderHTML: (attrs) => ({ 'data-field-type': attrs.fieldType }),
      },
      level: {
        default: 1,
        parseHTML: (el) => Math.max(1, parseInt(el.getAttribute('data-level') || '1', 10) || 1),
        renderHTML: (attrs) => ({ 'data-level': String(attrs.level) }),
      },
      isCustom: {
        default: false,
        parseHTML: (el) => el.getAttribute('data-custom') === 'true',
        renderHTML: (attrs) => ({ 'data-custom': attrs.isCustom ? 'true' : 'false' }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-template-field]',
        contentElement: (el: HTMLElement) =>
          (el.querySelector(':scope > [data-field-body]') as HTMLElement | null) || el,
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      { ...HTMLAttributes, 'data-template-field': '', class: 'template-field' },
      ['div', { 'data-field-label': '', contenteditable: 'false' }, labelText(node.attrs.heading, node.attrs.fieldType)],
      ['div', { 'data-field-body': '' }, 0],
    ];
  },

  renderText({ node }) {
    return node.textContent;
  },

  addNodeView() {
    return ({ node: initialNode, getPos, editor }) => {
      const dom = document.createElement('div');
      const label = document.createElement('div');
      const labelTextEl = document.createElement('span');
      const badge = document.createElement('span');
      const body = document.createElement('div');

      dom.setAttribute('data-template-field', '');
      label.setAttribute('data-field-label', '');
      label.contentEditable = 'false';
      badge.className = 'template-field__badge';
      badge.textContent = 'Custom';
      body.setAttribute('data-field-body', '');
      label.append(labelTextEl, badge);
      dom.append(label, body);

      const apply = (node: PMNode) => {
        const { fieldId, heading, fieldType, level, isCustom } = node.attrs as TemplateFieldAttrs;
        // classList (not className) so ProseMirror's decoration classes such as is-active-field survive
        dom.classList.add('template-field');
        for (const type of ['field', 'section', 'paragraph']) {
          dom.classList.toggle(`template-field--${type}`, type === fieldType);
        }
        dom.setAttribute('data-field-id', fieldId || '');
        dom.setAttribute('data-heading', heading);
        dom.setAttribute('data-field-type', fieldType);
        dom.setAttribute('data-level', String(level));
        dom.setAttribute('data-custom', isCustom ? 'true' : 'false');
        dom.style.marginLeft = level > 1 ? `${(level - 1) * 1.25}rem` : '';
        labelTextEl.textContent = labelText(heading, fieldType);
        badge.style.display = isCustom ? '' : 'none';
        // Read by the empty-paragraph placeholder rule in index.css
        body.style.setProperty('--field-placeholder', JSON.stringify(PLACEHOLDERS[fieldType] || PLACEHOLDERS.field));
      };
      apply(initialNode);

      // Clicking a label moves the cursor into that field's content
      label.addEventListener('mousedown', (event) => {
        event.preventDefault();
        const pos = typeof getPos === 'function' ? getPos() : undefined;
        if (typeof pos !== 'number') return;
        const current = editor.state.doc.nodeAt(pos);
        if (!current) return;
        const selection = TextSelection.near(editor.state.doc.resolve(pos + current.nodeSize - 1), -1);
        editor.view.dispatch(editor.state.tr.setSelection(selection).scrollIntoView());
        editor.view.focus();
      });

      return {
        dom,
        contentDOM: body,
        update: (node) => {
          if (node.type.name !== TEMPLATE_FIELD_NODE) return false;
          apply(node);
          return true;
        },
        stopEvent: (event) => label.contains(event.target as globalThis.Node),
        ignoreMutation: (mutation) =>
          mutation.type !== 'selection' && !body.contains(mutation.target as globalThis.Node),
      };
    };
  },

  addCommands() {
    return {
      focusTemplateField:
        (fieldId, where = 'end') =>
        ({ tr, dispatch }) => {
          const match = findTemplateFields(tr.doc).find((f) => f.node.attrs.fieldId === fieldId);
          if (!match) return false;
          const selection =
            where === 'start'
              ? TextSelection.near(tr.doc.resolve(match.pos + 1), 1)
              : TextSelection.near(tr.doc.resolve(match.pos + match.node.nodeSize - 1), -1);
          if (dispatch) tr.setSelection(selection).scrollIntoView();
          return true;
        },
      goToAdjacentTemplateField:
        (direction) =>
        ({ tr, state, dispatch }) => {
          const fields = findTemplateFields(tr.doc);
          if (!fields.length) return false;
          const current = fieldAtSelection(tr.doc, state.selection.from);
          const index = current ? fields.findIndex((f) => f.pos === current.pos) : -1;
          const target = fields[index + direction];
          if (!target) return false;
          const selection = TextSelection.near(tr.doc.resolve(target.pos + target.node.nodeSize - 1), -1);
          if (dispatch) tr.setSelection(selection).scrollIntoView();
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    // Lists and tables register their own Tab handling first; this runs when they don't apply
    return {
      Tab: () => this.editor.commands.goToAdjacentTemplateField(1),
      'Shift-Tab': () => this.editor.commands.goToAdjacentTemplateField(-1),
    };
  },

  addProseMirrorPlugins() {
    // Highlight the field that holds the cursor (where typing and dictation will go)
    return [
      new Plugin({
        key: activeFieldKey,
        props: {
          decorations: (state) => {
            const active = fieldAtSelection(state.doc, state.selection.from);
            if (!active) return DecorationSet.empty;
            return DecorationSet.create(state.doc, [
              Decoration.node(active.pos, active.pos + active.node.nodeSize, { class: 'is-active-field' }),
            ]);
          },
        },
      }),
    ];
  },
});

// ---------------------------------------------------------------------------
// Helpers used by the app
// ---------------------------------------------------------------------------

function fieldNodeJSON(field: TemplateField, content?: JSONContent[]): JSONContent {
  return {
    type: TEMPLATE_FIELD_NODE,
    attrs: {
      fieldId: field.id,
      heading: field.heading,
      fieldType: field.field_type,
      level: field.level,
      isCustom: field.is_custom,
    },
    content: content && content.length ? content : [{ type: 'paragraph' }],
  };
}

/** A blank document with one empty content area per template field, in template order */
export function buildTemplateDocument(fields: TemplateField[]): JSONContent {
  return { type: 'doc', content: fields.map((field) => fieldNodeJSON(field)) };
}

/** Field id -> body content of every template field in the editor */
function fieldContents(editor: Editor): Map<string, JSONContent[]> {
  const map = new Map<string, JSONContent[]>();
  for (const { node } of findTemplateFields(editor.state.doc)) {
    if (node.attrs.fieldId) map.set(node.attrs.fieldId, (node.toJSON().content as JSONContent[]) || []);
  }
  return map;
}

export function isTemplateDocument(editor: Editor | null): boolean {
  return !!editor && findTemplateFields(editor.state.doc).length > 0;
}

export function documentFieldIds(editor: Editor | null): string[] {
  if (!editor) return [];
  return findTemplateFields(editor.state.doc).map((f) => f.node.attrs.fieldId as string);
}

/** True when the document's fields (ids, names, types, nesting, order) match the template definition */
export function documentMatchesTemplate(editor: Editor | null, fields: TemplateField[]): boolean {
  if (!editor) return true;
  const nodes = findTemplateFields(editor.state.doc);
  if (nodes.length !== fields.length) return false;
  return nodes.every(({ node }, i) => {
    const f = fields[i];
    const a = node.attrs as TemplateFieldAttrs;
    return (
      a.fieldId === f.id && a.heading === f.heading && a.fieldType === f.field_type &&
      a.level === f.level && a.isCustom === f.is_custom
    );
  });
}

/** Fields present in the document but not in `fields`, which still contain text */
export function fieldsWithContentMissingFrom(editor: Editor | null, fields: TemplateField[]): string[] {
  if (!editor) return [];
  const keep = new Set(fields.map((f) => f.id));
  return findTemplateFields(editor.state.doc)
    .filter(({ node }) => !keep.has(node.attrs.fieldId) && node.textContent.trim())
    .map(({ node }) => node.attrs.heading as string);
}

/** True when the field exists in the editor and has any text */
export function fieldHasContent(editor: Editor | null, fieldId: string): boolean {
  if (!editor) return false;
  const match = findTemplateFields(editor.state.doc).find((f) => f.node.attrs.fieldId === fieldId);
  return !!match && match.node.textContent.trim().length > 0;
}

/** Attributes of the field holding the cursor, if any */
export function getActiveTemplateField(editor: Editor | null): TemplateFieldAttrs | null {
  if (!editor) return null;
  const active = fieldAtSelection(editor.state.doc, editor.state.selection.from);
  return active ? (active.node.attrs as TemplateFieldAttrs) : null;
}

/**
 * Rebuild the open document so its fields match `fields` (order, names, nesting),
 * keeping everything already typed into fields that still exist. Fields that are
 * no longer in the template are dropped; content outside fields is kept at the end.
 */
export function syncTemplateDocument(editor: Editor, fields: TemplateField[]): void {
  const contents = fieldContents(editor);
  const activeId = getActiveTemplateField(editor)?.fieldId;
  const loose: JSONContent[] = [];
  editor.state.doc.forEach((node) => {
    if (node.type.name !== TEMPLATE_FIELD_NODE && node.textContent.trim()) loose.push(node.toJSON());
  });

  const doc: JSONContent = {
    type: 'doc',
    content: [...fields.map((field) => fieldNodeJSON(field, contents.get(field.id))), ...loose],
  };
  editor.chain().setContent(doc).run();
  if (activeId && fields.some((f) => f.id === activeId)) {
    editor.commands.focusTemplateField(activeId);
  }
}

/** Empty every field's content, keeping the template structure */
export function clearTemplateFields(editor: Editor): void {
  const doc: JSONContent = { type: 'doc', content: [] };
  for (const { node } of findTemplateFields(editor.state.doc)) {
    doc.content!.push({ type: TEMPLATE_FIELD_NODE, attrs: { ...node.attrs }, content: [{ type: 'paragraph' }] });
  }
  editor.chain().setContent(doc).run();
}
