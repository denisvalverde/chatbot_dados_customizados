import { TransactionType } from '@prisma/client';
import { FinancialService } from './financial.service';
import { PrismaService } from '../prisma/prisma.service';

describe('FinancialService', () => {
  let service: FinancialService;
  let prisma: { transaction: { findMany: jest.Mock } };

  beforeEach(() => {
    prisma = { transaction: { findMany: jest.fn() } };
    service = new FinancialService(prisma as unknown as PrismaService);
  });

  it('calcula receita, despesa e lucro corretamente no fluxo de caixa', async () => {
    prisma.transaction.findMany.mockResolvedValue([
      { type: TransactionType.INCOME, category: 'Serviços', amount: 100 },
      { type: TransactionType.INCOME, category: 'Serviços', amount: 50 },
      { type: TransactionType.EXPENSE, category: 'Produtos', amount: 30 },
    ]);

    const result = await service.cashFlow('company-1', '2026-01-01', '2026-01-31');

    expect(result.income).toBe(150);
    expect(result.expense).toBe(30);
    expect(result.profit).toBe(120);
    expect(result.byCategory).toEqual(
      expect.arrayContaining([
        { type: 'INCOME', category: 'Serviços', amount: 150 },
        { type: 'EXPENSE', category: 'Produtos', amount: 30 },
      ]),
    );
  });

  it('DRE calcula margem líquida corretamente', async () => {
    prisma.transaction.findMany.mockResolvedValue([
      { type: TransactionType.INCOME, category: 'Serviços', amount: 200 },
      { type: TransactionType.EXPENSE, category: 'Salários', amount: 50 },
    ]);

    const dre = await service.dre('company-1', '2026-01-01', '2026-01-31');
    expect(dre.grossRevenue).toBe(200);
    expect(dre.totalExpenses).toBe(50);
    expect(dre.netResult).toBe(150);
    expect(dre.marginPercent).toBe(75);
  });

  it('retorna margem zero quando não há receita', async () => {
    prisma.transaction.findMany.mockResolvedValue([]);
    const dre = await service.dre('company-1', '2026-01-01', '2026-01-31');
    expect(dre.marginPercent).toBe(0);
  });
});
