'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

interface ToastItem {
  id: number;
  message: string;
  tone: 'success' | 'danger' | 'neutral';
}

interface ToastContextValue {
  show: (message: string, tone?: ToastItem['tone']) => void;
}

const ToastContext = createContext<ToastContextValue>({ show: () => undefined });

const TONE_CLASSES: Record<ToastItem['tone'], string> = {
  success: 'border-success/30 bg-success/10 text-success',
  danger: 'border-danger/30 bg-danger/10 text-danger',
  neutral: 'border-black/10 dark:border-white/10 bg-white dark:bg-graphite-800 text-graphite-900 dark:text-white',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const show = useCallback((message: string, tone: ToastItem['tone'] = 'neutral') => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => {
      setToasts((t) => t.filter((toast) => toast.id !== id));
    }, 3200);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] lg:bottom-6 z-[70] flex flex-col items-center gap-2 px-4 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              'animate-ap-slide-up pointer-events-auto w-full max-w-sm rounded-xl border px-4 py-3 text-sm font-medium shadow-lg backdrop-blur-xl',
              TONE_CLASSES[t.tone],
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
