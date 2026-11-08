/**
 * Radar de Receita — motor puro (sem Prisma, sem I/O, sem relógio implícito).
 *
 * Recebe o histórico real de uma empresa e devolve, em R$, o dinheiro que está
 * parado na mesa: clientes que já deveriam ter voltado, clientes que sumiram,
 * horários faltados que ninguém remarcou e serviços que clientes parecidos
 * compram e este cliente ainda não experimentou. Cada oportunidade sai com
 * mensagem pronta e um horário livre REAL da agenda já reservado para ela.
 *
 * Tudo aqui é determinístico e testável: `now` é sempre recebido por
 * parâmetro. As probabilidades são heurísticas conservadoras e documentadas —
 * a prova de verdade vem de `attributeOutreach`, que mede o que de fato voltou.
 */
import { DateTime } from 'luxon';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type OpportunityKind = 'NO_SHOW_RECOVERY' | 'WIN_BACK' | 'DUE_NOW' | 'UPSELL';

export const OPPORTUNITY_KINDS: OpportunityKind[] = [
  'NO_SHOW_RECOVERY',
  'WIN_BACK',
  'DUE_NOW',
  'UPSELL',
];

export interface RadarVisit {
  at: Date;
  value: number;
  serviceIds: string[];
}

export interface RadarMissedAppointment {
  at: Date;
  status: 'CANCELLED' | 'NO_SHOW';
  value: number;
  serviceIds: string[];
}

export interface RadarClientInput {
  clientId: string;
  name: string;
  phone: string | null;
  vehicle: { brand: string; model: string } | null;
  visits: RadarVisit[];
  hasUpcomingAppointment: boolean;
  /** Agendamento mais recente, se ele foi cancelado/faltado. */
  lastMissed: RadarMissedAppointment | null;
  lastContactedAt: Date | null;
}

export interface RadarServiceInput {
  id: string;
  name: string;
  price: number;
  estimatedMinutes: number;
}

export interface RadarBusyInterval {
  startAt: Date;
  endAt: Date;
}

export interface RadarInput {
  now: Date;
  timezone: string;
  companyName: string;
  clients: RadarClientInput[];
  services: RadarServiceInput[];
  /** Agendamentos ativos a partir de agora (usados para achar horários livres). */
  busy: RadarBusyInterval[];
}

export interface SuggestedSlot {
  startAt: string;
  endAt: string;
  label: string;
}

export interface Opportunity {
  clientId: string;
  clientName: string;
  phone: string | null;
  vehicleLabel: string | null;
  kind: OpportunityKind;
  reason: string;
  /** Ticket que volta para o caixa se o cliente responder (R$). */
  potentialValue: number;
  /** potentialValue × probabilidade estimada (R$). */
  expectedValue: number;
  probability: number;
  /** Faturamento anual deste cliente que está em jogo (R$). */
  annualValueAtRisk: number;
  cadenceDays: number;
  cadenceSource: 'personal' | 'company';
  daysSinceLastVisit: number | null;
  visits: number;
  suggestedService: { id: string; name: string; price: number } | null;
  suggestedSlot: SuggestedSlot | null;
  message: string;
  whatsappUrl: string | null;
  lastContactedAt: string | null;
  contactedRecently: boolean;
  priority: number;
}

export interface CapacityDay {
  date: string;
  freeMinutes: number;
  freeSlots: number;
  idleRevenue: number;
}

export interface RadarResult {
  generatedAt: string;
  timezone: string;
  benchmarks: {
    averageTicket: number;
    averageServiceMinutes: number;
    companyCadenceDays: number;
  };
  summary: {
    opportunities: number;
    potentialRevenue: number;
    expectedRevenue: number;
    annualRevenueAtRisk: number;
    byKind: Record<OpportunityKind, { count: number; potentialRevenue: number }>;
  };
  capacity: {
    days: CapacityDay[];
    freeSlots: number;
    idleRevenue: number;
  };
  opportunities: Opportunity[];
}

// ---------------------------------------------------------------------------
// Parâmetros do modelo (heurísticas explícitas, fáceis de calibrar)
// ---------------------------------------------------------------------------

