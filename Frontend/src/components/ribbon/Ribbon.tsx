import React from 'react';
import type { Editor } from '@tiptap/react';
import { HomeTab } from './HomeTab';
import { InsertTab } from './InsertTab';
import { LayoutTab } from './LayoutTab';
import { ReviewTab } from './ReviewTab';
import { ViewTab } from './ViewTab';
import {
  RibbonTab,
  DictationStatus,
  DictationSettings,
  PageLayoutConfig,
} from '../../types';

interface RibbonProps {
  activeTab: RibbonTab;
  onSelectTab: (tab: RibbonTab) => void;
  editor: Editor | null;
  dictationStatus: DictationStatus;
  dictationSettings: DictationSettings;
  onToggleDictation: () => void;
  onOpenDictationSettings: () => void;
  onUpdateDictationLanguage: (lang: string) => void;
  onOpenFindReplace: () => void;
  onOpenTableDialog: () => void;
  layout: PageLayoutConfig;
  onUpdateLayout: (newLayout: Partial<PageLayoutConfig>) => void;
  isFocusMode: boolean;
  onToggleFocusMode: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export const Ribbon: React.FC<RibbonProps> = ({
  activeTab,
  onSelectTab,
  editor,
  dictationStatus,
  dictationSettings,
  onToggleDictation,
  onOpenDictationSettings,
  onUpdateDictationLanguage,
  onOpenFindReplace,
  onOpenTableDialog,
  layout,
  onUpdateLayout,
  isFocusMode,
  onToggleFocusMode,
  isDarkMode,
  onToggleDarkMode,
}) => {
  const tabs: { id: RibbonTab; label: string }[] = [
    { id: 'home', label: 'Home' },
    { id: 'insert', label: 'Insert' },
    { id: 'layout', label: 'Layout' },
    { id: 'review', label: 'Review' },
    { id: 'view', label: 'View' },
  ];

  return (
    <div className="bg-[#f3f2f1] border-b border-neutral-300 flex flex-col shrink-0 select-none shadow-xs">
      {/* Ribbon Tab Bar */}
      <div className="flex items-center px-3 pt-1 gap-1 border-b border-neutral-300/80 bg-[#f9f9f9]">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`px-3.5 py-1 text-xs font-medium cursor-pointer transition-colors relative ${
                isActive
                  ? 'text-blue-700 bg-[#f3f2f1] font-semibold border-t-2 border-t-blue-700 -mb-[1px] border-l border-r border-neutral-300'
                  : 'text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Active Tab Content Toolbar */}
      {!isFocusMode && (
        <div className="h-24 bg-[#f3f2f1] overflow-x-auto flex items-center">
          {activeTab === 'home' && (
            <HomeTab
              editor={editor}
              dictationStatus={dictationStatus}
              dictationSettings={dictationSettings}
              onToggleDictation={onToggleDictation}
              onOpenDictationSettings={onOpenDictationSettings}
              onUpdateDictationLanguage={onUpdateDictationLanguage}
              onOpenFindReplace={onOpenFindReplace}
            />
          )}
          {activeTab === 'insert' && (
            <InsertTab editor={editor} onOpenTableDialog={onOpenTableDialog} />
          )}
          {activeTab === 'layout' && (
            <LayoutTab layout={layout} onUpdateLayout={onUpdateLayout} />
          )}
          {activeTab === 'review' && (
            <ReviewTab editor={editor} onOpenFindReplace={onOpenFindReplace} />
          )}
          {activeTab === 'view' && (
            <ViewTab
              layout={layout}
              onUpdateLayout={onUpdateLayout}
              isFocusMode={isFocusMode}
              onToggleFocusMode={onToggleFocusMode}
              isDarkMode={isDarkMode}
              onToggleDarkMode={onToggleDarkMode}
            />
          )}
        </div>
      )}
    </div>
  );
};
