import { cn } from '@/lib/cn';

export function TimeSlot({
  label,
  selected = false,
  disabled = false,
  onClick,
}: {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded-xl border px-3 py-2.5 text-sm font-medium transition-all active:scale-[0.97]',
        'disabled:opacity-35 disabled:pointer-events-none',
        selected
          ? 'border-primary-500 bg-primary-500 text-white shadow-md shadow-primary-500/30'
          : 'border-black/10 dark:border-white/10 bg-white dark:bg-graphite-900/60 text-graphite-700 dark:text-white/70 hover:border-primary-500/40',
      )}
    >
      {label}
    </button>
  );
}
