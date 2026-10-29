import { Node, type Editor, type JSONContent } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { TemplateField, TemplateFieldType, TemplateModel } from '../types';
import { templateImageUrl } from '../services/api';

export const TEMPLATE_FIELD_NODE = 'templateField';
export const TEMPLATE_TABLE_NODE = 'templateTable';
export const TEMPLATE_TABLE_ROW_NODE = 'templateTableRow';
export const TEMPLATE_TABLE_CELL_NODE = 'templateTableCell';
export const TEMPLATE_PAGE_NODE = 'templatePage';
export const TEMPLATE_IMAGE_NODE = 'templateImage';

// Padding of a template page as fractions of the page WIDTH (the DOCX / PDF export uses the same values)
const PAGE_PAD_X = 0.07;
const PAGE_PAD_TOP = 0.05;
const PAGE_PAD_BOTTOM = 0.06;
const CONTENT_WIDTH = 1 - 2 * PAGE_PAD_X;

export interface TemplateFieldAttrs {
  fieldId: string;
  heading: string;
  fieldType: TemplateFieldType;
  level: number;
  isCustom: boolean;
  /** Set on the column fields of a table-shaped group of headings */
  tableId: string | null;
  /** 'center' | 'right' as placed in the source document; null = left */
  align: string | null;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    templateField: {
      /** Put the cursor inside a field's content area (end by default) */
      focusTemplateField: (fieldId: string, where?: 'start' | 'end') => ReturnType;
      /** Move the cursor to the next (1) or previous (-1) field */
      goToAdjacentTemplateField: (direction: 1 | -1) => ReturnType;
      /** Add an empty row at the end of the template table located at `tablePos` */
      addTemplateTableRow: (tablePos: number) => ReturnType;
    };
  }
}

export function labelText(heading: string, fieldType: string, inTable = false): string {
  // Column headings of a table are shown as plain header cells, without a trailing colon
  if (fieldType === 'field' && !inTable && heading && !heading.endsWith(':')) return `${heading}:`;
  return heading;
}

const PLACEHOLDERS: Record<string, string> = {
  field: '[Enter content]',
  section: '[Enter content]',
  paragraph: '[Enter letter content]',
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
      align: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-align') || null,
        renderHTML: (attrs) => (attrs.align ? { 'data-align': attrs.align } : {}),
      },
      tableId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-table-id') || null,
        renderHTML: (attrs) => (attrs.tableId ? { 'data-table-id': attrs.tableId } : {}),
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
      ['div', { 'data-field-label': '', contenteditable: 'false' }, labelText(node.attrs.heading, node.attrs.fieldType, !!node.attrs.tableId)],
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
        const { fieldId, heading, fieldType, level, isCustom, tableId, align } = node.attrs as TemplateFieldAttrs;
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
        if (align) dom.setAttribute('data-align', align);
        else dom.removeAttribute('data-align');
        if (tableId) dom.setAttribute('data-table-id', tableId);
        else dom.removeAttribute('data-table-id');
        labelTextEl.textContent = labelText(heading, fieldType, !!tableId);
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
          // Stops in document order: every template field, plus the cells of rows added to tables
          const stops: { node: PMNode; pos: number }[] = [];
          tr.doc.descendants((node, pos) => {
            if (node.type.name === TEMPLATE_FIELD_NODE || node.type.name === TEMPLATE_TABLE_CELL_NODE) {
              stops.push({ node, pos });
              return false;
            }
            return true;
          });
          if (!stops.length) return false;
          const $from = tr.doc.resolve(state.selection.from);
          let index = -1;
          for (let depth = $from.depth; depth > 0 && index === -1; depth--) {
            const name = $from.node(depth).type.name;
            if (name === TEMPLATE_FIELD_NODE || name === TEMPLATE_TABLE_CELL_NODE) {
              const pos = $from.before(depth);
              index = stops.findIndex((stop) => stop.pos === pos);
            }
          }
          const target = stops[index + direction];
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

