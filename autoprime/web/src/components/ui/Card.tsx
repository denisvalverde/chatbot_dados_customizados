import { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-graphite-800/60',
        'backdrop-blur-xl shadow-sm dark:shadow-glass p-5',
        className,
      )}
      {...props}
    />
  );
}
