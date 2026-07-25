'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { VehicleRecord } from '@/lib/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';

interface ClientDetail {
  id: string;
  document?: string;
  addressCity?: string;
  addressState?: string;
  user: { name: string; email: string; phone?: string; isActive: boolean };
  vehicles: VehicleRecord[];
}

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<ClientDetail>(`/clients/${params.id}`)
      .then(setClient)
      .catch(() => setError('Não foi possível carregar este cliente.'));
  }, [params.id]);

  if (error) {
    return (
      <div>
        <PageHeader title="Cliente" backHref="/clients" />
        <EmptyState icon="⚠️" title="Erro ao carregar" description={error} />
      </div>
    );
  }

  if (!client) {
    return (
      <div>
        <PageHeader title="Cliente" backHref="/clients" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={client.user.name}
        description={client.user.email}
        backHref="/clients"
        actions={<Badge tone={client.user.isActive ? 'success' : 'danger'}>{client.user.isActive ? 'Ativo' : 'Inativo'}</Badge>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <Card>
          <h3 className="text-xs font-medium uppercase tracking-wide text-graphite-500 dark:text-white/50 mb-1">
            Telefone
          </h3>
          <p className="text-graphite-900 dark:text-white">{client.user.phone ?? '—'}</p>
        </Card>
        <Card>
          <h3 className="text-xs font-medium uppercase tracking-wide text-graphite-500 dark:text-white/50 mb-1">
            CPF
          </h3>
          <p className="text-graphite-900 dark:text-white">{client.document ?? '—'}</p>
        </Card>
        <Card className="sm:col-span-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-graphite-500 dark:text-white/50 mb-1">
            Cidade / UF
          </h3>
          <p className="text-graphite-900 dark:text-white">
            {client.addressCity ? `${client.addressCity} — ${client.addressState ?? ''}` : '—'}
          </p>
        </Card>
      </div>

      <h3 className="font-medium mb-3 text-graphite-900 dark:text-white">Veículos</h3>
      {client.vehicles.length === 0 ? (
        <EmptyState icon="🚗" title="Nenhum veículo cadastrado" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {client.vehicles.map((v) => (
            <Card key={v.id} className="!p-4">
              <p className="font-medium text-graphite-900 dark:text-white">
                {v.brand} {v.model}
              </p>
              <p className="text-sm text-graphite-500 dark:text-white/50">
                Placa {v.plate}
                {v.color ? ` · ${v.color}` : ''}
                {v.year ? ` · ${v.year}` : ''}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
