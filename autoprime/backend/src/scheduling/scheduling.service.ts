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
import { formatInZone, getCompanyTimezone, isPastInstant } from '../common/timezone.util';

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

  async create(companyId: string, dto: CreateAppointmentDto) {
    const [client, vehicle, services] = await Promise.all([
      this.prisma.client.findFirst({ where: { id: dto.clientId, companyId } }),
      this.prisma.vehicle.findFirst({
        where: { id: dto.vehicleId, companyId, clientId: dto.clientId },
      }),
      this.prisma.service.findMany({
        where: { id: { in: dto.serviceIds }, companyId, active: true },
      }),
    ]);

    if (!client) throw new BadRequestException('Cliente não encontrado nesta empresa.');
    if (!vehicle) throw new BadRequestException('Veículo não encontrado para este cliente.');
    if (services.length !== dto.serviceIds.length) {
      throw new BadRequestException(
        'Um ou mais serviços informados não existem ou estão inativos.',
      );
    }

    const totalMinutes = services.reduce((sum, s) => sum + s.estimatedMinutes, 0);
    const startAt = new Date(dto.startAt);
    const endAt = new Date(startAt.getTime() + totalMinutes * 60_000);

    // Comparação de instantes absolutos: independe do fuso do servidor ou do
    // navegador — `startAt` e `new Date()` já são ambos UTC internamente.
    if (isPastInstant(startAt)) {
      const timezone = await getCompanyTimezone(this.prisma, companyId);
      throw new BadRequestException(
        `Não é possível agendar para um horário no passado (${formatInZone(startAt, timezone)}, horário da empresa).`,
      );
    }

    if (dto.employeeIds?.length) {
      await this.assertEmployeesAvailable(companyId, dto.employeeIds, startAt, endAt);
    }

    const appointment = await this.prisma.appointment.create({
      data: {
        companyId,
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
      await getCompanyTimezone(this.prisma, companyId),
    );

    return appointment;
  }

  async findAgenda(companyId: string, from: string, to: string) {
    return this.prisma.appointment.findMany({
      where: { companyId, startAt: { gte: new Date(from) }, endAt: { lte: new Date(to) } },
      include: {
        client: { include: { user: true } },
        vehicle: true,
        services: { include: { service: true } },
        employees: { include: { employee: { include: { user: true } } } },
      },
      orderBy: { startAt: 'asc' },
    });
  }

  async findOne(companyId: string, id: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, companyId },
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

  async reschedule(companyId: string, id: string, dto: RescheduleAppointmentDto) {
    const appointment = await this.findOne(companyId, id);
    const duration = appointment.endAt.getTime() - appointment.startAt.getTime();
    const startAt = new Date(dto.startAt);
    const endAt = new Date(startAt.getTime() + duration);

    if (isPastInstant(startAt)) {
      const timezone = await getCompanyTimezone(this.prisma, companyId);
      throw new BadRequestException(
        `Não é possível reagendar para um horário no passado (${formatInZone(startAt, timezone)}, horário da empresa).`,
      );
    }

    const employeeIds = appointment.employees.map((e) => e.employeeId);
    if (employeeIds.length) {
      await this.assertEmployeesAvailable(companyId, employeeIds, startAt, endAt, id);
    }

    return this.prisma.appointment.update({
      where: { id },
      data: { startAt, endAt, status: AppointmentStatus.RESCHEDULED },
    });
  }

  async cancel(companyId: string, id: string, reason?: string) {
    await this.findOne(companyId, id);
    return this.prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.CANCELLED, cancelReason: reason },
    });
  }

  async updateStatus(companyId: string, id: string, status: AppointmentStatus) {
    await this.findOne(companyId, id);
    return this.prisma.appointment.update({ where: { id }, data: { status } });
  }

  private async assertEmployeesAvailable(
    companyId: string,
    employeeIds: string[],
    startAt: Date,
    endAt: Date,
    excludeAppointmentId?: string,
  ) {
    const employees = await this.prisma.employee.findMany({
      where: { id: { in: employeeIds }, companyId },
    });
    if (employees.length !== employeeIds.length) {
      throw new BadRequestException(
        'Um ou mais funcionários informados não existem nesta empresa.',
      );
    }

    const overlapping = await this.prisma.appointmentEmployee.findMany({
      where: {
        employeeId: { in: employeeIds },
        appointment: {
          id: excludeAppointmentId ? { not: excludeAppointmentId } : undefined,
          companyId,
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
