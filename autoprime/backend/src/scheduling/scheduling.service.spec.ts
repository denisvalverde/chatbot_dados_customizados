import { BadRequestException, ConflictException } from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { DateTime } from 'luxon';
import { SchedulingService } from './scheduling.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

// Data relativa, nunca fixa no futuro distante — evita testes que expiram.
const futureIso = (hour: string) =>
  DateTime.now().plus({ days: 5 }).set({ hour: 0, minute: 0 }).toFormat('yyyy-LL-dd') +
  `T${hour}:00.000Z`;

describe('SchedulingService', () => {
  let service: SchedulingService;
  let prisma: {
    client: { findFirst: jest.Mock };
    vehicle: { findFirst: jest.Mock };
    service: { findMany: jest.Mock };
    employee: { findMany: jest.Mock };
    appointment: { create: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
    appointmentEmployee: { findMany: jest.Mock };
    company: { findUnique: jest.Mock };
  };
  let notifications: { sendAppointmentConfirmation: jest.Mock };

  const companyId = 'company-1';

  beforeEach(() => {
    prisma = {
      client: { findFirst: jest.fn().mockResolvedValue({ id: 'c1', companyId }) },
      vehicle: { findFirst: jest.fn().mockResolvedValue({ id: 'v1', companyId, clientId: 'c1' }) },
      service: { findMany: jest.fn() },
      employee: { findMany: jest.fn() },
      appointment: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
      appointmentEmployee: { findMany: jest.fn() },
      company: { findUnique: jest.fn().mockResolvedValue({ timezone: 'America/Sao_Paulo' }) },
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

    const startAt = futureIso('10:00');
    const result = await service.create(companyId, {
      clientId: 'c1',
      vehicleId: 'v1',
      serviceIds: ['s1', 's2'],
      startAt,
    });

    expect(result.startAt).toEqual(new Date(startAt));
    expect(result.endAt).toEqual(new Date(new Date(startAt).getTime() + 90 * 60_000)); // 90 min depois
    expect(notifications.sendAppointmentConfirmation).toHaveBeenCalledWith(
      'u1',
      'a@b.com',
      new Date(startAt),
      'America/Sao_Paulo',
    );
  });

  it('rejeita quando um funcionário já está alocado no horário', async () => {
    prisma.service.findMany.mockResolvedValue([{ id: 's1', estimatedMinutes: 30, price: 40 }]);
    prisma.employee.findMany.mockResolvedValue([{ id: 'e1', companyId }]);
    prisma.appointmentEmployee.findMany.mockResolvedValue([
      { employee: { user: { name: 'João' } } },
    ]);

    await expect(
      service.create(companyId, {
        clientId: 'c1',
        vehicleId: 'v1',
        serviceIds: ['s1'],
        startAt: futureIso('10:00'),
        employeeIds: ['e1'],
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejeita quando um serviceId informado não existe/está inativo', async () => {
    prisma.service.findMany.mockResolvedValue([{ id: 's1', estimatedMinutes: 30, price: 40 }]);

    await expect(
      service.create(companyId, {
        clientId: 'c1',
        vehicleId: 'v1',
        serviceIds: ['s1', 's2'],
        startAt: futureIso('10:00'),
      }),
    ).rejects.toThrow();
  });

  it('rejeita agendamento no passado considerando o fuso da empresa, não o do servidor (Cenário 4)', async () => {
    prisma.service.findMany.mockResolvedValue([{ id: 's1', estimatedMinutes: 30, price: 40 }]);
    prisma.company.findUnique.mockResolvedValue({ timezone: 'America/Sao_Paulo' });

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    await expect(
      service.create(companyId, {
        clientId: 'c1',
        vehicleId: 'v1',
        serviceIds: ['s1'],
        startAt: oneHourAgo,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.appointment.create).not.toHaveBeenCalled();
  });

  it('detecta conflito mesmo quando o cliente envia o instante com offset explícito em vez de Z (Cenário 5)', async () => {
    // "10:00-03:00" e "13:00Z" são o MESMO instante absoluto — um navegador
    // configurado em outro fuso poderia enviar a forma com offset. O backend
    // não deve deixar isso escapar da checagem de conflito.
    prisma.service.findMany.mockResolvedValue([{ id: 's1', estimatedMinutes: 60, price: 40 }]);
    prisma.employee.findMany.mockResolvedValue([{ id: 'e1', companyId }]);
    prisma.appointmentEmployee.findMany.mockResolvedValue([
      { employee: { user: { name: 'João' } } },
    ]);

    const utcIso = futureIso('13:00'); // ex.: 2026-08-01T13:00:00.000Z
    const localDate = DateTime.fromISO(utcIso, { zone: 'utc' })
      .setZone('America/Sao_Paulo')
      .toISO({ suppressMilliseconds: false });
    expect(localDate).toBeTruthy();
    // Mesmo instante que `utcIso`, mas representado com offset "-03:00".
    expect(new Date(localDate!).getTime()).toBe(new Date(utcIso).getTime());

    await expect(
      service.create(companyId, {
        clientId: 'c1',
        vehicleId: 'v1',
        serviceIds: ['s1'],
        startAt: localDate!,
        employeeIds: ['e1'],
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('cancela um agendamento existente', async () => {
    prisma.appointment.findFirst.mockResolvedValue({
      id: 'a1',
      status: AppointmentStatus.CONFIRMED,
    });
    prisma.appointment.update.mockResolvedValue({ id: 'a1', status: AppointmentStatus.CANCELLED });

    const result = await service.cancel(companyId, 'a1', 'Cliente desistiu');
    expect(result.status).toBe(AppointmentStatus.CANCELLED);
    expect(prisma.appointment.update).toHaveBeenCalledWith({
      where: { id: 'a1' },
      data: { status: AppointmentStatus.CANCELLED, cancelReason: 'Cliente desistiu' },
    });
  });

  describe('reschedule', () => {
    it('rejeita reagendamento para o passado (Cenário 4)', async () => {
      prisma.appointment.findFirst.mockResolvedValue({
        id: 'a1',
        startAt: new Date(futureIso('10:00')),
        endAt: new Date(new Date(futureIso('10:00')).getTime() + 60 * 60_000),
        employees: [],
      });

      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      await expect(service.reschedule(companyId, 'a1', { startAt: oneHourAgo })).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.appointment.update).not.toHaveBeenCalled();
    });

    it('preserva corretamente o novo horário local escolhido (Cenário 9)', async () => {
      const original = futureIso('10:00');
      const rescheduled = futureIso('14:00');

      prisma.appointment.findFirst.mockResolvedValue({
        id: 'a1',
        startAt: new Date(original),
        endAt: new Date(new Date(original).getTime() + 60 * 60_000),
        employees: [],
      });
      prisma.appointment.update.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'a1', ...data }),
      );

      const result = await service.reschedule(companyId, 'a1', { startAt: rescheduled });

      expect(result.startAt).toEqual(new Date(rescheduled));
      expect(result.endAt).toEqual(new Date(new Date(rescheduled).getTime() + 60 * 60_000));
      expect(result.status).toBe(AppointmentStatus.RESCHEDULED);
    });
  });
});
