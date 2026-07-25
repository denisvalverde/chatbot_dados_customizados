import { InputHTMLAttributes, LabelHTMLAttributes, forwardRef, SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export const Label = (props: LabelHTMLAttributes<HTMLLabelElement>) => (
  <label
    {...props}
    className={cn(
      'block text-xs font-medium text-graphite-600 dark:text-white/60 mb-1',
      props.className,
    )}
  />
);

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-graphite-900/60',
        'px-3 py-2 text-sm text-graphite-900 dark:text-white placeholder:text-graphite-400',
        'focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-graphite-900/60',
        'px-3 py-2 text-sm text-graphite-900 dark:text-white',
        'focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all',
        className,
      )}
      {...props}
    />
  ),
);
Select.displayName = 'Select';
