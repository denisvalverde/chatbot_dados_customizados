import { ReactNode } from 'react';
import Link from 'next/link';

export function PageHeader({
  title,
  description,
  actions,
  backHref,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  backHref?: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
      <div>
        {backHref && (
          <Link
            href={backHref}
            className="inline-flex items-center gap-1 text-xs text-graphite-400 dark:text-white/40 hover:text-primary-500 mb-1.5"
          >
            ← Voltar
          </Link>
        )}
        <h1 className="text-xl font-semibold text-graphite-900 dark:text-white">{title}</h1>
        {description && (
          <p className="text-sm text-graphite-500 dark:text-white/50 mt-0.5">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