export const RADAR_RULES = {
  /** Cliente entra em "no ponto de voltar" a partir de 85% do próprio ritmo. */
  dueRatio: 0.85,
  /** Acima de 1,5× o próprio ritmo o cliente é considerado "sumido". */
  lateRatio: 1.5,
  /** Acima de 6× o ritmo (ou 1 ano) consideramos perdido — não vale ruído. */
  lostRatio: 6,
  lostAfterDays: 365,
  minCadenceDays: 7,
  maxCadenceDays: 180,
  fallbackCadenceDays: 30,
  /** Falta/cancelamento só é recuperável se recente. */
  missedWindowDays: 30,
  /** Não sugerir recontato antes disto. */
  contactCooldownDays: 7,
  /** Antecedência mínima para oferecer um horário livre. */
  slotLeadMinutes: 60,
  capacityHorizonDays: 7,
  /** Horário comercial — o mesmo usado por AiService.suggestSlots. */
  businessHours: { start: '08:00', end: '18:00' },
  /** 0 = domingo (luxon usa 7). Domingo fechado por padrão. */
  closedWeekdays: [7] as number[],
  probability: {
    NO_SHOW_RECOVERY: 0.5,
    DUE_NOW: 0.45,
    WIN_BACK: 0.35,
    UPSELL: 0.3,
  } as Record<OpportunityKind, number>,
  priorityWeight: {
    NO_SHOW_RECOVERY: 1.3,
    WIN_BACK: 1.2,
    DUE_NOW: 1.0,
    UPSELL: 0.8,
  } as Record<OpportunityKind, number>,
  upsell: { minConfidence: 0.2, minBuyers: 2 },
  attributionWindowDays: 14,
};

const DAY_MS = 86_400_000;

// ---------------------------------------------------------------------------
// Utilidades puras
// ---------------------------------------------------------------------------

const round2 = (n: number) => Math.round(n * 100) / 100;

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function firstName(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? '';
  return first ? first[0].toUpperCase() + first.slice(1).toLowerCase() : 'tudo bem';
}

/**
 * Normaliza telefone brasileiro para o formato do wa.me (55 + DDD + número).
 * Aceita "(11) 99999-0000", "11999990000", "+55 11 99999-0000" etc.
 */
export function normalizeBrazilianPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  if (!digits.startsWith('55') || (digits.length !== 12 && digits.length !== 13)) return null;
  return digits;
}

export function whatsappLink(phone: string | null | undefined, message: string): string | null {
  const normalized = normalizeBrazilianPhone(phone);
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

/** Ritmo pessoal: mediana dos intervalos entre visitas (dias), visitas no mesmo dia contam uma vez. */
export function personalCadenceDays(visits: RadarVisit[]): number | null {
  const days = Array.from(new Set(visits.map((v) => Math.floor(v.at.getTime() / DAY_MS)))).sort(
    (a, b) => a - b,
  );
  if (days.length < 2) return null;
  const gaps: number[] = [];
  for (let i = 1; i < days.length; i++) gaps.push(days[i] - days[i - 1]);
  const m = Math.round(median(gaps)!);
  return Math.min(RADAR_RULES.maxCadenceDays, Math.max(RADAR_RULES.minCadenceDays, m));
}

/** Rótulo amigável em pt-BR no fuso da empresa: "hoje às 15:00", "amanhã às 09:30", "sexta (13/11) às 10:00". */
export function humanSlotLabel(instant: Date, now: Date, timezone: string): string {
  const dt = DateTime.fromJSDate(instant).setZone(timezone).setLocale('pt-BR');
  const today = DateTime.fromJSDate(now).setZone(timezone).startOf('day');
  const diff = Math.round(dt.startOf('day').diff(today, 'days').days);
  const time = dt.toFormat('HH:mm');
  if (diff === 0) return `hoje às ${time}`;
  if (diff === 1) return `amanhã às ${time}`;
  const weekday = dt.toFormat('cccc').replace('-feira', '');
  return `${weekday} (${dt.toFormat('dd/LL')}) às ${time}`;
}

// ---------------------------------------------------------------------------
// Agenda: janelas livres e capacidade ociosa
// ---------------------------------------------------------------------------

interface Interval {
  start: number;
  end: number;
}

function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: Interval[] = [];
  for (const it of sorted) {
    const last = merged[merged.length - 1];
    if (last && it.start <= last.end) last.end = Math.max(last.end, it.end);
    else merged.push({ ...it });
  }
  return merged;
}

/**
 * Janelas livres do horário comercial nos próximos `horizonDays` dias, já
 * descontando agendamentos ativos (mesma premissa de "uma baia" usada por
 * AiService.suggestSlots: qualquer agendamento bloqueia o horário).
 */
