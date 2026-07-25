import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/cn';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
}

const VARIANTS: Record<string, string> = {
  primary:
    'bg-primary-500 text-white hover:bg-primary-600 shadow-lg shadow-primary-500/20 border border-primary-400/30',
  secondary:
    'bg-graphite-700/60 text-white hover:bg-graphite-600/60 border border-white/10 backdrop-blur-sm',
  ghost: 'bg-transparent text-graphite-600 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/5',
  danger: 'bg-danger/90 text-white hover:bg-danger border border-danger/30',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none',
          size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-4 py-2.5 text-sm',
          VARIANTS[variant],
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';
