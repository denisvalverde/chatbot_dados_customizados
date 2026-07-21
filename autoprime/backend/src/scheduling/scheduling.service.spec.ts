import { ConflictException } from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { SchedulingService } from './scheduling.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('SchedulingService', () => {
  let service: SchedulingService;
  let prisma: {
    service: { findMany: jest.Mock };
    appointment: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    appointmentEmployee: { findMany: jest.Mock };
  };
  let notifications: { sendAppointmentConfirmation: jest.Mock };

  beforeEach(() => {
    prisma = {
      service: { findMany: jest.fn() },
      appointment: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      appointmentEmployee: { findMany: jest.fn() },
    };
    notifications = { sendAppointmentConfirmation: jest.fn() };

    service = new SchedulingService(
      prisma as unknown as PrismaService,
      notifications as unknown as NotificationsService,
    );
  });

  it('cria um agendamento somando a duração dos serviços selecionados', async () => {
    prisma.service.findMany.mockResolvedValue([
      { id: 's1', estimatedMinutes: 30, price: 40 },
      { id: 's2', estimatedMinutes: 60, price: 70 },
    ]);
    prisma.appointmentEmployee.findMany.mockResolvedValue([]);
    prisma.appointment.create.mockImplementation(({ data }) =>
      Promise.resolve({
        ...data,
        client: { userId: 'u1', user: { email: 'a@b.com' } },
      }),
    );

    const result = await service.create({
      clientId: 'c1',
      vehicleId: 'v1',
      serviceIds: ['s1', 's2'],
      startAt: '2026-08-01T10:00:00.000Z',
    });

    expect(result.startAt).toEqual(new Date('2026-08-01T10:00:00.000Z'));
    expect(result.endAt).toEqual(new Date('2026-08-01T11:30:00.000Z')); // 90 min depois
    expect(notifications.sendAppointmentConfirmation).toHaveBeenCalled();
  });

  it('rejeita quando um funcionário já está alocado no horário', async () => {
    prisma.service.findMany.mockResolvedValue([{ id: 's1', estimatedMinutes: 30, price: 40 }]);
    prisma.appointmentEmployee.findMany.mockResolvedValue([
      { employee: { user: { name: 'João' } } },
    ]);

    await expect(
      service.create({
        clientId: 'c1',
        vehicleId: 'v1',
        serviceIds: ['s1'],
        startAt: '2026-08-01T10:00:00.000Z',
        employeeIds: ['e1'],
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejeita quando um serviceId informado não existe/está inativo', async () => {
    prisma.service.findMany.mockResolvedValue([{ id: 's1', estimatedMinutes: 30, price: 40 }]);

    await expect(
      service.create({
        clientId: 'c1',
        vehicleId: 'v1',
        serviceIds: ['s1', 's2'],
        startAt: '2026-08-01T10:00:00.000Z',
      }),
    ).rejects.toThrow();
  });

  it('cancela um agendamento existente', async () => {
    prisma.appointment.findUnique.mockResolvedValue({
      id: 'a1',
      status: AppointmentStatus.CONFIRMED,
    });
    prisma.appointment.update.mockResolvedValue({ id: 'a1', status: AppointmentStatus.CANCELLED });

    const result = await service.cancel('a1', 'Cliente desistiu');
    expect(result.status).toBe(AppointmentStatus.CANCELLED);
    expect(prisma.appointment.update).toHaveBeenCalledWith({
      where: { id: 'a1' },
      data: { status: AppointmentStatus.CANCELLED, cancelReason: 'Cliente desistiu' },
    });
  });
});