export function freeWindows(
  now: Date,
  timezone: string,
  busy: RadarBusyInterval[],
  horizonDays = RADAR_RULES.capacityHorizonDays,
): { date: string; windows: Interval[] }[] {
  const blocked = mergeIntervals(
    busy.map((b) => ({ start: b.startAt.getTime(), end: b.endAt.getTime() })),
  );
  const earliest = now.getTime() + RADAR_RULES.slotLeadMinutes * 60_000;
  const today = DateTime.fromJSDate(now).setZone(timezone).startOf('day');
  const result: { date: string; windows: Interval[] }[] = [];

  for (let d = 0; d < horizonDays; d++) {
    const day = today.plus({ days: d });
    if (RADAR_RULES.closedWeekdays.includes(day.weekday)) continue;
    const date = day.toFormat('yyyy-LL-dd');
    const [sh, sm] = RADAR_RULES.businessHours.start.split(':').map(Number);
    const [eh, em] = RADAR_RULES.businessHours.end.split(':').map(Number);
    let open = day.set({ hour: sh, minute: sm }).toMillis();
    const close = day.set({ hour: eh, minute: em }).toMillis();
    if (close <= earliest) {
      result.push({ date, windows: [] });
      continue;
    }
    if (open < earliest) {
      // Arredonda para o próximo múltiplo de 30 min — horário "redondo" para oferecer.
      const step = 30 * 60_000;
      open = Math.ceil(earliest / step) * step;
    }

    const windows: Interval[] = [];
    let cursor = open;
    for (const b of blocked) {
      if (b.end <= cursor) continue;
      if (b.start >= close) break;
      if (b.start > cursor) windows.push({ start: cursor, end: Math.min(b.start, close) });
      cursor = Math.max(cursor, b.end);
      if (cursor >= close) break;
    }
    if (cursor < close) windows.push({ start: cursor, end: close });
    result.push({ date, windows: windows.filter((w) => w.end > w.start) });
  }
  return result;
}

export function computeCapacity(
  days: { date: string; windows: Interval[] }[],
  averageServiceMinutes: number,
  averageTicket: number,
) {
  const out: CapacityDay[] = days.map(({ date, windows }) => {
    const freeMinutes = Math.round(windows.reduce((s, w) => s + (w.end - w.start) / 60_000, 0));
    const freeSlots = windows.reduce(
      (s, w) => s + Math.floor((w.end - w.start) / 60_000 / averageServiceMinutes),
      0,
    );
    return { date, freeMinutes, freeSlots, idleRevenue: round2(freeSlots * averageTicket) };
  });
  return {
    days: out,
    freeSlots: out.reduce((s, d) => s + d.freeSlots, 0),
    idleRevenue: round2(out.reduce((s, d) => s + d.idleRevenue, 0)),
  };
}

