import { ReactNode } from 'react';

export function EmptyState({
  icon = '📭',
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-2 py-12 px-4">
      <span className="text-4xl mb-1">{icon}</span>
      <p className="font-medium text-graphite-900 dark:text-white">{title}</p>
      {description && (
        <p className="text-sm text-graphite-500 dark:text-white/50 max-w-xs">{description}</p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
