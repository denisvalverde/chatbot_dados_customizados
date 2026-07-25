import { ConfigService } from '@nestjs/config';
import { DateTime } from 'luxon';
import { AiService } from './ai.service';
import { PrismaService } from '../prisma/prisma.service';

// Datas relativas ao momento em que o teste roda, nunca uma data fixa
// distante — evita que o teste comece a falhar sozinho quando o calendário
// "alcançar" uma data que um dia foi hardcoded no futuro.
const futureDate = () => DateTime.now().plus({ days: 5 }).toFormat('yyyy-LL-dd');

describe('AiService', () => {
  let service: AiService;
  let prisma: {
    appointment: { findMany: jest.Mock };
    company: { findUnique: jest.Mock };
  };

  function makeService(timezone: string) {
    prisma = {
      appointment: { findMany: jest.fn().mockResolvedValue([]) },
      company: { findUnique: jest.fn().mockResolvedValue({ timezone }) },
    };
    return new AiService(prisma as unknown as PrismaService, new ConfigService());
  }

  beforeEach(() => {
    service = makeService('America/Sao_Paulo');
  });

  it('sugere o horário de abertura (08:00) no fuso da empresa, não no fuso do servidor (Cenário 1)', async () => {
    const date = futureDate();
    const result = await service.suggestSlots('company-1', date, 60);

    expect(result.timezone).toBe('America/Sao_Paulo');
    expect(result.availableSlots.length).toBeGreaterThan(0);

    const firstSlot = new Date(result.availableSlots[0].startAt);
    // 08:00 em America/Sao_Paulo (UTC-3, sem DST) é 11:00 UTC.
    expect(firstSlot.toISOString()).toBe(`${date}T11:00:00.000Z`);
  });

  it('não sugere um slot que conflita com um agendamento existente', async () => {
    const date = futureDate();
    prisma.appointment.findMany.mockResolvedValue([
      {
        startAt: new Date(`${date}T11:00:00.000Z`), // 08:00 local
        endAt: new Date(`${date}T12:00:00.000Z`), // 09:00 local
      },
    ]);

    const result = await service.suggestSlots('company-1', date, 60);

    const has8amLocal = result.availableSlots.some((s) => s.startAt === `${date}T11:00:00.000Z`);
    expect(has8amLocal).toBe(false);
    // 09:00 local (12:00 UTC) já deve estar livre novamente.
    const has9amLocal = result.availableSlots.some((s) => s.startAt === `${date}T12:00:00.000Z`);
    expect(has9amLocal).toBe(true);
  });

  it('empresas em fusos diferentes têm disponibilidade calculada no próprio fuso (Cenário 7)', async () => {
    const date = futureDate();

    const saoPauloService = makeService('America/Sao_Paulo');
    const noronhaService = makeService('America/Noronha'); // UTC-2, 1h à frente de SP

    const [spResult, fnResult] = await Promise.all([
      saoPauloService.suggestSlots('company-sp', date, 60),
      noronhaService.suggestSlots('company-fn', date, 60),
    ]);

    const spFirst = new Date(spResult.availableSlots[0].startAt);
    const fnFirst = new Date(fnResult.availableSlots[0].startAt);

    // Mesma "hora de parede" comercial (08:00), fusos diferentes → instantes
    // absolutos diferentes. Noronha (UTC-2) está à frente de São Paulo
    // (UTC-3): as 08:00 de Noronha acontecem 1h antes, em termos absolutos.
    expect(spFirst.getTime() - fnFirst.getTime()).toBe(60 * 60 * 1000);
  });

  it('não sugere horários já passados no fuso da empresa quando a data é hoje (Cenário 4)', async () => {
    const timezone = 'America/Sao_Paulo';
    // "Agora" = 25/07/2026 09:30 em São Paulo (12:30 UTC) — dentro do expediente.
    jest.useFakeTimers().setSystemTime(new Date('2026-07-25T12:30:00.000Z'));
    try {
      const todayLocal = DateTime.now().setZone(timezone).toFormat('yyyy-LL-dd');
      const result = await service.suggestSlots('company-1', todayLocal, 60);

      const has8am = result.availableSlots.some((s) => s.startAt.endsWith('T11:00:00.000Z'));
      const has10am = result.availableSlots.some((s) => s.startAt.endsWith('T13:00:00.000Z'));
      expect(has8am).toBe(false); // já passou
      expect(has10am).toBe(true); // ainda no futuro
    } finally {
      jest.useRealTimers();
    }
  });

  it('usa template determinístico quando não há chave da Anthropic configurada', async () => {
    const result = await service.generateMessage({
      kind: 'thank_you',
      clientName: 'Ana',
    });

    expect(result.generatedBy).toBe('template');
    expect(result.message).toContain('Ana');
  });
});
