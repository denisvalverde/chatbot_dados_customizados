import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { NotificationsService } from '../notifications/notifications.service';

const ACTIVE_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.IN_QUEUE,
  AppointmentStatus.IN_PROGRESS,
];

@Injectable()
export class SchedulingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(dto: CreateAppointmentDto) {
    const services = await this.prisma.service.findMany({
      where: { id: { in: dto.serviceIds }, active: true },
    });
    if (services.length !== dto.serviceIds.length) {
      throw new BadRequestException(
        'Um ou mais serviços informados não existem ou estão inativos.',
      );
    }

    const totalMinutes = services.reduce((sum, s) => sum + s.estimatedMinutes, 0);
    const startAt = new Date(dto.startAt);
    const endAt = new Date(startAt.getTime() + totalMinutes * 60_000);

    if (dto.employeeIds?.length) {
      await this.assertEmployeesAvailable(dto.employeeIds, startAt, endAt);
    }

    const appointment = await this.prisma.appointment.create({
      data: {
        clientId: dto.clientId,
        vehicleId: dto.vehicleId,
        startAt,
        endAt,
        notes: dto.notes,
        status: AppointmentStatus.CONFIRMED,
        services: {
          create: services.map((s) => ({ serviceId: s.id, priceAtBooking: s.price })),
        },
        employees: dto.employeeIds?.length
          ? { create: dto.employeeIds.map((employeeId) => ({ employeeId })) }
          : undefined,
      },
      include: {
        services: { include: { service: true } },
        employees: true,
        client: { include: { user: true } },
      },
    });

    await this.notifications.sendAppointmentConfirmation(
      appointment.client.userId,
      appointment.client.user.email,
      startAt,
    );

    return appointment;
  }

  async findAgenda(from: string, to: string) {
    return this.prisma.appointment.findMany({
      where: { startAt: { gte: new Date(from) }, endAt: { lte: new Date(to) } },
      include: {
        client: { include: { user: true } },
        vehicle: true,
        services: { include: { service: true } },
        employees: { include: { employee: { include: { user: true } } } },
      },
      orderBy: { startAt: 'asc' },
    });
  }

  async findOne(id: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        client: { include: { user: true } },
        vehicle: true,
        services: { include: { service: true } },
        employees: { include: { employee: { include: { user: true } } } },
      },
    });
    if (!appointment) throw new NotFoundException('Agendamento não encontrado.');
    return appointment;
  }

  async reschedule(id: string, dto: RescheduleAppointmentDto) {
    const appointment = await this.findOne(id);
    const duration = appointment.endAt.getTime() - appointment.startAt.getTime();
    const startAt = new Date(dto.startAt);
    const endAt = new Date(startAt.getTime() + duration);

    const employeeIds = appointment.employees.map((e) => e.employeeId);
    if (employeeIds.length) {
      await this.assertEmployeesAvailable(employeeIds, startAt, endAt, id);
    }

    return this.prisma.appointment.update({
      where: { id },
      data: { startAt, endAt, status: AppointmentStatus.RESCHEDULED },
    });
  }

  async cancel(id: string, reason?: string) {
    await this.findOne(id);
    return this.prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.CANCELLED, cancelReason: reason },
    });
  }

  async updateStatus(id: string, status: AppointmentStatus) {
    await this.findOne(id);
    return this.prisma.appointment.update({ where: { id }, data: { status } });
  }

  private async assertEmployeesAvailable(
    employeeIds: string[],
    startAt: Date,
    endAt: Date,
    excludeAppointmentId?: string,
  ) {
    const overlapping = await this.prisma.appointmentEmployee.findMany({
      where: {
        employeeId: { in: employeeIds },
        appointment: {
          id: excludeAppointmentId ? { not: excludeAppointmentId } : undefined,
          status: { in: ACTIVE_STATUSES },
          startAt: { lt: endAt },
          endAt: { gt: startAt },
        },
      },
      include: { employee: { include: { user: true } } },
    });

    if (overlapping.length > 0) {
      const names = [...new Set(overlapping.map((o) => o.employee.user.name))].join(', ');
      throw new ConflictException(
        `Conflito de horário: ${names} já está(ão) alocado(s) em outro atendimento neste período.`,
      );
    }
  }
}
