export type OpportunityKind = 'NO_SHOW_RECOVERY' | 'WIN_BACK' | 'DUE_NOW' | 'UPSELL';

export interface RadarOpportunity {
  clientId: string;
  clientName: string;
  phone: string | null;
  vehicleLabel: string | null;
  kind: OpportunityKind;
  reason: string;
  potentialValue: number;
  expectedValue: number;
  probability: number;
  annualValueAtRisk: number;
  cadenceDays: number;
  cadenceSource: 'personal' | 'company';
  daysSinceLastVisit: number | null;
  visits: number;
  suggestedService: { id: string; name: string; price: number } | null;
  suggestedSlot: { startAt: string; endAt: string; label: string } | null;
  message: string;
  whatsappUrl: string | null;
  lastContactedAt: string | null;
  contactedRecently: boolean;
  priority: number;
}

export interface RadarScan {
  generatedAt: string;
  timezone: string;
  benchmarks: { averageTicket: number; averageServiceMinutes: number; companyCadenceDays: number };
  summary: {
    opportunities: number;
    potentialRevenue: number;
    expectedRevenue: number;
    annualRevenueAtRisk: number;
    byKind: Record<OpportunityKind, { count: number; potentialRevenue: number }>;
  };
  capacity: {
    days: { date: string; freeMinutes: number; freeSlots: number; idleRevenue: number }[];
    freeSlots: number;
    idleRevenue: number;
  };
  opportunities: RadarOpportunity[];
}

export interface RadarResults {
  periodDays: number;
  attributionWindowDays: number;
  contacted: number;
  converted: number;
  conversionRate: number;
  recoveredRevenue: number;
  conversions: {
    outreachId: string;
    clientId: string;
    clientName: string;
    kind: OpportunityKind;
    contactedAt: string;
    bookedAt: string;
    value: number;
  }[];
}

export const KIND_META: Record<
  OpportunityKind,
  { label: string; short: string; icon: string; tone: 'danger' | 'warning' | 'primary' | 'success' }
> = {
  NO_SHOW_RECOVERY: { label: 'Faltou e não remarcou', short: 'Faltas', icon: '⏰', tone: 'danger' },
  WIN_BACK: { label: 'Sumiu', short: 'Sumidos', icon: '👋', tone: 'warning' },
  DUE_NOW: { label: 'No ponto de voltar', short: 'No ponto', icon: '🎯', tone: 'primary' },
  UPSELL: { label: 'Pronto para o próximo nível', short: 'Upsell', icon: '✨', tone: 'success' },
};

export const brl = (v: number, digits = 0) =>
  v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

/** Troca o texto de um link wa.me mantendo o número — usado quando a equipe edita a mensagem. */
export function withMessage(whatsappUrl: string, message: string): string {
  return `${whatsappUrl.split('?')[0]}?text=${encodeURIComponent(message)}`;
}

/** "ter 10" a partir de "2026-11-10", sem depender do fuso do navegador. */
export function shortDay(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('pt-BR', {
    weekday: 'short',
    timeZone: 'UTC',
  });
  return `${weekday.replace('.', '')} ${d}`;
}

export function factsFor(o: RadarOpportunity): string[] {
  const facts = [o.reason];
  if (o.vehicleLabel) facts.push(`Carro: ${o.vehicleLabel}`);
  if (o.visits) facts.push(`Já veio ${o.visits} ${o.visits === 1 ? 'vez' : 'vezes'}`);
  if (o.suggestedService) facts.push(`Serviço sugerido: ${o.suggestedService.name}`);
  if (o.suggestedSlot) facts.push(`Horário livre oferecido: ${o.suggestedSlot.label}`);
  return facts;
}
