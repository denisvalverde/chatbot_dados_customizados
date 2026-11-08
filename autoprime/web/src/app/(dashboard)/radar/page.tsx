'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import {
  brl,
  factsFor,
  KIND_META,
  OpportunityKind,
  RadarOpportunity,
  RadarResults,
  RadarScan,
  shortDay,
  withMessage,
} from '@/lib/radar';
import { cn } from '@/lib/cn';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';

type Filter = 'ALL' | OpportunityKind;
const FILTER_ORDER: OpportunityKind[] = ['NO_SHOW_RECOVERY', 'WIN_BACK', 'DUE_NOW', 'UPSELL'];

export default function RadarPage() {
  const [scan, setScan] = useState<RadarScan | null>(null);
  const [results, setResults] = useState<RadarResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [contacted, setContacted] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    setError(null);
    Promise.all([
      api.get<RadarScan>('/revenue-radar'),
      api.get<RadarResults>('/revenue-radar/results?days=30'),
    ])
      .then(([s, r]) => {
        setScan(s);
        setResults(r);
      })
      .catch(() => setError('Não foi possível rodar o Radar agora. Tente novamente em instantes.'));
  }, []);

  useEffect(load, [load]);

  const visible = useMemo(() => {
    if (!scan) return [];
    return scan.opportunities.filter((o) => filter === 'ALL' || o.kind === filter);
  }, [scan, filter]);

  const markContacted = (clientId: string) =>
    setContacted((prev) => new Set(prev).add(clientId));

  return (
    <div>
      <PageHeader
        title="Radar de Receita"
        description="O dinheiro parado na sua base de clientes — com a mensagem e o horário livre já prontos."
        actions={
          <Button variant="ghost" size="sm" onClick={load}>
            ↻ Atualizar
          </Button>
        }
      />

      {error && <p className="text-sm text-danger mb-4">{error}</p>}

      {!scan && !error && <LoadingState />}

      {scan && (
        <>
          <Hero scan={scan} results={results} />
          <CapacityStrip scan={scan} />

          <div className="flex gap-2 overflow-x-auto pb-1 mb-4 -mx-1 px-1">
            <FilterChip
              active={filter === 'ALL'}
              onClick={() => setFilter('ALL')}
              label="Todas"
              count={scan.summary.opportunities}
            />
            {FILTER_ORDER.map((k) => (
              <FilterChip
                key={k}
                active={filter === k}
                onClick={() => setFilter(k)}
                label={`${KIND_META[k].icon} ${KIND_META[k].short}`}
                count={scan.summary.byKind[k].count}
              />
            ))}
          </div>

          {visible.length === 0 ? (
            <Card>
              <EmptyState
                icon="🌱"
                title="Nada na mesa por aqui"
                description="Quando um cliente passar do ritmo dele, faltar sem remarcar ou estiver pronto para um serviço novo, ele aparece aqui."
              />
            </Card>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {visible.map((o) => (
                <OpportunityCard
                  key={o.clientId}
                  opportunity={o}
                  justContacted={contacted.has(o.clientId)}
                  onContacted={() => markContacted(o.clientId)}
                />
              ))}
            </div>
          )}

          {results && <ResultsCard results={results} />}
          <HowItWorks scan={scan} />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Hero({ scan, results }: { scan: RadarScan; results: RadarResults | null }) {
  const { summary } = scan;
  return (
    <div className="grid gap-3 lg:grid-cols-3 mb-4">
      <div className="lg:col-span-2 relative overflow-hidden rounded-2xl p-5 sm:p-6 text-white bg-gradient-to-br from-primary-600 via-primary-500 to-graphite-900 shadow-lg shadow-primary-500/20">
        <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <p className="text-xs font-medium uppercase tracking-wider text-white/70">Na mesa agora</p>
        <p className="mt-1 text-4xl sm:text-5xl font-semibold tracking-tight">
          {brl(summary.potentialRevenue)}
        </p>
        <p className="mt-2 text-sm text-white/80 max-w-lg">
          {summary.opportunities} {summary.opportunities === 1 ? 'cliente pronto' : 'clientes prontos'} para
          voltar. Estimativa realista de retorno: <strong>{brl(summary.expectedRevenue)}</strong>.
        </p>
        {summary.annualRevenueAtRisk > 0 && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-black/20 px-3 py-1 text-xs text-white/90">
            ⚠️ {brl(summary.annualRevenueAtRisk)}/ano em risco com clientes que sumiram ou faltaram
          </p>
        )}
      </div>

      <Card className="flex flex-col justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-graphite-500 dark:text-white/50">
            Já recuperado · 30 dias
          </p>
          <p className="mt-1 text-3xl font-semibold text-success">
            {results ? brl(results.recoveredRevenue) : '—'}
          </p>
        </div>
        {results && (
          <p className="text-sm text-graphite-500 dark:text-white/60">
            {results.contacted === 0
              ? 'Envie a primeira mensagem — cada cliente que agendar em até 14 dias entra aqui.'
              : `${results.converted} de ${results.contacted} ${results.contacted === 1 ? 'contato voltou' : 'contatos voltaram'} (${Math.round(results.conversionRate * 100)}%).`}
          </p>
        )}
      </Card>
    </div>
  );
}

function CapacityStrip({ scan }: { scan: RadarScan }) {
  const { capacity, benchmarks } = scan;
  const max = Math.max(1, ...capacity.days.map((d) => d.freeSlots));
  if (capacity.days.length === 0) return null;
  return (
    <Card className="mb-4 !p-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-graphite-500 dark:text-white/50">
            Agenda ociosa · próximos 7 dias
          </p>
          <p className="mt-1 text-sm text-graphite-700 dark:text-white/80">
            <strong className="text-graphite-900 dark:text-white">{capacity.freeSlots} horários livres</strong>{' '}
            ≈ {brl(capacity.idleRevenue)} pelo seu ticket médio de {brl(benchmarks.averageTicket)}. Os melhores já
            estão oferecidos nas mensagens abaixo.
          </p>
        </div>
        <div className="flex items-end gap-1.5 h-14 shrink-0" aria-label="Horários livres por dia">
          {capacity.days.map((d) => (
            <div key={d.date} className="flex flex-col items-center gap-1 w-8" title={`${d.freeSlots} horários livres`}>
              <div
                className="w-full rounded-md bg-primary-500/70"
                style={{ height: `${Math.max(4, (d.freeSlots / max) * 36)}px` }}
              />
              <span className="text-[10px] text-graphite-500 dark:text-white/50">{shortDay(d.date)}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'border-primary-500 bg-primary-500/10 text-primary-500'
          : 'border-black/10 dark:border-white/10 text-graphite-600 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/5',
      )}
    >
      {label}
      <span className="text-xs opacity-70">{count}</span>
    </button>
  );
}

function OpportunityCard({
  opportunity: o,
  justContacted,
  onContacted,
}: {
  opportunity: RadarOpportunity;
  justContacted: boolean;
  onContacted: () => void;
}) {
  const toast = useToast();
  const [message, setMessage] = useState(o.message);
  const [aiBusy, setAiBusy] = useState(false);
  const meta = KIND_META[o.kind];
  const done = justContacted || o.contactedRecently;

  const register = () =>
    api
      .post('/revenue-radar/outreach', {
        clientId: o.clientId,
        kind: o.kind,
        message,
        estimatedValue: o.potentialValue,
      })
      .then(() => {
        onContacted();
        toast.show(`Contato com ${o.clientName.split(' ')[0]} registrado. Se agendar, entra no recuperado.`, 'success');
      })
      .catch(() => toast.show('Mensagem aberta, mas não consegui registrar o contato.', 'danger'));

  const sendWhatsapp = () => {
    if (!o.whatsappUrl) return;
    // Abre antes do await — navegadores bloqueiam pop-ups abertos depois de uma promise.
    window.open(withMessage(o.whatsappUrl, message), '_blank', 'noopener');
    void register();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      toast.show('Mensagem copiada.', 'neutral');
    } catch {
      toast.show('Não consegui copiar — selecione o texto manualmente.', 'danger');
    }
  };

  const personalize = () => {
    setAiBusy(true);
    api
      .post<{ message: string; generatedBy: 'claude' | 'template' }>('/revenue-radar/personalize', {
        clientId: o.clientId,
        message,
        facts: factsFor(o),
      })
      .then((r) => {
        setMessage(r.message);
        toast.show(
          r.generatedBy === 'claude' ? 'Mensagem reescrita com IA.' : 'IA indisponível — mantive o rascunho.',
          r.generatedBy === 'claude' ? 'success' : 'neutral',
        );
      })
      .catch(() => toast.show('Não foi possível personalizar agora.', 'danger'))
      .finally(() => setAiBusy(false));
  };

  return (
    <Card className={cn('!p-4 sm:!p-5 flex flex-col gap-3 transition-opacity', done && 'opacity-60')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-graphite-900 dark:text-white truncate">{o.clientName}</p>
            <Badge tone={meta.tone}>
              {meta.icon} {meta.label}
            </Badge>
          </div>
          <p className="text-sm text-graphite-500 dark:text-white/60 mt-0.5">
            {o.vehicleLabel ? `${o.vehicleLabel} · ` : ''}
            {o.reason}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-semibold text-graphite-900 dark:text-white">{brl(o.potentialValue)}</p>
          <p className="text-[11px] text-graphite-400 dark:text-white/40">
            {Math.round(o.probability * 100)}% de chance
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {o.suggestedSlot && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-primary-500/10 text-primary-500 px-2 py-1 font-medium">
            📅 {o.suggestedSlot.label}
          </span>
        )}
        {o.suggestedService && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-success/10 text-success px-2 py-1 font-medium">
            ✨ {o.suggestedService.name} · {brl(o.suggestedService.price)}
          </span>
        )}
        {o.kind !== 'UPSELL' && o.annualValueAtRisk > 0 && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-black/5 dark:bg-white/5 text-graphite-600 dark:text-white/60 px-2 py-1">
            vale {brl(o.annualValueAtRisk)}/ano
          </span>
        )}
      </div>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
        aria-label={`Mensagem para ${o.clientName}`}
        className="w-full resize-y rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-graphite-900/60 p-3 text-sm text-graphite-800 dark:text-white/90 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
      />

      {done ? (
        <p className="text-sm font-medium text-success">
          ✓ Contatado{o.lastContactedAt && !justContacted ? ` em ${new Date(o.lastContactedAt).toLocaleDateString('pt-BR')}` : ' agora'} —
          aguardando resposta
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {o.whatsappUrl ? (
            <Button onClick={sendWhatsapp} className="!bg-[#1faa59] hover:!bg-[#178a48] !border-[#1faa59]/30 !shadow-[#1faa59]/20">
              Enviar no WhatsApp
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => { void copy(); void register(); }}>
              Sem telefone · copiar e registrar
            </Button>
          )}
          <Button variant="ghost" onClick={personalize} disabled={aiBusy}>
            {aiBusy ? 'Personalizando…' : '✨ Personalizar com IA'}
          </Button>
          <Button variant="ghost" onClick={copy}>
            Copiar
          </Button>
        </div>
      )}
    </Card>
  );
}

