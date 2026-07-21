import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ServiceOrderStatus, StockMovementType, TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceOrderDto } from './dto/create-service-order.dto';
import { AddPhotoDto } from './dto/add-photo.dto';

@Injectable()
export class ServiceOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateServiceOrderDto) {
    if (dto.appointmentId) {
      return this.createFromAppointment(dto.appointmentId);
    }

    if (!dto.clientId || !dto.vehicleId || !dto.serviceIds?.length) {
      throw new BadRequestException(
        'Informe appointmentId, ou clientId + vehicleId + serviceIds para abrir uma OS avulsa.',
      );
    }

    const services = await this.prisma.service.findMany({ where: { id: { in: dto.serviceIds } } });
    if (services.length !== dto.serviceIds.length) {
      throw new BadRequestException('Um ou mais serviços informados não existem.');
    }

    return this.prisma.serviceOrder.create({
      data: {
        clientId: dto.clientId,
        vehicleId: dto.vehicleId,
        items: { create: services.map((s) => ({ serviceId: s.id, price: s.price })) },
        checklist: {
          create: await this.buildChecklistFromServices(services.map((s) => s.id)),
        },
        employees: dto.employeeIds?.length
          ? { connect: dto.employeeIds.map((id) => ({ id })) }
          : undefined,
      },
      include: this.include(),
    });
  }

  private async createFromAppointment(appointmentId: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { services: { include: { service: true } }, employees: true },
    });
    if (!appointment) throw new NotFoundException('Agendamento não encontrado.');

    const serviceIds = appointment.services.map((s) => s.serviceId);

    return this.prisma.serviceOrder.create({
      data: {
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

  findAll(status?: ServiceOrderStatus) {
    return this.prisma.serviceOrder.findMany({
      where: status ? { status } : undefined,
      include: this.include(),
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const order = await this.prisma.serviceOrder.findUnique({
      where: { id },
      include: this.include(),
    });
    if (!order) throw new NotFoundException('Ordem de serviço não encontrada.');
    return order;
  }

  async start(id: string) {
    await this.findOne(id);
    return this.prisma.serviceOrder.update({
      where: { id },
      data: { status: ServiceOrderStatus.IN_PROGRESS, startedAt: new Date() },
    });
  }

  async toggleChecklistItem(id: string, itemId: string, checked: boolean) {
    await this.findOne(id);
    return this.prisma.serviceOrderChecklistItem.update({
      where: { id: itemId },
      data: { checked, checkedAt: checked ? new Date() : null },
    });
  }

  async addPhoto(id: string, dto: AddPhotoDto) {
    await this.findOne(id);
    return this.prisma.serviceOrderPhoto.create({
      data: { serviceOrderId: id, stage: dto.stage, url: dto.url },
    });
  }

  /**
   * Finaliza a OS: baixa o estoque dos produtos utilizados nos serviços e
   * lança a receita no financeiro. Roda em transação para manter consistência.
   */
  async complete(id: string) {
    const order = await this.findOne(id);
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

  async deliver(id: string, signatureUrl?: string) {
    await this.findOne(id);
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
