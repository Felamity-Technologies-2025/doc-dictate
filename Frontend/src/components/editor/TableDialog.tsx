import React, { useState } from 'react';
import type { Editor } from '@tiptap/react';
import { Table, X } from 'lucide-react';

interface TableDialogProps {
  isOpen: boolean;
  onClose: () => void;
  editor: Editor | null;
}

export const TableDialog: React.FC<TableDialogProps> = ({ isOpen, onClose, editor }) => {
  const [hoveredRows, setHoveredRows] = useState(3);
  const [hoveredCols, setHoveredCols] = useState(3);

  if (!isOpen || !editor) return null;

  const handleInsert = (rows: number, cols: number) => {
    editor
      .chain()
      .focus()
      .insertTable({ rows, cols, withHeaderRow: true })
      .run();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-4">
      <div className="bg-[#0f172a] rounded-xl shadow-2xl border border-[#1e2c47] w-full max-w-xs max-h-[calc(100dvh-1.5rem)] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2c47] bg-[#0c1222]">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Table className="w-4 h-4 text-blue-400" />
            <span>Insert Table</span>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 flex flex-col items-center">
          <div className="text-xs text-neutral-300 mb-2 font-medium">
            {hoveredRows} × {hoveredCols} Table
          </div>

          {/* Grid Selector */}
          <div className="grid grid-cols-6 gap-1 bg-[#131b2e] p-2.5 rounded-lg border border-[#1e2c47]">
            {Array.from({ length: 6 }).map((_, r) =>
              Array.from({ length: 6 }).map((_, c) => {
                const isSelected = r < hoveredRows && c < hoveredCols;
                return (
                  <button
                    key={`${r}-${c}`}
                    onMouseEnter={() => {
                      setHoveredRows(r + 1);
                      setHoveredCols(c + 1);
                    }}
                    onClick={() => handleInsert(r + 1, c + 1)}
                    className={`w-6 h-6 border rounded-sm transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 border-blue-400'
                        : 'bg-[#18233a] border-[#253552] hover:bg-blue-900/40'
                    }`}
                  />
                );
              })
            )}
          </div>
          <p className="text-[11px] text-neutral-400 mt-2">
            Click grid cell to insert table into document
          </p>
        </div>
      </div>
    </div>
  );
};