function ResultsCard({ results }: { results: RadarResults }) {
  if (results.conversions.length === 0) return null;
  return (
    <Card className="mt-6">
      <h3 className="font-medium text-graphite-900 dark:text-white mb-3">Quem voltou por causa do Radar</h3>
      <div className="flex flex-col divide-y divide-black/5 dark:divide-white/10">
        {results.conversions.map((c) => (
          <div key={c.outreachId} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-graphite-900 dark:text-white truncate">{c.clientName}</p>
              <p className="text-xs text-graphite-500 dark:text-white/50">
                {KIND_META[c.kind].icon} contatado {new Date(c.contactedAt).toLocaleDateString('pt-BR')} → agendou{' '}
                {new Date(c.bookedAt).toLocaleDateString('pt-BR')}
              </p>
            </div>
            <span className="text-sm font-semibold text-success shrink-0">+{brl(c.value)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function HowItWorks({ scan }: { scan: RadarScan }) {
  return (
    <details className="mt-6 rounded-2xl border border-black/5 dark:border-white/10 p-4 text-sm text-graphite-600 dark:text-white/60">
      <summary className="cursor-pointer font-medium text-graphite-800 dark:text-white/80">
        Como o Radar calcula esses valores
      </summary>
      <ul className="mt-3 flex flex-col gap-1.5 list-disc pl-5">
        <li>
          Cada cliente tem o próprio ritmo: a mediana dos intervalos entre as visitas dele. Quem ainda não tem
          histórico usa o ritmo típico da casa ({scan.benchmarks.companyCadenceDays} dias).
        </li>
        <li>
          <strong>No ponto</strong>: a partir de 85% do ritmo. <strong>Sumiu</strong>: passou de 1,5× o ritmo
          (a chance cai quanto mais tempo passa). Depois de 1 ano, deixamos quieto.
        </li>
        <li>
          <strong>Faltas</strong>: faltou ou cancelou nos últimos 30 dias e não remarcou.{' '}
          <strong>Upsell</strong>: serviço que clientes com o mesmo histórico compram e este ainda não.
        </li>
        <li>
          Os horários oferecidos são livres de verdade na agenda — e cada um vai para uma pessoa só, começando
          pela oportunidade mais valiosa.
        </li>
        <li>
          Quem já tem horário marcado nunca aparece. Quem foi contatado nos últimos 7 dias fica marcado para
          ninguém insistir.
        </li>
        <li>
          <strong>Recuperado</strong> = agendamentos criados até 14 dias depois de um contato feito por aqui.
        </li>
      </ul>
    </details>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 lg:grid-cols-3">
        <Skeleton className="lg:col-span-2 h-40 rounded-2xl" />
        <SkeletonCard />
      </div>
      <Skeleton className="h-20 rounded-2xl" />
      <div className="grid gap-3 lg:grid-cols-2">
        <Skeleton className="h-56 rounded-2xl" />
        <Skeleton className="h-56 rounded-2xl" />
      </div>
    </div>
  );
}
