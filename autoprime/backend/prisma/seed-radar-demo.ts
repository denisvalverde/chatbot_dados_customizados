/**
 * Histórico de demonstração para o Radar de Receita (apenas desenvolvimento —
 * o seed nunca roda sozinho em produção). Cria clientes com ritmos reais de
 * visita relativos à data de hoje, para que o Radar mostre todos os tipos de
 * oportunidade: no ponto de voltar, sumidos, faltas sem remarcação, upsell e
 * uma receita já recuperada. Idempotente: se já existir, não duplica.
 */
import { AppointmentStatus, PrismaClient, Role, ServiceOrderStatus } from '@prisma/client';

const DAY = 86_400_000;
const PRICES: Record<string, number> = {
  'seed-lavagem-simples': 40,
  'seed-lavagem-completa': 70,
  'seed-cristalizacao': 350,
};
const MINUTES: Record<string, number> = {
  'seed-lavagem-simples': 30,
  'seed-lavagem-completa': 60,
  'seed-cristalizacao': 180,
};
const S = 'seed-lavagem-simples';
const C = 'seed-lavagem-completa';
const X = 'seed-cristalizacao';

interface DemoClient {
  key: string;
  name: string;
  phone: string;
  car: [string, string];
  /** Dias atrás de cada visita concluída e os serviços feitos. */
  visits: [number, string[]][];
  missed?: { daysAgo: number; status: 'NO_SHOW' | 'CANCELLED'; services: string[] };
  /** Agendamento futuro: dias à frente, hora UTC, serviços. */
  upcoming?: { inDays: number; hourUtc: number; services: string[]; createdDaysAgo?: number };
  outreachDaysAgo?: number;
}

const every = (startDaysAgo: number, step: number, count: number, services: string[]) =>
  Array.from({ length: count }, (_, i) => [startDaysAgo + i * step, services] as [number, string[]]);

const CLIENTS: DemoClient[] = [
  { key: 'ana', name: 'Ana Paula Souza', phone: '11987650001', car: ['Honda', 'HR-V'], visits: every(33, 14, 6, [C]) },
  { key: 'bruno', name: 'Bruno Martins', phone: '11987650002', car: ['Toyota', 'Corolla'], visits: every(20, 21, 5, [C]) },
  { key: 'camila', name: 'Camila Rocha', phone: '11987650003', car: ['Jeep', 'Compass'], visits: every(27, 30, 4, [C]) },
  {
    key: 'diego',
    name: 'Diego Fernandes',
    phone: '11987650004',
    car: ['BMW', '320i'],
    visits: every(40, 30, 3, [C]),
    missed: { daysAgo: 4, status: 'NO_SHOW', services: [X] },
  },
  { key: 'eduarda', name: 'Eduarda Lima', phone: '11987650005', car: ['Hyundai', 'Creta'], visits: every(70, 15, 5, [C]) },
  {
    key: 'felipe',
    name: 'Felipe Andrade',
    phone: '11987650006',
    car: ['Audi', 'A3'],
    visits: [[5, [C]], [35, [X]], [65, [C]]],
    upcoming: { inDays: 1, hourUtc: 13, services: [C] },
  },
  { key: 'gabriela', name: 'Gabriela Nunes', phone: '11987650007', car: ['Fiat', 'Pulse'], visits: [[10, [C]], [55, [X]], [100, [C]]] },
  { key: 'henrique', name: 'Henrique Costa', phone: '11987650008', car: ['VW', 'Polo'], visits: every(6, 7, 8, [S]) },
  {
    key: 'isabela',
    name: 'Isabela Moraes',
    phone: '11987650009',
    car: ['Chevrolet', 'Tracker'],
    visits: every(45, 25, 3, [C]),
    missed: { daysAgo: 10, status: 'CANCELLED', services: [C] },
  },
  { key: 'joao', name: 'João Pedro Alves', phone: '11987650010', car: ['Nissan', 'Kicks'], visits: every(4, 20, 4, [C]) },
  { key: 'larissa', name: 'Larissa Teixeira', phone: '11987650011', car: ['Renault', 'Kwid'], visits: [[35, [S]]] },
  { key: 'marcos', name: 'Marcos Vinícius', phone: '11987650012', car: ['Ford', 'Ranger'], visits: every(200, 10, 4, [C]) },
  {
    key: 'natalia',
    name: 'Natália Ribeiro',
    phone: '11987650013',
    car: ['Volvo', 'XC40'],
    visits: [[25, [C]], [60, [X]]],
    upcoming: { inDays: 2, hourUtc: 14, services: [X] },
  },
  { key: 'otavio', name: 'Otávio Barros', phone: '11987650014', car: ['Fiat', 'Uno'], visits: every(500, 20, 3, [S]) },
  {
    key: 'rafael',
    name: 'Rafael Gomes',
    phone: '11987650015',
    car: ['Mitsubishi', 'L200'],
    visits: every(52, 18, 4, [C]),
    outreachDaysAgo: 9,
    upcoming: { inDays: 2, hourUtc: 17, services: [C, X], createdDaysAgo: 7 },
  },
];

