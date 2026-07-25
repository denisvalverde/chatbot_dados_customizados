'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

const PLANNED_BENEFITS = [
  'Lavagens recorrentes com desconto progressivo',
  'Prioridade de horários na agenda',
  'Cobrança automática mensal',
  'Acompanhamento de uso e histórico de fidelidade',
];

export default function AssinaturaPage() {
  return (
    <div>
      <PageHeader title="Assinatura" description="Planos recorrentes para o seu veículo" />

      <Card className="text-center !py-10 mb-5">
        <span className="text-3xl">⭐</span>
        <div className="flex items-center justify-center gap-2 mt-3">
          <h2 className="text-lg font-semibold text-graphite-900 dark:text-white">Em implantação</h2>
          <Badge tone="warning">Em breve</Badge>
        </div>
        <p className="text-sm text-graphite-500 dark:text-white/50 mt-2 max-w-sm mx-auto">
          Estamos preparando planos de assinatura para lavagens recorrentes. Nenhuma cobrança é
          feita hoje — esta tela ficará disponível assim que o módulo for lançado.
        </p>
      </Card>

      <h3 className="font-medium mb-3 text-graphite-900 dark:text-white">O que está a caminho</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {PLANNED_BENEFITS.map((b) => (
          <Card key={b} className="!p-4 flex items-start gap-2">
            <span className="text-primary-500 mt-0.5">•</span>
            <span className="text-sm text-graphite-700 dark:text-white/70">{b}</span>
          </Card>
        ))}
      </div>
    </div>
  );
}
