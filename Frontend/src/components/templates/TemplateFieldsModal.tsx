import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, Check, ListPlus, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { ApiService } from '../../services/api';
import { TemplateField, TemplateFieldType, TemplateModel } from '../../types';

interface TemplateFieldsModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: TemplateModel;
  /** Receives the updated template after every saved change */
  onTemplateChange: (template: TemplateModel) => void;
  /** Whether the open document has content typed into this field */
  fieldHasContent: (fieldId: string) => boolean;
  /** Focus the "add field" form when opened from the Add Custom Field button */
  focusAdd?: boolean;
}

const FIELD_TYPE_OPTIONS: { value: TemplateFieldType; label: string; hint: string }[] = [
  { value: 'field', label: 'Field', hint: 'Short label + value (e.g. Employee ID)' },
  { value: 'section', label: 'Section', hint: 'Heading that introduces a block of content' },
  { value: 'paragraph', label: 'Paragraph', hint: 'Free-text area; its name is not printed on export' },
];

const END = '__end__';
const TOP_LEVEL = '';

export const TemplateFieldsModal: React.FC<TemplateFieldsModalProps> = ({
  isOpen,
  onClose,
  template,
  onTemplateChange,
  fieldHasContent,
  focusAdd,
}) => {
  const [heading, setHeading] = useState('');
  const [fieldType, setFieldType] = useState<TemplateFieldType>('field');
  const [afterFieldId, setAfterFieldId] = useState<string>(END);
  const [parentFieldId, setParentFieldId] = useState<string>(TOP_LEVEL);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setEditingId(null);
      if (focusAdd) setTimeout(() => addInputRef.current?.focus(), 50);
    }
  }, [isOpen, focusAdd]);

  if (!isOpen) return null;

  const fields = template.fields;

  const run = async (key: string, action: () => Promise<TemplateModel>): Promise<TemplateModel | null> => {
    setBusy(key);
    setError(null);
    try {
      const updated = await action();
      onTemplateChange(updated);
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setBusy(null);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = heading.trim();
    if (!name) return;
    const previousIds = new Set(fields.map((f) => f.id));
    const updated = await run('add', () =>
      ApiService.addTemplateField(template.id, {
        heading: name,
        field_type: fieldType,
        after_field_id: afterFieldId === END ? null : afterFieldId,
        parent_field_id: parentFieldId || null,
      })
    );
    if (updated) {
      setHeading('');
      // Keep consecutive additions in the order they were entered
      if (afterFieldId !== END) {
        const added = updated.fields.find((f) => !previousIds.has(f.id));
        if (added) setAfterFieldId(added.id);
      }
      addInputRef.current?.focus();
    }
  };

  const handleRename = async (field: TemplateField) => {
    const name = editValue.trim();
    if (!name || name === field.heading) {
      setEditingId(null);
      return;
    }
    const ok = await run(field.id, () => ApiService.updateTemplateField(template.id, field.id, { heading: name }));
    if (ok) setEditingId(null);
  };

  const handleMove = (field: TemplateField, delta: -1 | 1) =>
    run(field.id, () =>
      ApiService.updateTemplateField(template.id, field.id, { position: field.field_order + delta })
    );

  const handleType = (field: TemplateField, value: TemplateFieldType) =>
    run(field.id, () => ApiService.updateTemplateField(template.id, field.id, { field_type: value }));

  const handleRemove = async (field: TemplateField) => {
    const hasContent = fieldHasContent(field.id);
    const message =
      `Remove "${field.heading}" from the template "${template.template_name}"?` +
      (hasContent ? '\n\nThe text typed into this field in the open document will be removed too.' : '') +
      '\n\nPreviously saved documents keep their content.';
    if (!window.confirm(message)) return;
    await run(field.id, () => ApiService.deleteTemplateField(template.id, field.id));
  };

  const sections = fields.filter((f) => f.field_type === 'section');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-4">
      <div className="bg-[#0f172a] rounded-xl shadow-2xl border border-[#1e2c47] w-full max-w-xl max-h-[calc(100dvh-1.5rem)] flex flex-col overflow-hidden animate-in fade-in duration-150">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1e2c47] bg-[#0c1222] shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <ListPlus className="w-5 h-5 text-blue-400 shrink-0" />
            <h3 className="font-semibold text-white text-sm truncate">Fields of "{template.template_name}"</h3>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white p-1 rounded-sm cursor-pointer" title="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Add custom field */}
          <form onSubmit={handleAdd} className="border border-[#1e2c47] rounded-lg bg-[#131b2e] p-3.5 space-y-2.5">
            <div className="text-xs font-semibold text-white">Add custom field</div>
            <div className="flex gap-2">
              <input
                ref={addInputRef}
                value={heading}
                onChange={(e) => setHeading(e.target.value)}
                placeholder="Field name, e.g. Employee ID"
                maxLength={200}
                className="flex-1 min-w-0 bg-[#18233a] border border-[#23334d] focus:border-blue-500/60 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
              />
              <button
                type="submit"
                disabled={!heading.trim() || busy === 'add'}
                className="px-3 py-1.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                {busy === 'add' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Add Field
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
              <label className="flex flex-col gap-1 text-neutral-400">
                Type
                <select
                  value={fieldType}
                  onChange={(e) => setFieldType(e.target.value as TemplateFieldType)}
                  className="bg-[#18233a] border border-[#23334d] rounded-md px-2 py-1 text-xs text-white focus:outline-none cursor-pointer"
                  title={FIELD_TYPE_OPTIONS.find((o) => o.value === fieldType)?.hint}
                >
                  {FIELD_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value} title={o.hint}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-neutral-400">
                Position
                <select
                  value={afterFieldId}
                  onChange={(e) => setAfterFieldId(e.target.value)}
                  className="bg-[#18233a] border border-[#23334d] rounded-md px-2 py-1 text-xs text-white focus:outline-none cursor-pointer"
                >
                  <option value={END}>{parentFieldId ? 'End of the section' : 'At the end'}</option>
                  {fields.map((f) => (
                    <option key={f.id} value={f.id}>
                      After: {f.heading}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-neutral-400">
                Nested under
                <select
                  value={parentFieldId}
                  onChange={(e) => setParentFieldId(e.target.value)}
                  className="bg-[#18233a] border border-[#23334d] rounded-md px-2 py-1 text-xs text-white focus:outline-none cursor-pointer"
                >
                  <option value={TOP_LEVEL}>None (top level)</option>
                  {sections.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.heading}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </form>

          {error && (
            <div className="p-2.5 bg-red-950/40 text-red-300 border border-red-800/50 rounded-lg text-[11px] flex gap-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Field list */}
          <div className="divide-y divide-[#1e2c47] border border-[#1e2c47] rounded-lg bg-[#131b2e]">
            {fields.map((field, index) => {
              const isBusy = busy === field.id;
              return (
                <div
                  key={field.id}
                  className="py-2 pr-2 flex items-center gap-2 text-xs"
                  style={{ paddingLeft: `${0.75 + (field.level - 1) * 1.1}rem` }}
                >
                  <span className="text-[10px] text-neutral-500 w-5 text-right shrink-0">{field.field_order}.</span>

                  {editingId === field.id ? (
                    <input
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => handleRename(field)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(field);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      maxLength={200}
                      className="flex-1 min-w-0 bg-[#18233a] border border-blue-500/60 rounded-md px-2 py-0.5 text-xs text-white focus:outline-none"
                    />
                  ) : (
                    <span className="flex-1 min-w-0 truncate text-neutral-100" title={field.heading}>
                      {field.heading}
                    </span>
                  )}

                  <span
                    className={`text-[9px] uppercase tracking-wide rounded-full px-1.5 border shrink-0 ${
                      field.is_custom
                        ? 'text-emerald-400 border-emerald-500/40'
                        : 'text-neutral-400 border-neutral-600/60'
                    }`}
                    title={field.is_custom ? 'Added by you' : 'Extracted from the PDF by the LLM'}
                  >
                    {field.is_custom ? 'Custom' : 'Extracted'}
                  </span>

                  <select
                    value={field.field_type}
                    onChange={(e) => handleType(field, e.target.value as TemplateFieldType)}
                    disabled={isBusy}
                    className="bg-[#18233a] border border-[#23334d] rounded-md px-1 py-0.5 text-[11px] text-neutral-200 focus:outline-none cursor-pointer shrink-0"
                    title="Field type"
                  >
                    {FIELD_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center shrink-0">
                    {isBusy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400 mx-1.5" />
                    ) : (
                      <>
                        <button
                          onClick={() => handleMove(field, -1)}
                          disabled={index === 0 || !!busy}
                          className="p-1 text-neutral-400 hover:text-white rounded cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed"
                          title="Move up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleMove(field, 1)}
                          disabled={index === fields.length - 1 || !!busy}
                          className="p-1 text-neutral-400 hover:text-white rounded cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed"
                          title="Move down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        {editingId === field.id ? (
                          <button
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => handleRename(field)}
                            className="p-1 text-emerald-400 hover:bg-emerald-500/20 rounded cursor-pointer"
                            title="Save name"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingId(field.id);
                              setEditValue(field.heading);
                            }}
                            className="p-1 text-neutral-400 hover:text-white rounded cursor-pointer"
                            title="Rename field"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleRemove(field)}
                          disabled={fields.length <= 1 || !!busy}
                          className="p-1 text-neutral-400 hover:text-red-400 rounded cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed"
                          title="Remove field from template"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-neutral-500 leading-relaxed">
            Changes are saved to this template immediately and applied to the open document; anything already
            typed into remaining fields is kept. Other templates are not affected.
          </p>
        </div>
      </div>
    </div>
  );
};