/**
 * The column fields of a table-shaped group of headings (e.g. Sl.No. | Date | Description | Remarks).
 * The fields are the header cells and the first row of content cells; further rows (added with the
 * "+" button under the table) follow as templateTableRow nodes with one cell per column.
 * Serialized as <div data-template-table> wrapping the field and row nodes, which the export reads as a real table.
 */
export const TemplateTableNode = Node.create({
  name: TEMPLATE_TABLE_NODE,
  group: 'block',
  content: 'templateField+ templateTableRow*',
  defining: true,
  isolating: true,
  selectable: false,
  draggable: false,

  parseHTML() {
    return [{ tag: 'div[data-template-table]' }];
  },

  renderHTML() {
    return ['div', { 'data-template-table': '', class: 'template-table' }, 0];
  },

  renderText({ node }) {
    return node.textContent;
  },

  addNodeView() {
    return ({ getPos, editor }) => {
      const dom = document.createElement('div');
      const grid = document.createElement('div');
      const addButton = document.createElement('button');

      dom.className = 'template-table-wrap';
      grid.className = 'template-table';
      addButton.type = 'button';
      addButton.className = 'template-table__add';
      addButton.contentEditable = 'false';
      addButton.textContent = '+';
      addButton.title = 'Add row';
      addButton.setAttribute('aria-label', 'Add row');
      dom.append(grid, addButton);

      // mousedown would move the editor selection away from the table before the click lands
      addButton.addEventListener('mousedown', (event) => event.preventDefault());
      addButton.addEventListener('click', (event) => {
        event.preventDefault();
        const pos = typeof getPos === 'function' ? getPos() : undefined;
        if (typeof pos === 'number') editor.chain().focus().addTemplateTableRow(pos).run();
      });

      return {
        dom,
        contentDOM: grid,
        update: (node) => node.type.name === TEMPLATE_TABLE_NODE,
        stopEvent: (event) => addButton.contains(event.target as globalThis.Node),
        ignoreMutation: (mutation) =>
          mutation.type !== 'selection' && !grid.contains(mutation.target as globalThis.Node),
      };
    };
  },

  addCommands() {
    return {
      /** Append an empty row (one cell per column) to the table at `tablePos` and put the cursor in it */
      addTemplateTableRow:
        (tablePos) =>
        ({ tr, state, dispatch }) => {
          const table = tr.doc.nodeAt(tablePos);
          if (!table || table.type.name !== TEMPLATE_TABLE_NODE) return false;
          const { nodes } = state.schema;
          const cells: PMNode[] = [];
          table.forEach((child) => {
            if (child.type.name === TEMPLATE_FIELD_NODE) {
              cells.push(nodes[TEMPLATE_TABLE_CELL_NODE].create({ columnId: child.attrs.fieldId }, nodes.paragraph.create()));
            }
          });
          const insertAt = tablePos + table.nodeSize - 1;
          if (dispatch) {
            tr.insert(insertAt, nodes[TEMPLATE_TABLE_ROW_NODE].create(null, cells));
            tr.setSelection(TextSelection.near(tr.doc.resolve(insertAt + 2), 1)).scrollIntoView();
          }
          return true;
        },
    };
  },
});

/** An added row of a template table */
export const TemplateTableRowNode = Node.create({
  name: TEMPLATE_TABLE_ROW_NODE,
  content: 'templateTableCell+',
  defining: true,
  isolating: true,
  selectable: false,
  draggable: false,

  parseHTML() {
    return [{ tag: 'div[data-template-table-row]' }];
  },

  renderHTML() {
    return ['div', { 'data-template-table-row': '', class: 'template-table-row' }, 0];
  },
});

