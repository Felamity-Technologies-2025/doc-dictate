import React from 'react';
import { ZoomIn, ZoomOut, Eye, Sun, Moon, Maximize } from 'lucide-react';
import { PageLayoutConfig } from '../../types';

interface ViewTabProps {
  layout: PageLayoutConfig;
  onUpdateLayout: (newLayout: Partial<PageLayoutConfig>) => void;
  isFocusMode: boolean;
  onToggleFocusMode: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export const ViewTab: React.FC<ViewTabProps> = ({
  layout,
  onUpdateLayout,
  isFocusMode,
  onToggleFocusMode,
  isDarkMode,
  onToggleDarkMode,
}) => {
  const zoomLevels = [50, 75, 90, 100, 125, 150, 175, 200];

  return (
    <div className="flex items-center gap-4 h-full px-4 py-1 text-xs text-neutral-700 select-none">
      {/* Zoom */}
      <div className="flex flex-col items-center justify-between h-full pr-3 border-r border-neutral-200">
        <div className="flex items-center gap-2 my-auto">
          <button
            onClick={() => onUpdateLayout({ zoom: Math.max(50, layout.zoom - 10) })}
            className="p-1 rounded hover:bg-neutral-100 text-neutral-700"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <select
            value={layout.zoom}
            onChange={(e) => onUpdateLayout({ zoom: Number(e.target.value) })}
            className="h-6 text-[11px] bg-white border border-neutral-300 rounded px-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 w-16"
          >
            {zoomLevels.map((z) => (
              <option key={z} value={z}>
                {z}%
              </option>
            ))}
          </select>

          <button
            onClick={() => onUpdateLayout({ zoom: Math.min(200, layout.zoom + 10) })}
            className="p-1 rounded hover:bg-neutral-100 text-neutral-700"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
        <span className="text-[10px] text-neutral-400 uppercase tracking-wider">Zoom</span>
      </div>

      {/* Modes */}
      <div className="flex flex-col items-center justify-between h-full px-3 border-r border-neutral-200">
        <div className="flex items-center gap-2 my-auto">
          <button
            onClick={onToggleFocusMode}
            className={`flex flex-col items-center p-1.5 rounded cursor-pointer transition-colors ${
              isFocusMode ? 'bg-blue-100 text-blue-700' : 'hover:bg-neutral-100 text-neutral-700'
            }`}
          >
            <Maximize className="w-4 h-4 mb-0.5" />
            <span className="text-[11px]">{isFocusMode ? 'Exit Focus' : 'Focus Mode'}</span>
          </button>

          <button
            onClick={onToggleDarkMode}
            className={`flex flex-col items-center p-1.5 rounded cursor-pointer transition-colors ${
              isDarkMode ? 'bg-neutral-800 text-amber-300' : 'hover:bg-neutral-100 text-neutral-700'
            }`}
          >
            {isDarkMode ? <Sun className="w-4 h-4 mb-0.5" /> : <Moon className="w-4 h-4 mb-0.5" />}
            <span className="text-[11px]">{isDarkMode ? 'Light Canvas' : 'Dark Canvas'}</span>
          </button>
        </div>
        <span className="text-[10px] text-neutral-400 uppercase tracking-wider">Display Mode</span>
      </div>
    </div>
  );
};
