'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { useCompany } from '@/lib/company-context';
import { formatDateTimeInZone } from '@/lib/datetime';
import { AppointmentRecord } from '@/lib/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { AppointmentCard } from '@/components/ui/AppointmentCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';

export default function HistoricoPage() {
  const { timezone } = useCompany();
  const [appointments, setAppointments] = useState<AppointmentRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const user = getCurrentUser();

  useEffect(() => {
    const from = new Date();
    from.setFullYear(from.getFullYear() - 1);
    const to = new Date();
    to.setDate(to.getDate() + 1);

    api
      .get<AppointmentRecord[]>(`/appointments?from=${from.toISOString()}&to=${to.toISOString()}`)
      .then((all) =>
        setAppointments(
          all
            .filter((a) => a.client.id === user?.clientId)
            .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime()),
        ),
      )
      .catch(() => setError('Não foi possível carregar seu histórico.'));
  }, [user?.clientId]);

  return (
    <div>
      <PageHeader title="Histórico" description="Seus agendamentos anteriores e futuros" />

      {error && <p className="text-sm text-danger mb-4">{error}</p>}

      {!error && appointments === null && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {appointments && appointments.length === 0 && (
        <EmptyState icon="🕘" title="Nenhum agendamento encontrado" description="Seu histórico aparecerá aqui assim que você agendar um serviço." />
      )}

      {appointments && appointments.length > 0 && (
        <div className="flex flex-col gap-3">
          {appointments.map((a) => (
            <AppointmentCard
              key={a.id}
              dateTime={formatDateTimeInZone(a.startAt, timezone)}
              vehicleLabel={`${a.vehicle.brand} ${a.vehicle.model} · ${a.vehicle.plate}`}
              services={a.services.map((s) => s.service.name).join(', ')}
              status={a.status}
            />
          ))}
        </div>
      )}
    </div>
  );
}
