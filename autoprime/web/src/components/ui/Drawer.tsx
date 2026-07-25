'use client';

import { ReactNode } from 'react';

export function Drawer({
  open,
  onClose,
  children,
  title,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-ap-fade-in" onClick={onClose} />
      <div className="relative flex h-full w-[82%] max-w-xs flex-col bg-white dark:bg-graphite-900 shadow-2xl animate-ap-slide-in-left pt-safe pb-safe">
        {title && (
          <div className="flex items-center justify-between px-4 py-4 border-b border-black/5 dark:border-white/10">
            <span className="font-semibold text-graphite-900 dark:text-white">{title}</span>
            <button
              onClick={onClose}
              className="h-8 w-8 flex items-center justify-center rounded-full text-graphite-400 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              aria-label="Fechar menu"
            >
              ✕
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
