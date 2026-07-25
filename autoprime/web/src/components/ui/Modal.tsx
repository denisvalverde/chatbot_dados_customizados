'use client';

import { ReactNode } from 'react';

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-ap-fade-in" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg max-h-[92vh] sm:max-h-[85vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border-t sm:border border-white/10 bg-white dark:bg-graphite-800 shadow-2xl animate-ap-slide-up pb-safe">
        <div className="sticky top-0 bg-white dark:bg-graphite-800 pt-3 sm:pt-5 px-5 sm:px-6 pb-3 border-b border-black/5 dark:border-white/5 sm:border-none">
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-black/10 dark:bg-white/15 sm:hidden" />
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-graphite-900 dark:text-white">{title}</h2>
            <button
              onClick={onClose}
              className="h-8 w-8 flex items-center justify-center rounded-full text-graphite-400 hover:bg-black/5 dark:hover:bg-white/10 hover:text-graphite-700 dark:hover:text-white transition-colors"
              aria-label="Fechar"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="p-5 sm:p-6 sm:pt-4">{children}</div>
      </div>
    </div>
  );
}
