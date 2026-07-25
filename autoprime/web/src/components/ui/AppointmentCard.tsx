import { ReactNode } from 'react';
import { Card } from './Card';
import { Badge } from './Badge';

const STATUS_TONE: Record<string, 'neutral' | 'success' | 'warning' | 'danger' | 'primary'> = {
  PENDING: 'warning',
  CONFIRMED: 'primary',
  IN_QUEUE: 'neutral',
  IN_PROGRESS: 'primary',
  COMPLETED: 'success',
  CANCELLED: 'danger',
  NO_SHOW: 'danger',
  RESCHEDULED: 'warning',
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendente',
  CONFIRMED: 'Confirmado',
  IN_QUEUE: 'Na fila',
  IN_PROGRESS: 'Em andamento',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
  NO_SHOW: 'Não compareceu',
  RESCHEDULED: 'Reagendado',
};

export function AppointmentCard({
  dateTime,
  clientName,
  vehicleLabel,
  services,
  status,
  actions,
}: {
  dateTime: string;
  clientName?: string;
  vehicleLabel: string;
  services: string;
  status: string;
  actions?: ReactNode;
}) {
  return (
    <Card className="!p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold text-graphite-900 dark:text-white">{dateTime}</span>
        <Badge tone={STATUS_TONE[status] ?? 'neutral'}>{STATUS_LABEL[status] ?? status}</Badge>
      </div>
      {clientName && (
        <p className="text-sm text-graphite-700 dark:text-white/70">{clientName}</p>
      )}
      <p className="text-sm text-graphite-500 dark:text-white/50">{vehicleLabel}</p>
      <p className="text-sm text-graphite-500 dark:text-white/50 line-clamp-2">{services}</p>
      {actions && <div className="mt-1 flex items-center gap-3">{actions}</div>}
    </Card>
  );
}
