import { Card } from './Card';
import { cn } from '@/lib/cn';

export function StatCard({
  label,
  value,
  hint,
  tone = 'primary',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'primary' | 'success' | 'warning' | 'danger';
}) {
  const dot: Record<string, string> = {
    primary: 'bg-primary-500',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
  };

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className={cn('h-2 w-2 rounded-full', dot[tone])} />
        <span className="text-xs font-medium uppercase tracking-wide text-graphite-500 dark:text-white/50">
          {label}
        </span>
      </div>
      <span className="text-2xl font-semibold text-graphite-900 dark:text-white">{value}</span>
      {hint && <span className="text-xs text-graphite-400 dark:text-white/40">{hint}</span>}
    </Card>
  );
}
