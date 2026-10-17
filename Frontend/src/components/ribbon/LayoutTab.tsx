import React from 'react';
import { FileText, RotateCcw, Columns, Maximize2 } from 'lucide-react';
import { PageLayoutConfig, PageSize, PageOrientation, PageMargins } from '../../types';

interface LayoutTabProps {
  layout: PageLayoutConfig;
  onUpdateLayout: (newLayout: Partial<PageLayoutConfig>) => void;
}

export const LayoutTab: React.FC<LayoutTabProps> = ({ layout, onUpdateLayout }) => {
  return (
    <div className="flex items-center gap-4 h-full px-4 py-1 text-xs text-neutral-700 select-none">
      {/* Page Setup */}
      <div className="flex flex-col items-center justify-between h-full pr-3 border-r border-neutral-200">
        <div className="flex items-center gap-3 my-auto">
          {/* Margins */}
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-neutral-500">Margins</span>
            <select
              value={layout.margins}
              onChange={(e) => onUpdateLayout({ margins: e.target.value as PageMargins })}
              className="h-6 text-[11px] bg-white border border-neutral-300 rounded px-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="normal">Normal (1.0 inch)</option>
              <option value="narrow">Narrow (0.5 inch)</option>
              <option value="moderate">Moderate (0.75 inch)</option>
              <option value="wide">Wide (1.5 inch)</option>
            </select>
          </div>

          {/* Orientation */}
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-neutral-500">Orientation</span>
            <select
              value={layout.orientation}
              onChange={(e) => onUpdateLayout({ orientation: e.target.value as PageOrientation })}
              className="h-6 text-[11px] bg-white border border-neutral-300 rounded px-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </div>

          {/* Paper Size */}
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-neutral-500">Size</span>
            <select
              value={layout.size}
              onChange={(e) => onUpdateLayout({ size: e.target.value as PageSize })}
              className="h-6 text-[11px] bg-white border border-neutral-300 rounded px-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="letter">Letter (8.5&quot; × 11&quot;)</option>
              <option value="a4">A4 (8.27&quot; × 11.69&quot;)</option>
              <option value="legal">Legal (8.5&quot; × 14&quot;)</option>
            </select>
          </div>
        </div>
        <span className="text-[10px] text-neutral-400 uppercase tracking-wider">Page Setup</span>
      </div>

      {/* Page Background */}
      <div className="flex flex-col items-center justify-between h-full px-3">
        <div className="flex items-center gap-2 my-auto">
          <button
            onClick={() => onUpdateLayout({ zoom: 100 })}
            className="flex flex-col items-center p-1.5 rounded hover:bg-neutral-100 text-neutral-700 cursor-pointer"
          >
            <Maximize2 className="w-4 h-4 text-neutral-600 mb-0.5" />
            <span className="text-[11px]">Reset View</span>
          </button>
        </div>
        <span className="text-[10px] text-neutral-400 uppercase tracking-wider">Page Background</span>
      </div>
    </div>
  );
};
