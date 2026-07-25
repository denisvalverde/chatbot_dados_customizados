import { cn } from '@/lib/cn';
import { Card } from './Card';

const currency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function ServiceCard({
  name,
  category,
  description,
  price,
  estimatedMinutes,
  selected = false,
  onSelect,
}: {
  name: string;
  category?: string;
  description?: string;
  price?: number;
  estimatedMinutes?: number;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const content = (
    <div className="flex w-full flex-col gap-1.5 text-left">
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-graphite-900 dark:text-white">{name}</span>
        {selected && <span className="text-primary-500 text-sm shrink-0">✓ selecionado</span>}
      </div>
      {category && (
        <span className="text-[11px] uppercase tracking-wide text-graphite-400 dark:text-white/40">
          {category}
        </span>
      )}
      {description && (
        <p className="text-sm text-graphite-500 dark:text-white/50 line-clamp-2">{description}</p>
      )}
      <div className="flex items-center gap-3 mt-1 text-sm">
        {price !== undefined && (
          <span className="font-semibold text-primary-500">{currency(price)}</span>
        )}
        {estimatedMinutes !== undefined && (
          <span className="text-graphite-400 dark:text-white/40">~{estimatedMinutes} min</span>
        )}
      </div>
    </div>
  );

  return (
    <Card
      className={cn(
        'transition-all !p-4',
        onSelect && 'cursor-pointer hover:border-primary-500/40',
        selected && 'border-primary-500 ring-2 ring-primary-500/30 bg-primary-500/5',
      )}
    >
      {onSelect ? (
        <button onClick={onSelect} type="button" className="w-full text-left">
          {content}
        </button>
      ) : (
        content
      )}
    </Card>
  );
}
