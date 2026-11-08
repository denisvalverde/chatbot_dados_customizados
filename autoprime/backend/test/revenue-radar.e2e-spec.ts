process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://autoprime:autoprime@localhost:5432/autoprime_test?schema=public';
process.env.JWT_ACCESS_SECRET = 'e2e-access-secret';
process.env.JWT_REFRESH_SECRET = 'e2e-refresh-secret';
process.env.ANTHROPIC_API_KEY = ''; // nunca chama a API real nos testes

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppointmentStatus, Role, ServiceOrderStatus } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const DAY = 86_400_000;

/**
 * Radar de Receita contra Postgres real: o fluxo inteiro que gera dinheiro
 * (achar oportunidade → registrar contato → cliente agenda → receita
 * recuperada) e o isolamento entre empresas.
 */
describe('Radar de Receita (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const stamp = Date.now();
  const password = 'Senha@1234';
  let tokenA = '';
  let clientTokenA = '';
  let sumidoId = '';
  let vehicleId = '';
  let serviceId = '';
  let foreignClientId = '';

  async function makeCompany(label: string) {
    const company = await prisma.company.create({
      data: { name: `Lava ${label}`, slug: `radar-${label}-${stamp}` },
    });
    const service = await prisma.service.create({
      data: {
        companyId: company.id,
        name: 'Lavagem Completa',
        category: 'Lavagem',
        price: 80,
        estimatedMinutes: 60,
      },
    });
    return { company, service };
  }

  async function makeClient(companyId: string, name: string, email: string) {
    const user = await prisma.user.create({
      data: {
        email,
        name,
        phone: '11988887777',
        passwordHash: await bcrypt.hash(password, 4),
        role: Role.CLIENT,
        companyId,
        client: { create: { companyId } },
      },
      include: { client: true },
    });
    const vehicle = await prisma.vehicle.create({
      data: { companyId, clientId: user.client!.id, brand: 'VW', model: 'Golf', plate: 'RAD1A23' },
    });
    return { clientId: user.client!.id, vehicleId: vehicle.id };
  }

  async function visit(
    companyId: string,
    clientId: string,
    vId: string,
    sId: string,
    daysAgo: number,
  ) {
    const startAt = new Date(Date.now() - daysAgo * DAY);
    const appt = await prisma.appointment.create({
      data: {
        companyId,
        clientId,
        vehicleId: vId,
        startAt,
        endAt: new Date(startAt.getTime() + 3_600_000),
        status: AppointmentStatus.COMPLETED,
        services: { create: [{ serviceId: sId, priceAtBooking: 80 }] },
      },
    });
    await prisma.serviceOrder.create({
      data: {
        companyId,
        clientId,
        vehicleId: vId,
        appointmentId: appt.id,
        status: ServiceOrderStatus.COMPLETED,
        finishedAt: appt.endAt,
        items: { create: [{ serviceId: sId, price: 80 }] },
      },
    });
  }

  const login = async (email: string) =>
    (
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password })
        .expect(201)
    ).body.accessToken as string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = moduleRef.get(PrismaService);

    const a = await makeCompany('a');
    const b = await makeCompany('b');
    serviceId = a.service.id;

    await prisma.user.create({
      data: {
        email: `radar-admin-a-${stamp}@autoprime.app`,
        name: 'Admin A',
        passwordHash: await bcrypt.hash(password, 4),
        role: Role.ADMIN,
        companyId: a.company.id,
      },
    });

    // Empresa A: cliente que vinha a cada 14 dias e sumiu há 40.
    const sumido = await makeClient(a.company.id, 'Paula Sumida', `radar-sumida-${stamp}@x.app`);
    sumidoId = sumido.clientId;
    vehicleId = sumido.vehicleId;
    for (const d of [68, 54, 40]) {
      await visit(a.company.id, sumido.clientId, sumido.vehicleId, a.service.id, d);
    }

    // Empresa B: cliente idêntico — NUNCA pode aparecer para a empresa A.
    const foreign = await makeClient(
      b.company.id,
      'Cliente da Outra',
      `radar-outra-${stamp}@x.app`,
    );
    foreignClientId = foreign.clientId;
    for (const d of [68, 54, 40]) {
      await visit(b.company.id, foreign.clientId, foreign.vehicleId, b.service.id, d);
    }

    tokenA = await login(`radar-admin-a-${stamp}@autoprime.app`);
    clientTokenA = await login(`radar-sumida-${stamp}@x.app`);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('cliente final não acessa o Radar (RBAC)', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/revenue-radar')
      .set('Authorization', `Bearer ${clientTokenA}`)
      .expect(403);
  });

  it('encontra o cliente sumido, com valor, horário livre e link de WhatsApp', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/revenue-radar')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(res.body.opportunities).toHaveLength(1);
    const o = res.body.opportunities[0];
    expect(o.clientId).toBe(sumidoId);
    expect(o.kind).toBe('WIN_BACK');
    expect(o.potentialValue).toBe(80);
    expect(o.reason).toContain('a cada 14 dias');
    expect(o.whatsappUrl).toMatch(/^https:\/\/wa\.me\/5511988887777\?text=/);
    expect(o.suggestedSlot).not.toBeNull();
    expect(res.body.summary.annualRevenueAtRisk).toBeGreaterThan(0);
    // Isolamento: a cliente da empresa B não existe para a empresa A.
    expect(JSON.stringify(res.body)).not.toContain(foreignClientId);
  });

  it('não registra contato para cliente de outra empresa', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/revenue-radar/outreach')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ clientId: foreignClientId, kind: 'WIN_BACK', message: 'oi', estimatedValue: 80 })
      .expect(404);
  });

  it('contato → agendamento → receita recuperada', async () => {
    const contact = await request(app.getHttpServer())
      .post('/api/v1/revenue-radar/outreach')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ clientId: sumidoId, kind: 'WIN_BACK', message: 'Oi, Paula!', estimatedValue: 80 })
      .expect(201);
    expect(contact.body.whatsappUrl).toContain('wa.me/5511988887777');

    // Recém-contatada: continua visível, mas marcada e sem consumir horário.
    const after = await request(app.getHttpServer())
      .get('/api/v1/revenue-radar')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(after.body.opportunities[0].contactedRecently).toBe(true);

    // A cliente responde e agenda (createdAt > contactedAt).
    const company = await prisma.client.findUniqueOrThrow({ where: { id: sumidoId } });
    const startAt = new Date(Date.now() + 2 * DAY);
    await prisma.appointment.create({
      data: {
        companyId: company.companyId,
        clientId: sumidoId,
        vehicleId,
        startAt,
        endAt: new Date(startAt.getTime() + 3_600_000),
        status: AppointmentStatus.CONFIRMED,
        createdAt: new Date(Date.now() + 1000),
        services: { create: [{ serviceId, priceAtBooking: 80 }] },
      },
    });

    const results = await request(app.getHttpServer())
      .get('/api/v1/revenue-radar/results?days=30')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(results.body.contacted).toBe(1);
    expect(results.body.converted).toBe(1);
    expect(results.body.recoveredRevenue).toBe(80);
    expect(results.body.conversions[0].clientName).toBe('Paula Sumida');

    // Com agendamento futuro ela sai do Radar — ninguém é incomodado à toa.
    const final = await request(app.getHttpServer())
      .get('/api/v1/revenue-radar')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(final.body.opportunities).toHaveLength(0);
  });

  it('personalização sem chave de IA devolve o rascunho com segurança', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/revenue-radar/personalize')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ clientId: sumidoId, message: 'Rascunho', facts: ['Vinha a cada 14 dias'] })
      .expect(201);
    expect(res.body).toMatchObject({ message: 'Rascunho', generatedBy: 'template' });
  });
});
