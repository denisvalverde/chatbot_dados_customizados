import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';
import { PrismaService } from '../prisma/prisma.service';

process.env.TZ = 'UTC';

describe('AiService', () => {
  let service: AiService;
  let prisma: { appointment: { findMany: jest.Mock } };

  beforeEach(() => {
    prisma = { appointment: { findMany: jest.fn() } };
    service = new AiService(prisma as unknown as PrismaService, new ConfigService());
  });

  it('sugere horários livres respeitando o horário comercial e conflitos', async () => {
    prisma.appointment.findMany.mockResolvedValue([
      {
        startAt: new Date('2026-08-03T09:00:00.000Z'),
        endAt: new Date('2026-08-03T10:00:00.000Z'),
      },
    ]);

    const result = await service.suggestSlots('2026-08-03', 60);

    expect(result.availableSlots.length).toBeGreaterThan(0);
    // Não deve haver slot de 60min começando às 09:00 (conflita).
    const has9am = result.availableSlots.some((s) => s.startAt.includes('T09:00:00'));
    expect(has9am).toBe(false);
    // 08:00 deve estar livre (antes do conflito).
    const has8am = result.availableSlots.some((s) => s.startAt.includes('T08:00:00'));
    expect(has8am).toBe(true);
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
