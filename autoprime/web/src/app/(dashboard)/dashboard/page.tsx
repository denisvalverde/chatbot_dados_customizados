'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { useCompany } from '@/lib/company-context';
import { formatTimeInZone, todayRangeInZone } from '@/lib/datetime';
import { AppointmentRecord, DashboardSummary, Role } from '@/lib/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { MetricCard } from '@/components/ui/MetricCard';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';
import { AppointmentCard } from '@/components/ui/AppointmentCard';

interface TopService {
  name: string;
  count: number;
  revenue: number;
}

interface PeakHour {
  hour: number;
  count: number;
}

const currency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function useRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString() };
}

export default function DashboardPage() {
  const [role, setRole] = useState<Role | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setRole(getCurrentUser()?.role ?? null);
    setReady(true);
  }, []);

  if (!ready) return null;

  if (role === 'CLIENT') return <ClientHome />;
  if (role === 'ADMIN' || role === 'MANAGER' || role === 'FINANCE') return <ManagementDashboard />;
  return <OperationalHome />;
}

function TodayAgenda({ title = 'Agenda de hoje' }: { title?: string }) {
  const { timezone } = useCompany();
  const [appointments, setAppointments] = useState<AppointmentRecord[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const { from, to } = todayRangeInZone(timezone);
    api
      .get<AppointmentRecord[]>(`/appointments?from=${from}&to=${to}`)
      .then(setAppointments)
      .catch(() => setError(true));
  }, [timezone]);

  return (
    <Card>
      <h3 className="font-medium mb-3 text-graphite-900 dark:text-white">{title}</h3>
      {error && <p className="text-sm text-danger">Não foi possível carregar a agenda de hoje.</p>}
      {!error && appointments === null && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      )}
      {appointments && appointments.length === 0 && (
        <EmptyState icon="🗓️" title="Nada agendado para hoje" />
      )}
      {appointments && appointments.length > 0 && (
        <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
          {appointments.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-3 rounded-xl border border-black/5 dark:border-white/10 p-3"
            >
              <span className="text-sm font-semibold text-primary-500 w-14 shrink-0">
                {formatTimeInZone(a.startAt, timezone)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-graphite-900 dark:text-white truncate">
                  {a.client.user.name}
                </p>
                <p className="text-xs text-graphite-500 dark:text-white/50 truncate">
                  {a.vehicle.brand} {a.vehicle.model} · {a.services.map((s) => s.service.name).join(', ')}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function ShortcutRow({ items }: { items: { href: string; label: string; icon: string }[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map((item) => (
        <Link key={item.href} href={item.href}>
          <Card className="!p-4 flex flex-col items-center justify-center gap-1.5 text-center hover:border-primary-500/40 transition-colors h-full">
            <span className="text-xl">{item.icon}</span>
            <span className="text-xs font-medium text-graphite-700 dark:text-white/70">{item.label}</span>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function ManagementDashboard() {
  const { from, to } = useRange();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [topServices, setTopServices] = useState<TopService[]>([]);
  const [peakHours, setPeakHours] = useState<PeakHour[]>([]);
  const [orderCounts, setOrderCounts] = useState<{ open: number; inProgress: number; ready: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<DashboardSummary>(`/dashboard/summary?from=${from}&to=${to}`),
      api.get<TopService[]>(`/dashboard/top-services?from=${from}&to=${to}`),
      api.get<PeakHour[]>(`/dashboard/peak-hours?from=${from}&to=${to}`),
    ])
      .then(([s, t, p]) => {
        setSummary(s);
        setTopServices(t);
        setPeakHours(p);
      })
      .catch(() => setError('Não foi possível carregar os indicadores do período.'));
  }, [from, to]);

  useEffect(() => {
    Promise.all([
      api.get<unknown[]>('/service-orders?status=OPEN'),
      api.get<unknown[]>('/service-orders?status=IN_PROGRESS'),
      api.get<unknown[]>('/service-orders?status=COMPLETED'),
    ])
      .then(([open, inProgress, ready]) =>
        setOrderCounts({ open: open.length, inProgress: inProgress.length, ready: ready.length }),
      )
      .catch(() => undefined);
  }, []);

  return (
    <div>
      <PageHeader title="Dashboard" description={`Período: ${from} até ${to.slice(0, 10)}`} />

      {error && <p className="text-sm text-danger mb-4">{error}</p>}

      <div className="mb-5">
        <ShortcutRow
          items={[
            { href: '/scheduling', label: 'Nova agenda', icon: '📅' },
            { href: '/clients', label: 'Novo cliente', icon: '👤' },
            { href: '/service-orders', label: 'Ordens de serviço', icon: '🧾' },
            { href: '/financial', label: 'Financeiro', icon: '💰' },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        <MetricCard
          label="Aguardando"
          value={orderCounts ? String(orderCounts.open) : '—'}
          tone="warning"
          icon="🚗"
        />
        <MetricCard
          label="Em andamento"
          value={orderCounts ? String(orderCounts.inProgress) : '—'}
          tone="primary"
          icon="🧽"
        />
        <MetricCard
          label="Prontos"
          value={orderCounts ? String(orderCounts.ready) : '—'}
          tone="success"
          icon="✅"
        />
      </div>

      {summary ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <MetricCard label="Receita" value={currency(summary.revenue)} tone="success" />
          <MetricCard label="Lucro" value={currency(summary.profit)} tone="primary" />
          <MetricCard label="Ticket médio" value={currency(summary.ticketMedio)} />
          <MetricCard
            label="OS concluídas"
            value={String(summary.ordersCompleted)}
            hint={`${summary.distinctClientsServed} clientes atendidos`}
          />
          <MetricCard label="Novos clientes" value={String(summary.newClients)} />
          <MetricCard
            label="Cancelamentos"
            value={`${summary.cancellationRate}%`}
            hint={`${summary.cancelledAppointments} de ${summary.totalAppointments}`}
            tone="warning"
          />
          <MetricCard
            label="Avaliação média"
            value={summary.averageRating ? summary.averageRating.toFixed(1) : '—'}
          />
          <MetricCard label="Despesas" value={currency(summary.expense)} tone="danger" />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      <div className="mb-4">
        <TodayAgenda />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="font-medium mb-4">Serviços mais vendidos</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={topServices}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#2f7cf6" radius={[6, 6, 0, 0]} name="Quantidade" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <h3 className="font-medium mb-4">Horários de pico</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={peakHours}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="hour" tick={{ fontSize: 11 }} tickFormatter={(h) => `${h}h`} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip labelFormatter={(h) => `${h}h`} />
              <Bar dataKey="count" fill="#2fbf71" radius={[6, 6, 0, 0]} name="Agendamentos" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

function OperationalHome() {
  return (
    <div>
      <PageHeader title="Início" description="Agenda e atalhos operacionais de hoje" />
      <div className="mb-5">
        <ShortcutRow
          items={[
            { href: '/scheduling', label: 'Agenda', icon: '📅' },
            { href: '/service-orders', label: 'Ordens de serviço', icon: '🧾' },
          ]}
        />
      </div>
      <TodayAgenda />
    </div>
  );
}

function ClientHome() {
  const [appointments, setAppointments] = useState<AppointmentRecord[] | null>(null);
  const [error, setError] = useState(false);
  const user = getCurrentUser();

  useEffect(() => {
    const from = new Date();
    const to = new Date();
    to.setDate(to.getDate() + 60);
    api
      .get<AppointmentRecord[]>(`/appointments?from=${from.toISOString()}&to=${to.toISOString()}`)
      .then((all) => setAppointments(all.filter((a) => a.client.id === user?.clientId)))
      .catch(() => setError(true));
  }, [user?.clientId]);

  const upcoming = appointments?.filter((a) => !['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(a.status)) ?? [];

  return (
    <div>
      <PageHeader title="Olá!" description="Seu próximo agendamento e atalhos rápidos" />

      <div className="mb-5">
        <ShortcutRow
          items={[
            { href: '/agendar', label: 'Agendar', icon: '➕' },
            { href: '/historico', label: 'Histórico', icon: '🕘' },
          ]}
        />
      </div>

      <h3 className="font-medium mb-3 text-graphite-900 dark:text-white">Próximo agendamento</h3>
      {error && <p className="text-sm text-danger">Não foi possível carregar seus agendamentos.</p>}
      {!error && appointments === null && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-24 w-full" />
        </div>
      )}
      {appointments && upcoming.length === 0 && (
        <EmptyState
          icon="🚗"
          title="Nenhum agendamento futuro"
          description="Que tal marcar seu próximo horário agora?"
          action={
            <Link href="/agendar">
              <Button>Agendar horário</Button>
            </Link>
          }
        />
      )}
      {upcoming.length > 0 && (
        <div className="flex flex-col gap-3">
          {upcoming.slice(0, 3).map((a) => (
            <AppointmentCard
              key={a.id}
              dateTime={new Intl.DateTimeFormat('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              }).format(new Date(a.startAt))}
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
