/**
 * Utilitários de data/hora cientes do fuso da EMPRESA — nunca do fuso do
 * navegador do usuário nem do servidor. Não usamos nenhuma lib de data no
 * painel; os métodos nativos `Intl`/`Date` já cobrem o que é preciso aqui,
 * então evitamos adicionar uma dependência só para isso.
 *
 * Fallback documentado: se a empresa ainda não tiver `timezone` carregado
 * (ex.: falha de rede ao buscar `/companies/me`), usamos
 * "America/Sao_Paulo" — nunca `Intl.DateTimeFormat().resolvedOptions().timeZone`
 * (fuso do navegador) nem deixamos o `Date` nativo assumir um fuso implícito.
 */
export const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

function partsOf(date: Date, timeZone: string): Record<string, string> {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const result: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') result[part.type] = part.value;
  }
  // `hour12: false` faz o Intl retornar "24" para meia-noite em vez de "00"
  // em alguns runtimes — normaliza para não quebrar o input datetime-local.
  if (result.hour === '24') result.hour = '00';
  return result;
}

/**
 * Converte um instante absoluto (ISO string do backend, sempre UTC) para o
 * valor esperado por `<input type="datetime-local">`, representando a hora
 * de parede no fuso da EMPRESA (não no fuso do navegador).
 */
export function isoToZonedInputValue(iso: string, timeZone: string = DEFAULT_TIMEZONE): string {
  if (!iso) return '';
  const p = partsOf(new Date(iso), timeZone);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/**
 * Converte o valor de um `<input type="datetime-local">` (uma hora de
 * parede sem fuso, ex.: "2026-07-25T09:00") para um instante absoluto (ISO
 * UTC), interpretando essa hora de parede no fuso da EMPRESA — nunca no
 * fuso do navegador (que é o que `new Date(value).toISOString()` faria).
 */
export function zonedLocalInputToIso(
  localValue: string,
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  if (!localValue) return '';

  // 1) Lê os números do input como se já fossem UTC — um palpite inicial.
  const guessUtc = new Date(`${localValue}:00.000Z`);
  if (Number.isNaN(guessUtc.getTime())) return '';

  // 2) Descobre qual seria a leitura desse palpite no fuso da empresa e em
  //    UTC. A diferença entre as duas é exatamente o offset do fuso da
  //    empresa naquele instante (já considerando horário de verão, se
  //    houver) — sem depender do fuso do navegador, pois ambas as leituras
  //    usam o mesmo `Date` de entrada.
  const zoned = partsOf(guessUtc, timeZone);
  const utc = partsOf(guessUtc, 'UTC');
  const asZonedMs = Date.UTC(
    Number(zoned.year),
    Number(zoned.month) - 1,
    Number(zoned.day),
    Number(zoned.hour),
    Number(zoned.minute),
    Number(zoned.second),
  );
  const asUtcMs = Date.UTC(
    Number(utc.year),
    Number(utc.month) - 1,
    Number(utc.day),
    Number(utc.hour),
    Number(utc.minute),
    Number(utc.second),
  );
  const offsetMs = asUtcMs - asZonedMs;

  return new Date(guessUtc.getTime() + offsetMs).toISOString();
}

/**
 * Retorna o início e o fim do dia de HOJE no fuso da EMPRESA, como instantes
 * absolutos (ISO UTC) — usado para consultas de "agenda de hoje" que não
 * podem depender do fuso do navegador de quem está olhando o painel.
 */
export function todayRangeInZone(timeZone: string = DEFAULT_TIMEZONE): { from: string; to: string } {
  const p = partsOf(new Date(), timeZone);
  const dateStr = `${p.year}-${p.month}-${p.day}`;
  return {
    from: zonedLocalInputToIso(`${dateStr}T00:00`, timeZone),
    to: zonedLocalInputToIso(`${dateStr}T23:59`, timeZone),
  };
}

/** Formata apenas a hora (HH:mm) de um instante absoluto, no fuso da empresa. */
export function formatTimeInZone(iso: string, timeZone: string = DEFAULT_TIMEZONE): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

/** Formata um instante absoluto para exibição, sempre no fuso da empresa. */
export function formatDateTimeInZone(iso: string, timeZone: string = DEFAULT_TIMEZONE): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}
