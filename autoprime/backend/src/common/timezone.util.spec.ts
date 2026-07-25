import {
  endOfDayInZone,
  getHourInZone,
  isPastInstant,
  isValidIanaTimezone,
  startOfDayInZone,
  zonedDateTime,
} from './timezone.util';

describe('timezone.util', () => {
  describe('zonedDateTime', () => {
    it('interpreta 08:00 em America/Sao_Paulo como 11:00 UTC (UTC-3, sem horário de verão)', () => {
      const instant = zonedDateTime('2026-07-25', '08:00', 'America/Sao_Paulo');
      expect(instant.toISOString()).toBe('2026-07-25T11:00:00.000Z');
    });

    it('interpreta o mesmo horário local de forma diferente em outro fuso (Cenário 7)', () => {
      const saoPaulo = zonedDateTime('2026-07-25', '08:00', 'America/Sao_Paulo'); // UTC-3
      const noronha = zonedDateTime('2026-07-25', '08:00', 'America/Noronha'); // UTC-2
      // Mesma hora de parede, fusos diferentes → instantes absolutos diferentes.
      // Noronha (UTC-2) está "à frente" de São Paulo (UTC-3): as 08:00 de
      // Noronha acontecem 1h ANTES (em termos absolutos) das 08:00 de SP.
      expect(saoPaulo.getTime()).not.toBe(noronha.getTime());
      expect(saoPaulo.getTime() - noronha.getTime()).toBe(60 * 60 * 1000);
    });

    it('não desloca de dia: 25/07/2026 09:00 local continua exibindo dia 25 no fuso da empresa (Cenário 2/3)', () => {
      const instant = zonedDateTime('2026-07-25', '09:00', 'America/Sao_Paulo');
      expect(getHourInZone(instant, 'America/Sao_Paulo')).toBe(9);
      // Lido de volta no mesmo fuso, o dia local continua sendo 25.
      const localDay = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(instant);
      expect(localDay).toBe('2026-07-25');
    });
  });

  describe('startOfDayInZone / endOfDayInZone (Cenário 8 — bloqueio de dia local)', () => {
    it('não vaza para o dia anterior ou seguinte', () => {
      const start = startOfDayInZone('2026-07-25', 'America/Sao_Paulo');
      const end = endOfDayInZone('2026-07-25', 'America/Sao_Paulo');

      expect(getHourInZone(start, 'America/Sao_Paulo')).toBe(0);
      expect(getHourInZone(end, 'America/Sao_Paulo')).toBe(23);

      const dayBefore = zonedDateTime('2026-07-24', '23:59', 'America/Sao_Paulo');
      const dayAfter = zonedDateTime('2026-07-26', '00:01', 'America/Sao_Paulo');
      expect(dayBefore.getTime()).toBeLessThan(start.getTime());
      expect(dayAfter.getTime()).toBeGreaterThan(end.getTime());
    });
  });

  describe('getHourInZone', () => {
    it('retorna a hora local da empresa, não a hora UTC/servidor (Cenário 6)', () => {
      // 23:00 em São Paulo (UTC-3) é 02:00 do dia seguinte em UTC.
      const instant = new Date('2026-07-26T02:00:00.000Z');
      expect(getHourInZone(instant, 'America/Sao_Paulo')).toBe(23);
      expect(instant.getUTCHours()).toBe(2);
    });
  });

  describe('isPastInstant', () => {
    it('compara instantes absolutos, independente de fuso (Cenário 4)', () => {
      const reference = new Date('2026-07-25T12:00:00.000Z');
      const past = zonedDateTime('2026-07-25', '08:00', 'America/Sao_Paulo'); // 11:00 UTC
      const future = zonedDateTime('2026-07-25', '10:00', 'America/Sao_Paulo'); // 13:00 UTC
      expect(isPastInstant(past, reference)).toBe(true);
      expect(isPastInstant(future, reference)).toBe(false);
    });
  });

  describe('isValidIanaTimezone', () => {
    it('aceita fusos IANA válidos e rejeita valores inválidos', () => {
      expect(isValidIanaTimezone('America/Sao_Paulo')).toBe(true);
      expect(isValidIanaTimezone('America/Manaus')).toBe(true);
      expect(isValidIanaTimezone('UTC')).toBe(true);
      expect(isValidIanaTimezone('-03:00')).toBe(false);
      expect(isValidIanaTimezone('Brazil/Fake')).toBe(false);
      expect(isValidIanaTimezone('')).toBe(false);
    });
  });
});
