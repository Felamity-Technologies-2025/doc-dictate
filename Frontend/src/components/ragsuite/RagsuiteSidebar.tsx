import React from 'react';
import {
  Shield,
  Plus,
  Home,
  FolderPlus,
  Terminal,
  Image as ImageIcon,
  Database,
  BarChart2,
  Cpu,
  Layers,
  Laptop,
  Settings,
  LogOut,
  FolderOpen,
} from 'lucide-react';

interface RagsuiteSidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onNewDocument: () => void;
  onOpenDocuments: () => void;
  onOpenDictationSettings: () => void;
  onOpenAudioUpload: () => void;
  onOpenTableDialog: () => void;
  savedDocsCount: number;
}

export const RagsuiteSidebar: React.FC<RagsuiteSidebarProps> = ({
  currentTab,
  onSelectTab,
  onNewDocument,
  onOpenDocuments,
  onOpenDictationSettings,
  onOpenAudioUpload,
  onOpenTableDialog,
  savedDocsCount,
}) => {
  const menuItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'directory', label: 'Add Directory', icon: FolderPlus, action: onOpenDocuments },
    { id: 'playground', label: 'Prompt Playground', icon: Terminal, action: onOpenAudioUpload },
    { id: 'images', label: 'Image Generation', icon: ImageIcon },
    { id: 'database', label: 'Database', icon: Database, action: onOpenDocuments },
    { id: 'insights', label: 'Insights', icon: BarChart2 },
    { id: 'models', label: 'Model Availability', icon: Cpu, action: onOpenDictationSettings },
    { id: 'catalog', label: 'Model Catalog', icon: Layers, action: onOpenDictationSettings },
    { id: 'devices', label: 'Logged-In Devices', icon: Laptop },
    { id: 'settings', label: 'Settings', icon: Settings, action: onOpenDictationSettings },
  ];

  return (
    <aside className="w-60 bg-[#0d1424] flex flex-col justify-between border-r border-[#19243a] select-none shrink-0 relative overflow-hidden">
      {/* Circuit board / lock watermark background matching RAGSUITE image */}
      <div className="absolute -bottom-10 -left-10 w-72 h-72 opacity-5 pointer-events-none text-blue-400">
        <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M100 20C55.8 20 20 55.8 20 100C20 144.2 55.8 180 100 180C144.2 180 180 144.2 180 100C180 55.8 144.2 20 100 20Z"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            d="M100 50L130 80V120L100 150L70 120V80L100 50Z"
            stroke="currentColor"
            strokeWidth="3"
          />
          <circle cx="100" cy="100" r="15" fill="currentColor" />
          <path d="M20 100H60M140 100H180M100 20V60M100 140V180" stroke="currentColor" strokeWidth="2" />
        </svg>
      </div>

      {/* Top Section */}
      <div className="p-4 z-10 flex flex-col gap-3">
        {/* User Profile Header */}
        <div className="flex items-center gap-3 py-1">
          {/* Avatar with shield hexagon */}
          <div className="w-10 h-10 rounded-full bg-[#162238] border border-blue-500/40 flex items-center justify-center text-blue-400 shadow-md">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-white tracking-wide truncate">
              Giri Nadhan
            </span>
            <span className="text-xs text-[#7082a4] truncate">
              @Giri Nadhan
            </span>
          </div>
        </div>

        {/* Primary Action Button: + New Chat / New Document */}
        <button
          onClick={onNewDocument}
          className="w-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-medium text-xs py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer mt-1"
        >
          <Plus className="w-4 h-4 text-white" />
          <span>New Document</span>
        </button>

        {/* Navigation Menu Items */}
        <nav className="flex flex-col gap-1 mt-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.action) {
                    item.action();
                  } else {
                    onSelectTab(item.id);
                  }
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-normal transition-all text-left cursor-pointer ${
                  isActive
                    ? 'bg-[#162035] text-white font-medium border border-[#23334d]/50 shadow-xs'
                    : 'text-[#8da0bd] hover:text-white hover:bg-[#141d30]'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-[#8da0bd]'}`} />
                <span className="truncate">{item.label}</span>
                {item.id === 'directory' && savedDocsCount > 0 && (
                  <span className="ml-auto text-[10px] bg-[#1a2842] text-blue-300 px-1.5 py-0.5 rounded-full border border-blue-500/20">
                    {savedDocsCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Action: Logout / Export */}
      <div className="p-4 z-10 border-t border-[#19243a]">
        <button
          onClick={onOpenDocuments}
          className="w-full bg-[#dc2626] hover:bg-[#b91c1c] text-white font-semibold text-xs py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm"
        >
          <LogOut className="w-4 h-4 rotate-180" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};
