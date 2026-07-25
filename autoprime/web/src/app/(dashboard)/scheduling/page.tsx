'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { AppointmentRecord, ClientRecord, ServiceRecord, VehicleRecord } from '@/lib/types';
import { formatDateTimeInZone, zonedLocalInputToIso } from '@/lib/datetime';
import { useCompany } from '@/lib/company-context';
import { useToast } from '@/components/ui/Toast';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Table, Thead, Th, Tr, Td } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { AppointmentCard } from '@/components/ui/AppointmentCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';

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

export default function SchedulingPage() {
  const { timezone } = useCompany();
  const toast = useToast();
  const [appointments, setAppointments] = useState<AppointmentRecord[] | null>(null);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    clientId: '',
    vehicleId: '',
    serviceIds: [] as string[],
    startAt: '',
  });

  function loadAgenda() {
    const from = new Date();
    from.setDate(from.getDate() - 7);
    const to = new Date();
    to.setDate(to.getDate() + 30);
    api
      .get<AppointmentRecord[]>(`/appointments?from=${from.toISOString()}&to=${to.toISOString()}`)
      .then(setAppointments)
      .catch(() => setError('Erro ao carregar a agenda.'));
  }

  useEffect(() => {
    loadAgenda();
    api.get<ClientRecord[]>('/clients').then(setClients).catch(() => undefined);
    api.get<ServiceRecord[]>('/services').then(setServices).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!form.clientId) {
      setVehicles([]);
      return;
    }
    const client = clients.find((c) => c.client.id === form.clientId);
    setVehicles(client?.client.vehicles ?? []);
  }, [form.clientId, clients]);

  function toggleService(id: string) {
    setForm((f) => ({
      ...f,
      serviceIds: f.serviceIds.includes(id) ? f.serviceIds.filter((s) => s !== id) : [...f.serviceIds, id],
    }));
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post('/appointments', {
        clientId: form.clientId,
        vehicleId: form.vehicleId,
        serviceIds: form.serviceIds,
        startAt: zonedLocalInputToIso(form.startAt, timezone),
      });
      setOpen(false);
      setForm({ clientId: '', vehicleId: '', serviceIds: [], startAt: '' });
      loadAgenda();
      toast.show('Agendamento criado com sucesso.', 'success');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao criar agendamento.');
    } finally {
      setLoading(false);
    }
  }

  async function confirmCancel() {
    if (!cancelTarget) return;
    try {
      await api.patch(`/appointments/${cancelTarget}/cancel`, { reason: 'Cancelado pelo painel' });
      loadAgenda();
      toast.show('Agendamento cancelado.', 'success');
    } catch {
      toast.show('Erro ao cancelar agendamento.', 'danger');
    } finally {
      setCancelTarget(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Agenda"
        description="Agendamentos de hoje, próximos dias e histórico recente"
        actions={<Button onClick={() => setOpen(true)} className="w-full sm:w-auto">+ Novo agendamento</Button>}
      />

      {error && <p className="text-sm text-danger mb-4">{error}</p>}

      {appointments === null && !error && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {appointments && appointments.length === 0 && (
        <EmptyState
          icon="📅"
          title="Nenhum agendamento no período"
          description="Crie um novo agendamento para começar a preencher a agenda."
          action={<Button onClick={() => setOpen(true)}>+ Novo agendamento</Button>}
        />
      )}

      {appointments && appointments.length > 0 && (
        <>
          {/* Mobile: cards */}
          <div className="flex flex-col gap-3 lg:hidden">
            {appointments.map((a) => (
              <AppointmentCard
                key={a.id}
                dateTime={formatDateTimeInZone(a.startAt, timezone)}
                clientName={a.client.user.name}
                vehicleLabel={`${a.vehicle.brand} ${a.vehicle.model} · ${a.vehicle.plate}`}
                services={a.services.map((s) => s.service.name).join(', ')}
                status={a.status}
                actions={
                  !['CANCELLED', 'COMPLETED'].includes(a.status) && (
                    <button
                      onClick={() => setCancelTarget(a.id)}
                      className="text-xs font-medium text-danger hover:underline"
                    >
                      Cancelar
                    </button>
                  )
                }
              />
            ))}
          </div>

          {/* Desktop: tabela */}
          <div className="hidden lg:block">
            <Table>
              <Thead>
                <Th>Data/Hora</Th>
                <Th>Cliente</Th>
                <Th>Veículo</Th>
                <Th>Serviços</Th>
                <Th>Status</Th>
                <Th>Ações</Th>
              </Thead>
              <tbody>
                {appointments.map((a) => (
                  <Tr key={a.id}>
                    <Td>{formatDateTimeInZone(a.startAt, timezone)}</Td>
                    <Td>{a.client.user.name}</Td>
                    <Td>
                      {a.vehicle.brand} {a.vehicle.model} · {a.vehicle.plate}
                    </Td>
                    <Td>{a.services.map((s) => s.service.name).join(', ')}</Td>
                    <Td>
                      <Badge tone={STATUS_TONE[a.status] ?? 'neutral'}>{a.status}</Badge>
                    </Td>
                    <Td>
                      {!['CANCELLED', 'COMPLETED'].includes(a.status) && (
                        <button
                          onClick={() => setCancelTarget(a.id)}
                          className="text-xs text-danger hover:underline"
                        >
                          Cancelar
                        </button>
                      )}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        </>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Novo agendamento">
        <form onSubmit={handleCreate} className="flex flex-col gap-3">
          <div>
            <Label>Cliente</Label>
            <Select
              required
              value={form.clientId}
              onChange={(e) => setForm({ ...form, clientId: e.target.value, vehicleId: '' })}
            >
              <option value="">Selecione...</option>
              {clients.map((c) => (
                <option key={c.client.id} value={c.client.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label>Veículo</Label>
            <Select
              required
              value={form.vehicleId}
              onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}
              disabled={!form.clientId}
            >
              <option value="">Selecione...</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.brand} {v.model} · {v.plate}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label>Serviços</Label>
            <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto border border-black/10 dark:border-white/10 rounded-lg p-2">
              {services.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm py-1">
                  <input
                    type="checkbox"
                    checked={form.serviceIds.includes(s.id)}
                    onChange={() => toggleService(s.id)}
                    className="h-4 w-4"
                  />
                  {s.name} ({s.estimatedMinutes} min)
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label>Data e hora (horário da empresa — {timezone})</Label>
            <Input
              type="datetime-local"
              required
              value={form.startAt}
              onChange={(e) => setForm({ ...form, startAt: e.target.value })}
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" disabled={loading} className="mt-2 w-full">
            {loading ? 'Salvando...' : 'Confirmar agendamento'}
          </Button>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!cancelTarget}
        title="Cancelar agendamento"
        message="Tem certeza de que deseja cancelar este agendamento? Essa ação não pode ser desfeita."
        confirmLabel="Cancelar agendamento"
        cancelLabel="Voltar"
        tone="danger"
        onConfirm={confirmCancel}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
}
