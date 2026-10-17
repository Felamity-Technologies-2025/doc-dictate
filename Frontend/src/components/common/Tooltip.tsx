import React, { useState } from 'react';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  shortcut?: string;
  position?: 'top' | 'bottom';
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  shortcut,
  position = 'bottom',
}) => {
  const [visible, setVisible] = useState(false);

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          className={`absolute ${
            position === 'bottom' ? 'top-full mt-1.5' : 'bottom-full mb-1.5'
          } left-1/2 -translate-x-1/2 z-50 pointer-events-none whitespace-nowrap bg-neutral-900 text-white text-xs px-2 py-1 rounded shadow-lg border border-neutral-700 font-sans flex items-center gap-1.5`}
        >
          <span>{content}</span>
          {shortcut && (
            <kbd className="bg-neutral-800 px-1 py-0.5 rounded text-[10px] text-neutral-300 font-mono border border-neutral-700">
              {shortcut}
            </kbd>
          )}
        </div>
      )}
    </div>
  );
};
