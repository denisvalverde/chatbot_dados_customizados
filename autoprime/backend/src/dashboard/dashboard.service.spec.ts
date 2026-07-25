import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';

describe('DashboardService', () => {
  describe('peakHours', () => {
    it('agrupa por hora local da empresa, não pela hora do servidor (Cenário 6)', async () => {
      const prisma = {
        appointment: {
          findMany: jest.fn().mockResolvedValue([
            // 23:00 em São Paulo (UTC-3) é 02:00 (dia seguinte) em UTC — se o
            // código usasse `Date#getHours()` (hora do processo/servidor,
            // Railway roda em UTC), isso cairia erroneamente na hora 2.
            { startAt: new Date('2026-07-26T02:00:00.000Z') },
            { startAt: new Date('2026-07-26T02:00:00.000Z') },
          ]),
        },
        company: { findUnique: jest.fn().mockResolvedValue({ timezone: 'America/Sao_Paulo' }) },
      };

      const service = new DashboardService(prisma as unknown as PrismaService);
      const result = await service.peakHours('company-1', '2026-07-01', '2026-07-31');

      expect(result[23].count).toBe(2);
      expect(result[2].count).toBe(0);
    });

    it('calcula a disponibilidade de cada empresa no seu próprio fuso (Cenário 7)', async () => {
      const appointments = [{ startAt: new Date('2026-07-26T02:00:00.000Z') }];

      const spPrisma = {
        appointment: { findMany: jest.fn().mockResolvedValue(appointments) },
        company: { findUnique: jest.fn().mockResolvedValue({ timezone: 'America/Sao_Paulo' }) },
      };
      const utcPrisma = {
        appointment: { findMany: jest.fn().mockResolvedValue(appointments) },
        company: { findUnique: jest.fn().mockResolvedValue({ timezone: 'UTC' }) },
      };

      const spResult = await new DashboardService(spPrisma as unknown as PrismaService).peakHours(
        'company-sp',
        '2026-07-01',
        '2026-07-31',
      );
      const utcResult = await new DashboardService(utcPrisma as unknown as PrismaService).peakHours(
        'company-utc',
        '2026-07-01',
        '2026-07-31',
      );

      expect(spResult[23].count).toBe(1);
      expect(utcResult[2].count).toBe(1);
    });
  });
});
