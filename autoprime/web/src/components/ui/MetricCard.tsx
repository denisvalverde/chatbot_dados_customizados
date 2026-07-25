import { Card } from './Card';
import { cn } from '@/lib/cn';

export function MetricCard({
  label,
  value,
  hint,
  tone = 'primary',
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'primary' | 'success' | 'warning' | 'danger';
  icon?: string;
}) {
  const dot: Record<string, string> = {
    primary: 'bg-primary-500',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
  };

  return (
    <Card className="flex flex-col gap-2 !p-4 sm:!p-5">
      <div className="flex items-center gap-2">
        {icon ? (
          <span className="text-sm">{icon}</span>
        ) : (
          <span className={cn('h-2 w-2 rounded-full', dot[tone])} />
        )}
        <span className="text-[11px] sm:text-xs font-medium uppercase tracking-wide text-graphite-500 dark:text-white/50 leading-tight">
          {label}
        </span>
      </div>
      <span className="text-xl sm:text-2xl font-semibold text-graphite-900 dark:text-white truncate">
        {value}
      </span>
      {hint && <span className="text-xs text-graphite-400 dark:text-white/40">{hint}</span>}
    </Card>
  );
}
