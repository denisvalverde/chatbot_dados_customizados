'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { ServiceOrderRecord } from '@/lib/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Table, Thead, Th, Tr, Td } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';

const STATUS_TONE: Record<string, 'neutral' | 'success' | 'warning' | 'danger' | 'primary'> = {
  OPEN: 'neutral',
  IN_PROGRESS: 'primary',
  QUALITY_CHECK: 'warning',
  COMPLETED: 'success',
  DELIVERED: 'success',
  CANCELLED: 'danger',
};

const currency = (v: string) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function ServiceOrdersPage() {
  const [orders, setOrders] = useState<ServiceOrderRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.get<ServiceOrderRecord[]>('/service-orders').then(setOrders).catch(() => setError('Erro ao carregar ordens de serviço.'));
  }

  useEffect(load, []);

  async function runAction(id: string, action: 'start' | 'complete' | 'deliver') {
    try {
      await api.patch(`/service-orders/${id}/${action}`);
      load();
    } catch {
      setError('Não foi possível executar a ação.');
    }
  }

  function total(order: ServiceOrderRecord) {
    return order.items.reduce((sum, i) => sum + Number(i.price), 0);
  }

  return (
    <div>
      <PageHeader title="Ordens de Serviço" description="Acompanhamento de execução, checklist e entrega" />

      {error && <p className="text-sm text-danger mb-4">{error}</p>}

      <Table>
        <Thead>
          <Th>OS</Th>
          <Th>Cliente</Th>
          <Th>Veículo</Th>
          <Th>Serviços</Th>
          <Th>Total</Th>
          <Th>Status</Th>
          <Th>Ações</Th>
        </Thead>
        <tbody>
          {orders.map((o) => (
            <Tr key={o.id}>
              <Td className="font-medium">#{o.number}</Td>
              <Td>{o.client.user.name}</Td>
              <Td>
                {o.vehicle.brand} {o.vehicle.model} · {o.vehicle.plate}
              </Td>
              <Td>{o.items.map((i) => i.service.name).join(', ')}</Td>
              <Td>{currency(String(total(o)))}</Td>
              <Td>
                <Badge tone={STATUS_TONE[o.status] ?? 'neutral'}>{o.status}</Badge>
              </Td>
              <Td>
                <div className="flex gap-2">
                  {o.status === 'OPEN' && (
                    <Button size="sm" variant="secondary" onClick={() => runAction(o.id, 'start')}>
                      Iniciar
                    </Button>
                  )}
                  {o.status === 'IN_PROGRESS' && (
                    <Button size="sm" onClick={() => runAction(o.id, 'complete')}>
                      Concluir
                    </Button>
                  )}
                  {o.status === 'COMPLETED' && (
                    <Button size="sm" variant="secondary" onClick={() => runAction(o.id, 'deliver')}>
                      Entregar
                    </Button>
                  )}
                </div>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