/** One cell of an added row; `columnId` is the template field (column) it belongs to */
export const TemplateTableCellNode = Node.create({
  name: TEMPLATE_TABLE_CELL_NODE,
  content: 'block+',
  defining: true,
  isolating: true,
  selectable: false,
  draggable: false,

  addAttributes() {
    return {
      columnId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-column-id'),
        renderHTML: (attrs) => (attrs.columnId ? { 'data-column-id': attrs.columnId } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-template-table-cell]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', { ...HTMLAttributes, 'data-template-table-cell': '', class: 'template-table-cell' }, 0];
  },
});

/**
 * One page of the source document. Its content (headings, pictures) is laid out in page order; the sheet
 * keeps the source page's proportions and grows when more is typed than fits.
 * Serialized as <div data-template-page data-page data-width data-height> (size in points).
 */
export const TemplatePageNode = Node.create({
  name: TEMPLATE_PAGE_NODE,
  group: 'block',
  content: 'block+',
  defining: true,
  isolating: true,
  selectable: false,
  draggable: false,

  addAttributes() {
    return {
      page: {
        default: 1,
        parseHTML: (el) => parseInt(el.getAttribute('data-page') || '1', 10) || 1,
        renderHTML: (attrs) => ({ 'data-page': String(attrs.page) }),
      },
      width: {
        default: 612,
        parseHTML: (el) => parseFloat(el.getAttribute('data-width') || '612') || 612,
        renderHTML: (attrs) => ({ 'data-width': String(attrs.width) }),
      },
      height: {
        default: 792,
        parseHTML: (el) => parseFloat(el.getAttribute('data-height') || '792') || 792,
        renderHTML: (attrs) => ({ 'data-height': String(attrs.height) }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-template-page]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const { width, height } = node.attrs;
    return [
      'div',
      {
        ...HTMLAttributes,
        'data-template-page': '',
        class: 'template-page',
        // Percentage padding is relative to the page width, matching the export's margins
        style: `aspect-ratio: ${width} / ${height}; padding: ${PAGE_PAD_TOP * 100}% ${PAGE_PAD_X * 100}% ${PAGE_PAD_BOTTOM * 100}%`,
      },
      0,
    ];
  },
});

/**
 * A picture of the source document (logo, banner, signature...) at its horizontal position and size.
 * `x` / `w` are fractions of the page width, `h` and `gap` (space above it) fractions of the page height.
 */
export const TemplateImageNode = Node.create({
  name: TEMPLATE_IMAGE_NODE,
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    const num = (name: string, fallback: number) => ({
      default: fallback,
      parseHTML: (el: HTMLElement) => {
        const value = parseFloat(el.getAttribute(`data-${name}`) || '');
        return Number.isFinite(value) ? value : fallback;
      },
      renderHTML: (attrs: Record<string, number>) => ({ [`data-${name}`]: String(attrs[name]) }),
    });
    return {
      imageId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-image-id'),
        renderHTML: (attrs) => ({ 'data-image-id': attrs.imageId }),
      },
      templateId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-template-id'),
        renderHTML: (attrs) => ({ 'data-template-id': attrs.templateId }),
      },
      src: {
        default: '',
        parseHTML: (el) => el.getAttribute('src') || '',
        renderHTML: (attrs) => ({ src: attrs.src }),
      },
      x: num('x', PAGE_PAD_X),
      w: num('w', 0.2),
      h: num('h', 0.1),
      gap: num('gap', 0),
      // Page height / width, to turn `gap` into a width-relative CSS margin
      aspect: num('aspect', 792 / 612),
    };
  },

  parseHTML() {
    return [{ tag: 'img[data-template-image]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const { x, w, gap, aspect } = node.attrs;
    // Percentages of the page's content box (page width minus the side padding)
    const style = [
      `width: ${((w / CONTENT_WIDTH) * 100).toFixed(3)}%`,
      `margin-left: ${(((x - PAGE_PAD_X) / CONTENT_WIDTH) * 100).toFixed(3)}%`,
      `margin-top: ${(((gap * aspect) / CONTENT_WIDTH) * 100).toFixed(3)}%`,
    ].join('; ');
    return ['img', { ...HTMLAttributes, 'data-template-image': '', class: 'template-image', alt: '', draggable: 'false', style }];
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
      tableId: field.table_id ?? null,
      align: field.align ?? null,
    },
    content: content && content.length ? content : [{ type: 'paragraph' }],
  };
}

/**
 * Field nodes in template order; consecutive columns of the same table (two or more) are wrapped
 * in one table node. `contents` supplies already-typed content per field id.
 */
function templateBlocks(
  fields: TemplateField[],
  contents?: Map<string, JSONContent[]>,
  extraRows?: Map<string, Map<string, JSONContent[]>[]>
): JSONContent[] {
  const blocks: JSONContent[] = [];
  let i = 0;
  while (i < fields.length) {
    const tableId = fields[i].table_id;
    let end = i + 1;
    if (tableId) while (end < fields.length && fields[end].table_id === tableId) end++;
    const nodes = fields.slice(i, end).map((f) => fieldNodeJSON(f, contents?.get(f.id)));
    if (end - i >= 2) {
      const columns = fields.slice(i, end);
      const rows: JSONContent[] = (extraRows?.get(tableId as string) || []).map((row) => ({
        type: TEMPLATE_TABLE_ROW_NODE,
        content: columns.map((column) => {
          const cell = row.get(column.id);
          return {
            type: TEMPLATE_TABLE_CELL_NODE,
            attrs: { columnId: column.id },
            content: cell && cell.length ? cell : [{ type: 'paragraph' }],
          };
        }),
      }));
      blocks.push({ type: TEMPLATE_TABLE_NODE, content: [...nodes, ...rows] });
    }
    else blocks.push(nodes[0]);
    i = end;
  }
  return blocks;
}

/** Page geometry and pictures of a template (absent / null for templates without page layout) */
export type TemplateLayoutSource = Pick<TemplateModel, 'id' | 'page_count' | 'page_width' | 'page_height' | 'images'>;

function isPaged(template?: TemplateLayoutSource | null): template is TemplateLayoutSource {
  return !!template && !!template.page_count && !!template.page_width && !!template.page_height;
}

/** Page of each field: its own, else the page of the field before it (custom fields), else page 1 */
function fieldPages(fields: TemplateField[], pageCount: number): number[] {
  let current = 1;
  return fields.map((f) => {
    if (f.page && f.page >= 1) current = Math.min(f.page, pageCount);
    return current;
  });
}

/**
 * The template laid out page by page: each page holds its headings in template order with the
 * pictures of that page placed between them by vertical position.
 */
function pagedBlocks(
  fields: TemplateField[],
  template: TemplateLayoutSource,
  contents?: Map<string, JSONContent[]>,
  extraRows?: Map<string, Map<string, JSONContent[]>[]>
): JSONContent[] {
  const pageCount = template.page_count as number;
  const width = template.page_width as number;
  const height = template.page_height as number;
  const aspect = height / width;
  const topPad = (PAGE_PAD_TOP * width) / height; // top padding as a fraction of the page height
  const pages = fieldPages(fields, pageCount);
  const result: JSONContent[] = [];

  for (let page = 1; page <= pageCount; page++) {
    const pageFields = fields.filter((_, i) => pages[i] === page);
    const pending = (template.images || []).filter((img) => img.page === page).sort((a, b) => a.y - b.y || a.x - b.x);
    const content: JSONContent[] = [];
    let bottom = topPad; // lowest point used so far on the page (fraction of the height)
    let lastY = 0;
    let chunk: TemplateField[] = [];

    const flushFields = () => {
      if (chunk.length) content.push(...templateBlocks(chunk, contents, extraRows));
      chunk = [];
    };
    const placeImage = () => {
      const img = pending.shift()!;
      // Space above the picture; pictures in the top margin may rise into the page padding
      const gap = bottom <= topPad ? Math.max(img.y - topPad, -topPad) : Math.max(img.y - bottom, 0);
      content.push({
        type: TEMPLATE_IMAGE_NODE,
        attrs: {
          imageId: img.id, templateId: template.id, src: templateImageUrl(template.id, img.id),
          x: img.x, w: img.w, h: img.h, gap: Number(gap.toFixed(4)), aspect: Number(aspect.toFixed(4)),
        },
      });
      bottom = Math.max(bottom, img.y + img.h);
    };

    for (const field of pageFields) {
      const y = field.pos_y ?? lastY;
      lastY = y;
      if (pending.length && pending[0].y < y) {
        flushFields();
        while (pending.length && pending[0].y < y) placeImage();
      }
      chunk.push(field);
      bottom = Math.max(bottom, y + 0.03);
    }
    flushFields();
    while (pending.length) placeImage();

    result.push({
      type: TEMPLATE_PAGE_NODE,
      attrs: { page, width, height },
      content: content.length ? content : [{ type: 'paragraph' }],
    });
  }
  return result;
}

function documentBlocks(
  fields: TemplateField[],
  template?: TemplateLayoutSource | null,
  contents?: Map<string, JSONContent[]>,
  extraRows?: Map<string, Map<string, JSONContent[]>[]>
): JSONContent[] {
  return isPaged(template) ? pagedBlocks(fields, template, contents, extraRows) : templateBlocks(fields, contents, extraRows);
}

/**
 * A blank document with one empty content area per template field, in template order.
 * With a template that has page layout, the document has the same pages, pictures and placement.
 */
export function buildTemplateDocument(fields: TemplateField[], template?: TemplateLayoutSource | null): JSONContent {
  return { type: 'doc', content: documentBlocks(fields, template) };
}

/** Table id -> content of the rows added under that table (one map of column id -> content per row) */
function tableRowContents(editor: Editor): Map<string, Map<string, JSONContent[]>[]> {
  const map = new Map<string, Map<string, JSONContent[]>[]>();
  editor.state.doc.descendants((node) => {
    if (node.type.name === TEMPLATE_PAGE_NODE) return true;
    if (node.type.name !== TEMPLATE_TABLE_NODE) return false;
    const tableId = node.firstChild?.attrs.tableId as string | null | undefined;
    if (!tableId) return false;
    const rows: Map<string, JSONContent[]>[] = [];
    node.forEach((child) => {
      if (child.type.name !== TEMPLATE_TABLE_ROW_NODE) return;
      const row = new Map<string, JSONContent[]>();
      child.forEach((cell) => {
        if (cell.attrs.columnId) row.set(cell.attrs.columnId, (cell.toJSON().content as JSONContent[]) || []);
      });
      rows.push(row);
    });
    if (rows.length) map.set(tableId, rows);
    return false;
  });
  return map;
}

/** Field id -> body content of every template field in the editor */
function fieldContents(editor: Editor): Map<string, JSONContent[]> {
  const map = new Map<string, JSONContent[]>();
  for (const { node } of findTemplateFields(editor.state.doc)) {
    if (node.attrs.fieldId) map.set(node.attrs.fieldId, (node.toJSON().content as JSONContent[]) || []);
  }
  return map;
}

/** Page number (attrs.page of the enclosing page node) of the node at `pos`, or null */
function pageAt(doc: PMNode, pos: number): number | null {
  const $pos = doc.resolve(pos);
  for (let depth = $pos.depth; depth > 0; depth--) {
    if ($pos.node(depth).type.name === TEMPLATE_PAGE_NODE) return $pos.node(depth).attrs.page as number;
  }
  return null;
}

export function isTemplateDocument(editor: Editor | null): boolean {
  return !!editor && findTemplateFields(editor.state.doc).length > 0;
}

export function documentFieldIds(editor: Editor | null): string[] {
  if (!editor) return [];
  return findTemplateFields(editor.state.doc).map((f) => f.node.attrs.fieldId as string);
}

/**
 * True when the document's fields (ids, names, types, nesting, order) match the template definition.
 * With `template`, the page each field is on must match too.
 */
export function documentMatchesTemplate(
  editor: Editor | null,
  fields: TemplateField[],
  template?: TemplateLayoutSource | null
): boolean {
  if (!editor) return true;
  const nodes = findTemplateFields(editor.state.doc);
  if (nodes.length !== fields.length) return false;
  const pages = isPaged(template) ? fieldPages(fields, template.page_count as number) : null;
  return nodes.every(({ node, pos }, i) => {
    const f = fields[i];
    const a = node.attrs as TemplateFieldAttrs;
    return (
      a.fieldId === f.id && a.heading === f.heading && a.fieldType === f.field_type &&
      a.level === f.level && a.isCustom === f.is_custom && (a.tableId ?? null) === (f.table_id ?? null) &&
      (a.align ?? null) === (f.align ?? null) &&
      (!template || pageAt(editor.state.doc, pos) === (pages ? pages[i] : null))
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

const STRUCTURE_NODES = [TEMPLATE_FIELD_NODE, TEMPLATE_TABLE_NODE, TEMPLATE_PAGE_NODE, TEMPLATE_IMAGE_NODE];

/**
 * Rebuild the open document so its fields match `fields` (order, names, nesting, pages),
 * keeping everything already typed into fields that still exist. Fields that are
 * no longer in the template are dropped; content outside fields is kept at the end.
 */
export function syncTemplateDocument(
  editor: Editor,
  fields: TemplateField[],
  template?: TemplateLayoutSource | null
): void {
  const contents = fieldContents(editor);
  const extraRows = tableRowContents(editor);
  const activeId = getActiveTemplateField(editor)?.fieldId;
  const loose: JSONContent[] = [];
  const collectLoose = (node: PMNode) => {
    if (node.type.name === TEMPLATE_PAGE_NODE) node.forEach(collectLoose);
    else if (!STRUCTURE_NODES.includes(node.type.name) && node.textContent.trim()) loose.push(node.toJSON());
  };
  editor.state.doc.forEach(collectLoose);

  const blocks = documentBlocks(fields, template, contents, extraRows);
  const last = blocks[blocks.length - 1];
  if (loose.length && last?.type === TEMPLATE_PAGE_NODE) {
    // Typed text outside the fields stays in the document, on the last page
    const kept = (last.content || []).filter((n) => !(n.type === 'paragraph' && !n.content));
    last.content = [...kept, ...loose];
  } else {
    blocks.push(...loose);
  }
  editor.chain().setContent({ type: 'doc', content: blocks }).run();
  if (activeId && fields.some((f) => f.id === activeId)) {
    editor.commands.focusTemplateField(activeId);
  }
}

/** Empty every field's content, keeping the template structure (pages, pictures, headings) */
export function clearTemplateFields(editor: Editor): void {
  const blank = (node: PMNode): JSONContent => ({
    type: TEMPLATE_FIELD_NODE, attrs: { ...node.attrs }, content: [{ type: 'paragraph' }],
  });
  const clear = (node: PMNode): JSONContent | null => {
    switch (node.type.name) {
      case TEMPLATE_TABLE_NODE: {
        const columns: JSONContent[] = [];
        node.forEach((column) => {
          if (column.type.name === TEMPLATE_FIELD_NODE) columns.push(blank(column));
        });
        return { type: TEMPLATE_TABLE_NODE, content: columns };
      }
      case TEMPLATE_FIELD_NODE:
        return blank(node);
      case TEMPLATE_IMAGE_NODE:
        return node.toJSON();
      case TEMPLATE_PAGE_NODE: {
        const children: JSONContent[] = [];
        node.forEach((child) => {
          const cleared = clear(child);
          if (cleared) children.push(cleared);
        });
        return { type: TEMPLATE_PAGE_NODE, attrs: { ...node.attrs }, content: children.length ? children : [{ type: 'paragraph' }] };
      }
      default:
        return null;
    }
  };
  const doc: JSONContent = { type: 'doc', content: [] };
  editor.state.doc.forEach((node) => {
    const cleared = clear(node);
    if (cleared) doc.content!.push(cleared);
  });
  editor.chain().setContent(doc).run();
}
