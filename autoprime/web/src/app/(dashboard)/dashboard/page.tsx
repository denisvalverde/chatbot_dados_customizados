'use client';

import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '@/lib/api';
import { DashboardSummary } from '@/lib/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Card } from '@/components/ui/Card';

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
  // `to` fica como o instante atual (não truncado para meia-noite), senão o
  // filtro `lte` no backend excluiria tudo que aconteceu hoje.
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString() };
}

export default function DashboardPage() {
  const { from, to } = useRange();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [topServices, setTopServices] = useState<TopService[]>([]);
  const [peakHours, setPeakHours] = useState<PeakHour[]>([]);
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

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Período: ${from} até ${to.slice(0, 10)}`}
      />

      {error && <p className="text-sm text-danger mb-4">{error}</p>}

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Receita" value={currency(summary.revenue)} tone="success" />
          <StatCard label="Lucro" value={currency(summary.profit)} tone="primary" />
          <StatCard label="Ticket médio" value={currency(summary.ticketMedio)} />
          <StatCard
            label="OS concluídas"
            value={String(summary.ordersCompleted)}
            hint={`${summary.distinctClientsServed} clientes atendidos`}
          />
          <StatCard label="Novos clientes" value={String(summary.newClients)} />
          <StatCard
            label="Cancelamentos"
            value={`${summary.cancellationRate}%`}
            hint={`${summary.cancelledAppointments} de ${summary.totalAppointments}`}
            tone="warning"
          />
          <StatCard
            label="Avaliação média"
            value={summary.averageRating ? summary.averageRating.toFixed(1) : '—'}
          />
          <StatCard label="Despesas" value={currency(summary.expense)} tone="danger" />
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="font-medium mb-4">Serviços mais vendidos</h3>
          <ResponsiveContainer width="100%" height={260}>
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
          <ResponsiveContainer width="100%" height={260}>
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
