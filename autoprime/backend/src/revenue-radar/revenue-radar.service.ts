import { Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentStatus, ServiceOrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { getCompanyTimezone } from '../common/timezone.util';
import {
  attributeOutreach,
  RADAR_RULES,
  RadarClientInput,
  RadarMissedAppointment,
  RadarVisit,
  runRadar,
  whatsappLink,
} from './radar.engine';
import { CreateOutreachDto } from './dto/create-outreach.dto';
import { PersonalizeMessageDto } from './dto/personalize-message.dto';

const DAY_MS = 86_400_000;
/** Um pouco além de "perdido" (365 dias) para ainda conseguir medir o ritmo. */
const HISTORY_DAYS = 450;

const UPCOMING = new Set<AppointmentStatus>([
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.IN_QUEUE,
  AppointmentStatus.IN_PROGRESS,
  AppointmentStatus.RESCHEDULED,
]);
const VISIT_ORDER_STATUSES = [ServiceOrderStatus.COMPLETED, ServiceOrderStatus.DELIVERED];

/**
 * Camada fina sobre o motor puro (`radar.engine.ts`): carrega o histórico da
 * empresa em poucas consultas, entrega ao motor e persiste os contatos. Toda
 * consulta é filtrada por `companyId` — o Radar nunca enxerga outra empresa.
 */
@Injectable()
export class RevenueRadarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  async scan(companyId: string, now = new Date()) {
    const since = new Date(now.getTime() - HISTORY_DAYS * DAY_MS);
    const horizon = new Date(now.getTime() + RADAR_RULES.capacityHorizonDays * DAY_MS);

    const [company, timezone, clients, orders, appointments, services, lastContacts] =
      await Promise.all([
        this.prisma.company.findUnique({ where: { id: companyId }, select: { name: true } }),
        getCompanyTimezone(this.prisma, companyId),
        this.prisma.client.findMany({
          where: { companyId, user: { isActive: true } },
          select: {
            id: true,
            user: { select: { name: true, phone: true } },
            vehicles: {
              select: { brand: true, model: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        }),
        this.prisma.serviceOrder.findMany({
          where: {
            companyId,
            status: { in: VISIT_ORDER_STATUSES },
            createdAt: { gte: since },
          },
          select: {
            clientId: true,
            appointmentId: true,
            createdAt: true,
            finishedAt: true,
            items: { select: { serviceId: true, price: true } },
          },
        }),
        this.prisma.appointment.findMany({
          where: { companyId, startAt: { gte: since } },
          select: {
            id: true,
            clientId: true,
            startAt: true,
            endAt: true,
            status: true,
            services: { select: { serviceId: true, priceAtBooking: true } },
          },
        }),
        this.prisma.service.findMany({
          where: { companyId, active: true },
          select: { id: true, name: true, price: true, estimatedMinutes: true },
        }),
        this.prisma.outreach.groupBy({
          by: ['clientId'],
          where: { companyId },
          _max: { contactedAt: true },
        }),
      ]);

    const visitsByClient = new Map<string, RadarVisit[]>();
    const pushVisit = (clientId: string, v: RadarVisit) => {
      if (!visitsByClient.has(clientId)) visitsByClient.set(clientId, []);
      visitsByClient.get(clientId)!.push(v);
    };

    const appointmentsWithOrder = new Set<string>();
    for (const o of orders) {
      if (o.appointmentId) appointmentsWithOrder.add(o.appointmentId);
      pushVisit(o.clientId, {
        at: o.finishedAt ?? o.createdAt,
        value: o.items.reduce((s, i) => s + Number(i.price), 0),
        serviceIds: o.items.map((i) => i.serviceId),
      });
    }

    const apptsByClient = new Map<string, typeof appointments>();
    for (const a of appointments) {
      // Agendamento concluído sem OS também é visita (lojas que não abrem OS).
      if (a.status === AppointmentStatus.COMPLETED && !appointmentsWithOrder.has(a.id)) {
        pushVisit(a.clientId, {
          at: a.endAt,
          value: a.services.reduce((s, x) => s + Number(x.priceAtBooking), 0),
          serviceIds: a.services.map((x) => x.serviceId),
        });
      }
      if (!apptsByClient.has(a.clientId)) apptsByClient.set(a.clientId, []);
      apptsByClient.get(a.clientId)!.push(a);
    }

    const contactByClient = new Map(lastContacts.map((c) => [c.clientId, c._max.contactedAt]));

    const radarClients: RadarClientInput[] = clients.map((c) => {
      const appts = apptsByClient.get(c.id) ?? [];
      const hasUpcomingAppointment = appts.some((a) => a.startAt >= now && UPCOMING.has(a.status));
      const pastSorted = appts
        .filter((a) => a.startAt < now)
        .sort((a, b) => b.startAt.getTime() - a.startAt.getTime());
      const latest = pastSorted[0];
      let lastMissed: RadarMissedAppointment | null = null;
      if (
        latest &&
        (latest.status === AppointmentStatus.CANCELLED ||
          latest.status === AppointmentStatus.NO_SHOW)
      ) {
        lastMissed = {
          at: latest.startAt,
          status: latest.status,
          value: latest.services.reduce((s, x) => s + Number(x.priceAtBooking), 0),
          serviceIds: latest.services.map((x) => x.serviceId),
        };
      }
      return {
        clientId: c.id,
        name: c.user.name,
        phone: c.user.phone,
        vehicle: c.vehicles[0] ?? null,
        visits: visitsByClient.get(c.id) ?? [],
        hasUpcomingAppointment,
        lastMissed,
        lastContactedAt: contactByClient.get(c.id) ?? null,
      };
    });

    const busy = appointments
      .filter((a) => a.endAt > now && a.startAt < horizon && UPCOMING.has(a.status))
      .map((a) => ({ startAt: a.startAt, endAt: a.endAt }));

    return runRadar({
      now,
      timezone,
      companyName: company?.name ?? 'nossa equipe',
      clients: radarClients,
      services: services.map((s) => ({
        id: s.id,
        name: s.name,
        price: Number(s.price),
        estimatedMinutes: s.estimatedMinutes,
      })),
      busy,
    });
  }

  /** Registra que a equipe contatou o cliente e devolve o link pronto do WhatsApp. */
  async recordOutreach(companyId: string, userId: string | undefined, dto: CreateOutreachDto) {
    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId, companyId },
      select: { id: true, user: { select: { phone: true } } },
    });
    if (!client) throw new NotFoundException('Cliente não encontrado nesta empresa.');

    const outreach = await this.prisma.outreach.create({
      data: {
        companyId,
        clientId: client.id,
        createdById: userId ?? null,
        kind: dto.kind,
        channel: dto.channel ?? 'WHATSAPP',
        message: dto.message,
        estimatedValue: dto.estimatedValue,
      },
    });

    return {
      id: outreach.id,
      contactedAt: outreach.contactedAt,
      whatsappUrl: whatsappLink(client.user.phone, dto.message),
    };
  }

  /**
   * Prova do resultado: contatos feitos nos últimos `days` dias × agendamentos
   * criados depois deles. É este número que paga (e vende) a assinatura.
   */
  async results(companyId: string, days = 30, now = new Date()) {
    const from = new Date(now.getTime() - days * DAY_MS);
    const outreaches = await this.prisma.outreach.findMany({
      where: { companyId, contactedAt: { gte: from, lte: now } },
      select: {
        id: true,
        clientId: true,
        kind: true,
        contactedAt: true,
        estimatedValue: true,
        client: { select: { user: { select: { name: true } } } },
      },
      orderBy: { contactedAt: 'desc' },
    });

    const clientIds = Array.from(new Set(outreaches.map((o) => o.clientId)));
    const bookings = clientIds.length
      ? await this.prisma.appointment.findMany({
          where: { companyId, clientId: { in: clientIds }, createdAt: { gt: from } },
          select: {
            id: true,
            clientId: true,
            createdAt: true,
            status: true,
            services: { select: { priceAtBooking: true } },
          },
        })
      : [];

    const attribution = attributeOutreach(
      outreaches.map((o) => ({
        id: o.id,
        clientId: o.clientId,
        kind: o.kind,
        contactedAt: o.contactedAt,
        estimatedValue: Number(o.estimatedValue),
      })),
      bookings.map((b) => ({
        id: b.id,
        clientId: b.clientId,
        createdAt: b.createdAt,
        status: b.status,
        value: b.services.reduce((s, x) => s + Number(x.priceAtBooking), 0),
      })),
    );

    const names = new Map(outreaches.map((o) => [o.clientId, o.client.user.name]));
    return {
      periodDays: days,
      attributionWindowDays: RADAR_RULES.attributionWindowDays,
      ...attribution,
      conversions: attribution.conversions.map((c) => ({
        ...c,
        clientName: names.get(c.clientId) ?? '',
      })),
    };
  }

  /** Reescreve a mensagem com IA usando SOMENTE fatos reais do cliente. */
  async personalize(companyId: string, dto: PersonalizeMessageDto) {
    const [company, client] = await Promise.all([
      this.prisma.company.findUnique({ where: { id: companyId }, select: { name: true } }),
      this.prisma.client.findFirst({
        where: { id: dto.clientId, companyId },
        select: { user: { select: { name: true, phone: true } } },
      }),
    ]);
    if (!client) throw new NotFoundException('Cliente não encontrado nesta empresa.');

    const result = await this.ai.personalizeOutreach({
      companyName: company?.name ?? 'nossa equipe',
      clientName: client.user.name,
      draft: dto.message,
      facts: dto.facts ?? [],
    });
    return { ...result, whatsappUrl: whatsappLink(client.user.phone, result.message) };
  }
}