export async function seedRadarDemo(prisma: PrismaClient, companyId: string, passwordHash: string) {
  const marker = 'radar.ana@demo.autoprime.app';
  if (await prisma.user.findUnique({ where: { email: marker } })) {
    console.log('Radar demo: histórico já existe, pulando.');
    return;
  }

  const now = Date.now();
  const at = (daysAgo: number, hourUtc = 13) => {
    const d = new Date(now - daysAgo * DAY);
    d.setUTCHours(hourUtc, 0, 0, 0);
    return d;
  };
  const sum = (ids: string[]) => ids.reduce((s, id) => s + PRICES[id], 0);
  const minutes = (ids: string[]) => ids.reduce((s, id) => s + MINUTES[id], 0);

  for (const c of CLIENTS) {
    const user = await prisma.user.create({
      data: {
        email: `radar.${c.key}@demo.autoprime.app`,
        name: c.name,
        phone: c.phone,
        passwordHash,
        role: Role.CLIENT,
        companyId,
        client: { create: { companyId, lgpdConsentAt: new Date() } },
      },
      include: { client: true },
    });
    const clientId = user.client!.id;
    const vehicle = await prisma.vehicle.create({
      data: { companyId, clientId, brand: c.car[0], model: c.car[1], plate: `DEM${c.key.slice(0, 1).toUpperCase()}${String(CLIENTS.indexOf(c)).padStart(3, '0')}` },
    });

    const book = async (
      startAt: Date,
      services: string[],
      status: AppointmentStatus,
      createdAt?: Date,
    ) =>
      prisma.appointment.create({
        data: {
          companyId,
          clientId,
          vehicleId: vehicle.id,
          startAt,
          endAt: new Date(startAt.getTime() + minutes(services) * 60_000),
          status,
          ...(createdAt ? { createdAt } : { createdAt: new Date(startAt.getTime() - 2 * DAY) }),
          services: {
            create: services.map((serviceId) => ({ serviceId, priceAtBooking: PRICES[serviceId] })),
          },
        },
      });

    for (const [daysAgo, services] of c.visits) {
      const appt = await book(at(daysAgo), services, AppointmentStatus.COMPLETED);
      await prisma.serviceOrder.create({
        data: {
          companyId,
          clientId,
          vehicleId: vehicle.id,
          appointmentId: appt.id,
          status: ServiceOrderStatus.COMPLETED,
          startedAt: appt.startAt,
          finishedAt: appt.endAt,
          createdAt: appt.startAt,
          items: { create: services.map((serviceId) => ({ serviceId, price: PRICES[serviceId] })) },
        },
      });
    }

    if (c.missed) {
      await book(at(c.missed.daysAgo, 15), c.missed.services, c.missed.status);
    }

    if (c.outreachDaysAgo !== undefined) {
      await prisma.outreach.create({
        data: {
          companyId,
          clientId,
          kind: 'WIN_BACK',
          message: `Oi, ${c.name.split(' ')[0]}! Sentimos sua falta — posso reservar um horário pra você?`,
          estimatedValue: 70,
          contactedAt: new Date(now - c.outreachDaysAgo * DAY),
        },
      });
    }

    if (c.upcoming) {
      const start = new Date(now + c.upcoming.inDays * DAY);
      start.setUTCHours(c.upcoming.hourUtc, 0, 0, 0);
      await book(
        start,
        c.upcoming.services,
        AppointmentStatus.CONFIRMED,
        c.upcoming.createdDaysAgo !== undefined ? new Date(now - c.upcoming.createdDaysAgo * DAY) : undefined,
      );
    }
  }

  console.log(`Radar demo: ${CLIENTS.length} clientes com histórico criados (receita: ${sum([C, X])} recuperada de exemplo).`);
}