/** Retira o primeiro horário livre que comporta `minutes` e o consome da agenda. */
function takeSlot(days: { date: string; windows: Interval[] }[], minutes: number): Interval | null {
  const need = minutes * 60_000;
  for (const day of days) {
    for (let i = 0; i < day.windows.length; i++) {
      const w = day.windows[i];
      if (w.end - w.start >= need) {
        const slot = { start: w.start, end: w.start + need };
        w.start = slot.end;
        if (w.end - w.start <= 0) day.windows.splice(i, 1);
        return slot;
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Upsell por associação ("quem faz A também faz B")
// ---------------------------------------------------------------------------

export function buildUpsellModel(clients: RadarClientInput[]) {
  const buyers = new Map<string, Set<string>>();
  for (const c of clients) {
    for (const v of c.visits) {
      for (const s of v.serviceIds) {
        if (!buyers.has(s)) buyers.set(s, new Set());
        buyers.get(s)!.add(c.clientId);
      }
    }
  }

  /** Melhor serviço que o cliente nunca comprou, ponderado por preço × confiança. */
  return function bestUpsell(
    client: RadarClientInput,
    services: Map<string, RadarServiceInput>,
  ): { service: RadarServiceInput; confidence: number; basedOn: RadarServiceInput } | null {
    const owned = new Set(client.visits.flatMap((v) => v.serviceIds));
    if (owned.size === 0) return null;
    let best: {
      service: RadarServiceInput;
      confidence: number;
      basedOn: RadarServiceInput;
      score: number;
    } | null = null;

    for (const [candidateId, candidateBuyers] of buyers) {
      if (owned.has(candidateId)) continue;
      const candidate = services.get(candidateId);
      if (!candidate || candidateBuyers.size < RADAR_RULES.upsell.minBuyers) continue;
      for (const ownedId of owned) {
        const base = services.get(ownedId);
        const baseBuyers = buyers.get(ownedId);
        if (!base || !baseBuyers || baseBuyers.size === 0) continue;
        let both = 0;
        for (const b of baseBuyers) if (candidateBuyers.has(b)) both++;
        const confidence = both / baseBuyers.size;
        if (confidence < RADAR_RULES.upsell.minConfidence) continue;
        const score = candidate.price * confidence;
        if (!best || score > best.score)
          best = { service: candidate, confidence, basedOn: base, score };
      }
    }
    return best
      ? { service: best.service, confidence: best.confidence, basedOn: best.basedOn }
      : null;
  };
}

// ---------------------------------------------------------------------------
// Mensagens
// ---------------------------------------------------------------------------

interface MessageContext {
  kind: OpportunityKind;
  name: string;
  company: string;
  vehicle: string | null;
  daysSince: number | null;
  lastServiceName: string | null;
  missedAt: string | null;
  upsell: { name: string; basedOn: string } | null;
  slotLabel: string | null;
}

export function buildMessage(ctx: MessageContext): string {
  const hi = `Oi, ${firstName(ctx.name)}! Aqui é da ${ctx.company}.`;
  const car = ctx.vehicle ? `o seu ${ctx.vehicle}` : 'o seu carro';
  const slot = ctx.slotLabel
    ? ` Tenho um horário livre ${ctx.slotLabel} — posso reservar pra você?`
    : ' Posso reservar um horário pra você essa semana?';

  switch (ctx.kind) {
    case 'NO_SHOW_RECOVERY':
      return (
        `${hi} Vi que não deu certo o seu horário${ctx.missedAt ? ` do dia ${ctx.missedAt}` : ''} ` +
        `— sem problema nenhum, imprevisto acontece.${slot}`
      );
    case 'WIN_BACK':
      return (
        `${hi} Faz ${ctx.daysSince} dias que a gente não cuida d${car} ` +
        `e sentimos sua falta!${slot}`
      );
    case 'DUE_NOW': {
      const what = ctx.lastServiceName ? `aquela ${ctx.lastServiceName}` : 'um cuidado';
      const extra = ctx.upsell
        ? ` Se quiser, dá pra incluir ${ctx.upsell.name} na mesma visita.`
        : '';
      return `${hi} Pelo seu ritmo, ${car} já está pedindo ${what} 😄${slot}${extra}`;
    }
    case 'UPSELL':
    default:
      return (
        `${hi} Quem faz ${ctx.upsell?.basedOn ?? 'nossos serviços'} costuma amar ` +
        `${ctx.upsell?.name ?? 'nossos tratamentos'}: deixa ${car} com cara de novo por muito mais tempo.${slot}`
      );
  }
}

// ---------------------------------------------------------------------------
// Motor principal
// ---------------------------------------------------------------------------

export function runRadar(input: RadarInput): RadarResult {
  const { now, timezone, companyName } = input;
  const nowMs = now.getTime();
  const serviceMap = new Map(input.services.map((s) => [s.id, s]));

  // Benchmarks da própria empresa (fallbacks para quem tem pouco histórico).
  const allVisits = input.clients.flatMap((c) => c.visits);
  const ticketFromVisits = allVisits.length
    ? allVisits.reduce((s, v) => s + v.value, 0) / allVisits.length
    : 0;
  const ticketFromCatalog = input.services.length
    ? input.services.reduce((s, x) => s + x.price, 0) / input.services.length
    : 0;
  const averageTicket = round2(ticketFromVisits || ticketFromCatalog);

  const minutesUsed = allVisits
    .flatMap((v) => v.serviceIds)
    .map((id) => serviceMap.get(id)?.estimatedMinutes)
    .filter((m): m is number => typeof m === 'number' && m > 0);
  const catalogMinutes = input.services.map((s) => s.estimatedMinutes).filter((m) => m > 0);
  const averageServiceMinutes = Math.max(
    15,
    Math.round(
      minutesUsed.length
        ? minutesUsed.reduce((s, m) => s + m, 0) / minutesUsed.length
        : catalogMinutes.length
          ? catalogMinutes.reduce((s, m) => s + m, 0) / catalogMinutes.length
          : 60,
    ),
  );

  const personalCadences = input.clients
    .map((c) => personalCadenceDays(c.visits))
    .filter((c): c is number => c !== null);
  const companyCadenceDays = Math.round(
    median(personalCadences) ?? RADAR_RULES.fallbackCadenceDays,
  );

  const bestUpsell = buildUpsellModel(input.clients);

  // 1) Classifica cada cliente na oportunidade mais valiosa (no máximo uma por cliente).
  type Draft = Omit<Opportunity, 'suggestedSlot' | 'message' | 'whatsappUrl'> & {
    _minutes: number;
    _lastServiceName: string | null;
    _missedAt: string | null;
    _upsell: { name: string; basedOn: string } | null;
  };
  const drafts: Draft[] = [];

  for (const c of input.clients) {
    if (c.hasUpcomingAppointment) continue; // já vai voltar — não incomodar

    const visits = [...c.visits].sort((a, b) => a.at.getTime() - b.at.getTime());
    const last = visits[visits.length - 1] ?? null;
    const personal = personalCadenceDays(visits);
    const cadenceDays = personal ?? companyCadenceDays;
    const cadenceSource: 'personal' | 'company' = personal ? 'personal' : 'company';
    const clientTicket = visits.length
      ? visits.reduce((s, v) => s + v.value, 0) / visits.length
      : averageTicket;
    const ticket = clientTicket > 0 ? clientTicket : averageTicket;
    const daysSince = last ? Math.floor((nowMs - last.at.getTime()) / DAY_MS) : null;
    const annualValueAtRisk = round2(ticket * (365 / cadenceDays));
    const lastServiceName =
      last?.serviceIds.map((id) => serviceMap.get(id)?.name).find(Boolean) ?? null;
    const upsell = bestUpsell(c, serviceMap);
    const vehicleLabel = c.vehicle ? `${c.vehicle.model}`.trim() || null : null;
    const minutesOf = (ids: string[]) =>
      ids.reduce((s, id) => s + (serviceMap.get(id)?.estimatedMinutes ?? 0), 0) ||
      averageServiceMinutes;

    let kind: OpportunityKind | null = null;
    let reason = '';
    let potential = ticket;
    let probability = 0;
    let minutes = last ? minutesOf(last.serviceIds) : averageServiceMinutes;
    let missedAt: string | null = null;
    let suggested: Draft['suggestedService'] = null;
    let upsellCtx: Draft['_upsell'] = null;

    const missed = c.lastMissed;
    const missedRecent =
      missed &&
      nowMs - missed.at.getTime() <= RADAR_RULES.missedWindowDays * DAY_MS &&
      (!last || missed.at.getTime() > last.at.getTime());

    if (missedRecent && missed) {
      kind = 'NO_SHOW_RECOVERY';
      potential = missed.value > 0 ? missed.value : ticket;
      probability = RADAR_RULES.probability.NO_SHOW_RECOVERY;
      minutes = minutesOf(missed.serviceIds);
      missedAt = DateTime.fromJSDate(missed.at).setZone(timezone).toFormat('dd/LL');
      reason =
        missed.status === 'NO_SHOW'
          ? `Faltou no dia ${missedAt} e não remarcou`
          : `Cancelou o horário do dia ${missedAt} e não remarcou`;
    } else if (last && daysSince !== null) {
      const ratio = daysSince / cadenceDays;
      const lost = ratio > RADAR_RULES.lostRatio || daysSince > RADAR_RULES.lostAfterDays;
      if (!lost && ratio > RADAR_RULES.lateRatio) {
        kind = 'WIN_BACK';
        // Quanto mais tempo passa, menor a chance — decai a partir de 1,5× o ritmo.
        probability = Math.max(
          0.05,
          Math.min(
            RADAR_RULES.probability.WIN_BACK,
            (RADAR_RULES.probability.WIN_BACK * RADAR_RULES.lateRatio) / ratio,
          ),
        );
        reason =
          cadenceSource === 'personal'
            ? `Vinha a cada ${cadenceDays} dias — já faz ${daysSince}`
            : `Sem voltar há ${daysSince} dias (clientes daqui voltam a cada ${cadenceDays})`;
      } else if (!lost && ratio >= RADAR_RULES.dueRatio) {
        kind = 'DUE_NOW';
        probability = RADAR_RULES.probability.DUE_NOW;
        reason =
          cadenceSource === 'personal'
            ? `Volta a cada ${cadenceDays} dias — está no ponto (${daysSince} dias)`
            : `${daysSince} dias desde a 1ª visita — ritmo típico da casa é ${cadenceDays}`;
        if (upsell) {
          upsellCtx = { name: upsell.service.name, basedOn: upsell.basedOn.name };
          suggested = {
            id: upsell.service.id,
            name: upsell.service.name,
            price: upsell.service.price,
          };
          potential = ticket + upsell.service.price * upsell.confidence;
        }
      } else if (!lost && upsell && visits.length >= 2) {
        kind = 'UPSELL';
        probability = Math.min(
          RADAR_RULES.probability.UPSELL,
          RADAR_RULES.probability.UPSELL * (0.5 + upsell.confidence),
        );
        potential = upsell.service.price;
        minutes = upsell.service.estimatedMinutes || averageServiceMinutes;
        upsellCtx = { name: upsell.service.name, basedOn: upsell.basedOn.name };
        suggested = {
          id: upsell.service.id,
          name: upsell.service.name,
          price: upsell.service.price,
        };
        reason = `${Math.round(upsell.confidence * 100)}% de quem faz ${upsell.basedOn.name} também faz ${upsell.service.name}`;
      }
    }

    if (!kind) continue;

    const contactedRecently =
      !!c.lastContactedAt &&
      nowMs - c.lastContactedAt.getTime() < RADAR_RULES.contactCooldownDays * DAY_MS;
    const expectedValue = round2(potential * probability);

    drafts.push({
      clientId: c.clientId,
      clientName: c.name,
      phone: c.phone,
      vehicleLabel,
      kind,
      reason,
      potentialValue: round2(potential),
      expectedValue,
      probability: round2(probability),
      annualValueAtRisk,
      cadenceDays,
      cadenceSource,
      daysSinceLastVisit: daysSince,
      visits: visits.length,
      suggestedService: suggested,
      lastContactedAt: c.lastContactedAt ? c.lastContactedAt.toISOString() : null,
      contactedRecently,
      priority: round2(
        expectedValue * RADAR_RULES.priorityWeight[kind] * (contactedRecently ? 0.05 : 1),
      ),
      _minutes: minutes,
      _lastServiceName: lastServiceName,
      _missedAt: missedAt,
      _upsell: upsellCtx,
    });
  }

  drafts.sort((a, b) => b.priority - a.priority);

  // 2) Agenda: capacidade ociosa + distribui horários livres REAIS entre as
  //    oportunidades mais valiosas (cada horário é oferecido a uma pessoa só).
  const windows = freeWindows(now, timezone, input.busy);
  const capacity = computeCapacity(
    windows.map((d) => ({ date: d.date, windows: d.windows.map((w) => ({ ...w })) })),
    averageServiceMinutes,
    averageTicket,
  );

  const opportunities: Opportunity[] = drafts.map((d) => {
    const taken = d.contactedRecently ? null : takeSlot(windows, d._minutes);
    const suggestedSlot: SuggestedSlot | null = taken
      ? {
          startAt: new Date(taken.start).toISOString(),
          endAt: new Date(taken.end).toISOString(),
          label: humanSlotLabel(new Date(taken.start), now, timezone),
        }
      : null;
    const message = buildMessage({
      kind: d.kind,
      name: d.clientName,
      company: companyName,
      vehicle: d.vehicleLabel,
      daysSince: d.daysSinceLastVisit,
      lastServiceName: d._lastServiceName,
      missedAt: d._missedAt,
      upsell: d._upsell,
      slotLabel: suggestedSlot?.label ?? null,
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _minutes, _lastServiceName, _missedAt, _upsell, ...rest } = d;
    return { ...rest, suggestedSlot, message, whatsappUrl: whatsappLink(d.phone, message) };
  });

  const byKind = Object.fromEntries(
    OPPORTUNITY_KINDS.map((k) => [k, { count: 0, potentialRevenue: 0 }]),
  ) as RadarResult['summary']['byKind'];
  for (const o of opportunities) {
    byKind[o.kind].count += 1;
    byKind[o.kind].potentialRevenue = round2(byKind[o.kind].potentialRevenue + o.potentialValue);
  }

  return {
    generatedAt: now.toISOString(),
    timezone,
    benchmarks: { averageTicket, averageServiceMinutes, companyCadenceDays },
    summary: {
      opportunities: opportunities.length,
      potentialRevenue: round2(opportunities.reduce((s, o) => s + o.potentialValue, 0)),
      expectedRevenue: round2(opportunities.reduce((s, o) => s + o.expectedValue, 0)),
      annualRevenueAtRisk: round2(
        opportunities
          .filter((o) => o.kind === 'WIN_BACK' || o.kind === 'NO_SHOW_RECOVERY')
          .reduce((s, o) => s + o.annualValueAtRisk, 0),
      ),
      byKind,
    },
    capacity,
    opportunities,
  };
}

// ---------------------------------------------------------------------------
// Atribuição: quanto dinheiro o Radar REALMENTE trouxe de volta
// ---------------------------------------------------------------------------

export interface OutreachRecord {
  id: string;
  clientId: string;
  kind: OpportunityKind;
  contactedAt: Date;
  estimatedValue: number;
}

export interface BookingRecord {
  id: string;
  clientId: string;
  createdAt: Date;
  status: string;
  value: number;
}

export interface AttributionResult {
  contacted: number;
  converted: number;
  conversionRate: number;
  recoveredRevenue: number;
  byKind: Record<
    OpportunityKind,
    { contacted: number; converted: number; recoveredRevenue: number }
  >;
  conversions: {
    outreachId: string;
    clientId: string;
    kind: OpportunityKind;
    contactedAt: string;
    bookingId: string;
    bookedAt: string;
    value: number;
  }[];
}

const NON_CONVERTING = new Set(['CANCELLED', 'NO_SHOW']);

/**
 * Atribuição de último toque: um agendamento criado até
 * `windowDays` após um contato do Radar conta como receita recuperada por
 * aquele contato. Cada agendamento é atribuído no máximo uma vez (ao contato
 * mais recente que o antecede) e cada contato converte no máximo uma vez.
 */
export function attributeOutreach(
  outreaches: OutreachRecord[],
  bookings: BookingRecord[],
  windowDays = RADAR_RULES.attributionWindowDays,
): AttributionResult {
  const windowMs = windowDays * DAY_MS;
  const byClient = new Map<string, OutreachRecord[]>();
  for (const o of outreaches) {
    if (!byClient.has(o.clientId)) byClient.set(o.clientId, []);
    byClient.get(o.clientId)!.push(o);
  }
  for (const list of byClient.values())
    list.sort((a, b) => a.contactedAt.getTime() - b.contactedAt.getTime());

  const converted = new Set<string>();
  const conversions: AttributionResult['conversions'] = [];

  const sortedBookings = [...bookings]
    .filter((b) => !NON_CONVERTING.has(b.status))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  for (const b of sortedBookings) {
    const candidates = byClient.get(b.clientId);
    if (!candidates) continue;
    let match: OutreachRecord | null = null;
    for (const o of candidates) {
      const delta = b.createdAt.getTime() - o.contactedAt.getTime();
      if (delta > 0 && delta <= windowMs && !converted.has(o.id)) match = o; // o mais recente vence
    }
    if (!match) continue;
    converted.add(match.id);
    conversions.push({
      outreachId: match.id,
      clientId: b.clientId,
      kind: match.kind,
      contactedAt: match.contactedAt.toISOString(),
      bookingId: b.id,
      bookedAt: b.createdAt.toISOString(),
      value: round2(b.value),
    });
  }

  const byKind = Object.fromEntries(
    OPPORTUNITY_KINDS.map((k) => [k, { contacted: 0, converted: 0, recoveredRevenue: 0 }]),
  ) as AttributionResult['byKind'];
  for (const o of outreaches) byKind[o.kind].contacted += 1;
  for (const c of conversions) {
    byKind[c.kind].converted += 1;
    byKind[c.kind].recoveredRevenue = round2(byKind[c.kind].recoveredRevenue + c.value);
  }

  const recoveredRevenue = round2(conversions.reduce((s, c) => s + c.value, 0));
  return {
    contacted: outreaches.length,
    converted: conversions.length,
    conversionRate: outreaches.length ? round2(conversions.length / outreaches.length) : 0,
    recoveredRevenue,
    byKind,
    conversions,
  };
}
