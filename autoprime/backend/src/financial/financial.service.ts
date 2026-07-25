import { BadRequestException, Injectable } from '@nestjs/common';
import { TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';

@Injectable()
export class FinancialService {
  constructor(private readonly prisma: PrismaService) {}

  async createTransaction(companyId: string, dto: CreateTransactionDto) {
    if (dto.clientId) {
      const client = await this.prisma.client.findFirst({ where: { id: dto.clientId, companyId } });
      if (!client) throw new BadRequestException('Cliente não encontrado nesta empresa.');
    }

    return this.prisma.transaction.create({
      data: {
        ...dto,
        companyId,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
      },
    });
  }

  findTransactions(companyId: string, from?: string, to?: string, type?: TransactionType) {
    return this.prisma.transaction.findMany({
      where: {
        companyId,
        type,
        occurredAt: {
          gte: from ? new Date(from) : undefined,
          lte: to ? new Date(to) : undefined,
        },
      },
      include: { client: { include: { user: true } }, serviceOrder: true },
      orderBy: { occurredAt: 'desc' },
    });
  }

  async cashFlow(companyId: string, from: string, to: string) {
    const transactions = await this.prisma.transaction.findMany({
      where: { companyId, occurredAt: { gte: new Date(from), lte: new Date(to) } },
    });

    const income = transactions
      .filter((t) => t.type === TransactionType.INCOME)
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const expense = transactions
      .filter((t) => t.type === TransactionType.EXPENSE)
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const byCategory = new Map<string, number>();
    for (const t of transactions) {
      const key = `${t.type}:${t.category}`;
      byCategory.set(key, (byCategory.get(key) ?? 0) + Number(t.amount));
    }

    return {
      period: { from, to },
      income,
      expense,
      profit: income - expense,
      byCategory: Array.from(byCategory.entries()).map(([key, amount]) => {
        const [type, category] = key.split(':');
        return { type, category, amount };
      }),
    };
  }

  async dre(companyId: string, from: string, to: string) {
    const flow = await this.cashFlow(companyId, from, to);
    const grossRevenue = flow.income;
    const totalExpenses = flow.expense;
    const netResult = grossRevenue - totalExpenses;
    const margin = grossRevenue > 0 ? (netResult / grossRevenue) * 100 : 0;

    return {
      period: flow.period,
      grossRevenue,
      totalExpenses,
      netResult,
      marginPercent: Number(margin.toFixed(2)),
      breakdown: flow.byCategory,
    };
  }
}
