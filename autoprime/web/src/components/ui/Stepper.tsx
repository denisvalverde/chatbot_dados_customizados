import { cn } from '@/lib/cn';

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="mb-5">
      {/* Mobile: barra de progresso compacta */}
      <div className="sm:hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-graphite-500 dark:text-white/50">
            Passo {current + 1} de {steps.length}
          </span>
          <span className="text-xs font-semibold text-primary-500">{steps[current]}</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary-500 transition-all duration-300"
            style={{ width: `${((current + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Desktop: trilha completa com todos os passos */}
      <div className="hidden sm:flex items-center">
        {steps.map((label, i) => (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold transition-colors',
                  i < current && 'bg-primary-500 text-white',
                  i === current && 'bg-primary-500 text-white ring-4 ring-primary-500/20',
                  i > current && 'bg-black/5 dark:bg-white/10 text-graphite-400 dark:text-white/40',
                )}
              >
                {i < current ? '✓' : i + 1}
              </div>
              <span
                className={cn(
                  'text-xs font-medium whitespace-nowrap',
                  i === current
                    ? 'text-graphite-900 dark:text-white'
                    : 'text-graphite-400 dark:text-white/40',
                )}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  'h-px flex-1 mx-3',
                  i < current ? 'bg-primary-500' : 'bg-black/10 dark:bg-white/10',
                )}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
