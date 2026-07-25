import { Injectable } from '@nestjs/common';
import { AppointmentStatus, ServiceOrderStatus, TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(companyId: string, from: string, to: string) {
    const fromDate = new Date(from);
    const toDate = new Date(to);

    const [
      transactions,
      completedOrders,
      cancelledAppointments,
      totalAppointments,
      reviews,
      newClients,
    ] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { companyId, occurredAt: { gte: fromDate, lte: toDate } },
      }),
      this.prisma.serviceOrder.findMany({
        where: {
          companyId,
          status: ServiceOrderStatus.COMPLETED,
          finishedAt: { gte: fromDate, lte: toDate },
        },
        include: { items: true, client: true },
      }),
      this.prisma.appointment.count({
        where: {
          companyId,
          status: AppointmentStatus.CANCELLED,
          updatedAt: { gte: fromDate, lte: toDate },
        },
      }),
      this.prisma.appointment.count({
        where: { companyId, startAt: { gte: fromDate, lte: toDate } },
      }),
      this.prisma.review.findMany({
        where: { client: { companyId }, createdAt: { gte: fromDate, lte: toDate } },
      }),
      this.prisma.client.count({ where: { companyId, createdAt: { gte: fromDate, lte: toDate } } }),
    ]);

    const revenue = transactions
      .filter((t) => t.type === TransactionType.INCOME)
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const expense = transactions
      .filter((t) => t.type === TransactionType.EXPENSE)
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const uniqueClients = new Set(completedOrders.map((o) => o.clientId));
    const ticketMedio = completedOrders.length
      ? completedOrders.reduce(
          (s, o) => s + o.items.reduce((si, i) => si + Number(i.price), 0),
          0,
        ) / completedOrders.length
      : 0;

    const avgRating = reviews.length
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : null;

    return {
      period: { from, to },
      revenue,
      expense,
      profit: revenue - expense,
      ticketMedio: Number(ticketMedio.toFixed(2)),
      ordersCompleted: completedOrders.length,
      distinctClientsServed: uniqueClients.size,
      newClients,
      totalAppointments,
      cancelledAppointments,
      cancellationRate: totalAppointments
        ? Number(((cancelledAppointments / totalAppointments) * 100).toFixed(1))
        : 0,
      averageRating: avgRating ? Number(avgRating.toFixed(2)) : null,
    };
  }

  async topServices(companyId: string, from: string, to: string, limit = 10) {
    const items = await this.prisma.serviceOrderItem.findMany({
      where: {
        serviceOrder: {
          companyId,
          status: ServiceOrderStatus.COMPLETED,
          finishedAt: { gte: new Date(from), lte: new Date(to) },
        },
      },
      include: { service: true },
    });

    const grouped = new Map<string, { name: string; count: number; revenue: number }>();
    for (const item of items) {
      const entry = grouped.get(item.serviceId) ?? {
        name: item.service.name,
        count: 0,
        revenue: 0,
      };
      entry.count += 1;
      entry.revenue += Number(item.price);
      grouped.set(item.serviceId, entry);
    }

    return Array.from(grouped.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  async employeeProductivity(companyId: string, from: string, to: string) {
    const employees = await this.prisma.employee.findMany({
      where: { companyId, active: true },
      include: {
        user: true,
        serviceOrders: {
          where: {
            companyId,
            status: ServiceOrderStatus.COMPLETED,
            finishedAt: { gte: new Date(from), lte: new Date(to) },
          },
          include: { items: true },
        },
      },
    });

    return employees
      .map((e) => ({
        employeeId: e.id,
        name: e.user.name,
        ordersCompleted: e.serviceOrders.length,
        revenueGenerated: e.serviceOrders.reduce(
          (sum, o) => sum + o.items.reduce((s, i) => s + Number(i.price), 0),
          0,
        ),
      }))
      .sort((a, b) => b.ordersCompleted - a.ordersCompleted);
  }

  async peakHours(companyId: string, from: string, to: string) {
    const appointments = await this.prisma.appointment.findMany({
      where: { companyId, startAt: { gte: new Date(from), lte: new Date(to) } },
      select: { startAt: true },
    });

    const byHour = new Array(24).fill(0);
    for (const a of appointments) {
      byHour[a.startAt.getHours()] += 1;
    }

    return byHour.map((count, hour) => ({ hour, count }));
  }
}
