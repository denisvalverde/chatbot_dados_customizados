import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ServiceOrderStatus, StockMovementType, TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceOrderDto } from './dto/create-service-order.dto';
import { AddPhotoDto } from './dto/add-photo.dto';

@Injectable()
export class ServiceOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, dto: CreateServiceOrderDto) {
    if (dto.appointmentId) {
      return this.createFromAppointment(companyId, dto.appointmentId);
    }

    if (!dto.clientId || !dto.vehicleId || !dto.serviceIds?.length) {
      throw new BadRequestException(
        'Informe appointmentId, ou clientId + vehicleId + serviceIds para abrir uma OS avulsa.',
      );
    }

    const [client, vehicle, services] = await Promise.all([
      this.prisma.client.findFirst({ where: { id: dto.clientId, companyId } }),
      this.prisma.vehicle.findFirst({
        where: { id: dto.vehicleId, companyId, clientId: dto.clientId },
      }),
      this.prisma.service.findMany({ where: { id: { in: dto.serviceIds }, companyId } }),
    ]);
    if (!client) throw new BadRequestException('Cliente não encontrado nesta empresa.');
    if (!vehicle) throw new BadRequestException('Veículo não encontrado para este cliente.');
    if (services.length !== dto.serviceIds.length) {
      throw new BadRequestException('Um ou mais serviços informados não existem.');
    }

    let employeeIds: string[] = [];
    if (dto.employeeIds?.length) {
      const employees = await this.prisma.employee.findMany({
        where: { id: { in: dto.employeeIds }, companyId },
      });
      if (employees.length !== dto.employeeIds.length) {
        throw new BadRequestException(
          'Um ou mais funcionários informados não existem nesta empresa.',
        );
      }
      employeeIds = employees.map((e) => e.id);
    }

    return this.prisma.serviceOrder.create({
      data: {
        companyId,
        clientId: dto.clientId,
        vehicleId: dto.vehicleId,
        items: { create: services.map((s) => ({ serviceId: s.id, price: s.price })) },
        checklist: {
          create: await this.buildChecklistFromServices(services.map((s) => s.id)),
        },
        employees: employeeIds.length ? { connect: employeeIds.map((id) => ({ id })) } : undefined,
      },
      include: this.include(),
    });
  }

  private async createFromAppointment(companyId: string, appointmentId: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, companyId },
      include: { services: { include: { service: true } }, employees: true },
    });
    if (!appointment) throw new NotFoundException('Agendamento não encontrado.');

    const serviceIds = appointment.services.map((s) => s.serviceId);

    return this.prisma.serviceOrder.create({
      data: {
        companyId,
        appointmentId: appointment.id,
        clientId: appointment.clientId,
        vehicleId: appointment.vehicleId,
        items: {
          create: appointment.services.map((s) => ({
            serviceId: s.serviceId,
            price: s.priceAtBooking,
          })),
        },
        checklist: { create: await this.buildChecklistFromServices(serviceIds) },
        employees: appointment.employees.length
          ? { connect: appointment.employees.map((e) => ({ id: e.employeeId })) }
          : undefined,
      },
      include: this.include(),
    });
  }

  private async buildChecklistFromServices(serviceIds: string[]) {
    const templates = await this.prisma.serviceChecklistTemplate.findMany({
      where: { serviceId: { in: serviceIds } },
      orderBy: { order: 'asc' },
    });
    return templates.map((t) => ({ label: t.label }));
  }

  findAll(companyId: string, status?: ServiceOrderStatus) {
    return this.prisma.serviceOrder.findMany({
      where: { companyId, ...(status ? { status } : {}) },
      include: this.include(),
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(companyId: string, id: string) {
    const order = await this.prisma.serviceOrder.findFirst({
      where: { id, companyId },
      include: this.include(),
    });
    if (!order) throw new NotFoundException('Ordem de serviço não encontrada.');
    return order;
  }

  async start(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.prisma.serviceOrder.update({
      where: { id },
      data: { status: ServiceOrderStatus.IN_PROGRESS, startedAt: new Date() },
    });
  }

  async toggleChecklistItem(companyId: string, id: string, itemId: string, checked: boolean) {
    await this.findOne(companyId, id);
    return this.prisma.serviceOrderChecklistItem.update({
      where: { id: itemId },
      data: { checked, checkedAt: checked ? new Date() : null },
    });
  }

  async addPhoto(companyId: string, id: string, dto: AddPhotoDto) {
    await this.findOne(companyId, id);
    return this.prisma.serviceOrderPhoto.create({
      data: { serviceOrderId: id, stage: dto.stage, url: dto.url },
    });
  }

  /**
   * Finaliza a OS: baixa o estoque dos produtos utilizados nos serviços e
   * lança a receita no financeiro. Roda em transação para manter consistência.
   */
  async complete(companyId: string, id: string) {
    const order = await this.findOne(companyId, id);
    if (order.status === ServiceOrderStatus.COMPLETED) {
      throw new BadRequestException('Esta OS já está concluída.');
    }

    return this.prisma.$transaction(async (tx) => {
      const serviceIds = order.items.map((i) => i.serviceId);
      const productsUsed = await tx.serviceProduct.findMany({
        where: { serviceId: { in: serviceIds } },
      });

      for (const usage of productsUsed) {
        await tx.product.update({
          where: { id: usage.productId },
          data: { quantity: { decrement: usage.quantity } },
        });
        await tx.stockMovement.create({
          data: {
            productId: usage.productId,
            type: StockMovementType.OUT,
            quantity: usage.quantity,
            reason: `OS #${order.number}`,
          },
        });
      }

      const total = order.items.reduce((sum, item) => sum + Number(item.price), 0);
      await tx.transaction.create({
        data: {
          companyId,
          type: TransactionType.INCOME,
          category: 'Serviços',
          description: `Receita da OS #${order.number}`,
          amount: total,
          clientId: order.clientId,
          serviceOrderId: order.id,
        },
      });

      return tx.serviceOrder.update({
        where: { id },
        data: { status: ServiceOrderStatus.COMPLETED, finishedAt: new Date() },
        include: this.include(),
      });
    });
  }

  async deliver(companyId: string, id: string, signatureUrl?: string) {
    await this.findOne(companyId, id);
    return this.prisma.serviceOrder.update({
      where: { id },
      data: { status: ServiceOrderStatus.DELIVERED, signatureUrl },
    });
  }

  private include() {
    return {
      client: { include: { user: true } },
      vehicle: true,
      items: { include: { service: true } },
      checklist: true,
      photos: true,
      employees: { include: { user: true } },
      payments: true,
    } as const;
  }
}
