process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://autoprime:autoprime@localhost:5432/autoprime_test?schema=public';
process.env.JWT_ACCESS_SECRET = 'e2e-access-secret';
process.env.JWT_REFRESH_SECRET = 'e2e-refresh-secret';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('AutoPrime API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const companySlug = `e2e-empresa-${Date.now()}`;
  const branchSlug = 'unidade-e2e';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    const swaggerConfig = new DocumentBuilder().setTitle('AutoPrime API').build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);

    await app.init();

    prisma = moduleRef.get(PrismaService);
    const company = await prisma.company.create({ data: { name: 'Empresa E2E', slug: companySlug } });
    await prisma.branch.create({
      data: {
        companyId: company.id,
        name: 'Unidade E2E',
        slug: branchSlug,
        address: 'Rua de Teste',
        number: '123',
        district: 'Centro',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '00000-000',
        phone: '11999999999',
        isPublished: true,
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  const client = {
    companySlug,
    name: 'Cliente E2E',
    email: `e2e-${Date.now()}@autoprime.app`,
    password: 'Senha@1234',
    lgpdConsent: 'true',
  };

  it('rejeita rotas protegidas sem token', async () => {
    await request(app.getHttpServer()).get('/api/v1/clients').expect(401);
  });

  it('registra um novo cliente e retorna tokens', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(client)
      .expect(201);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.role).toBe('CLIENT');
  });

  it('rejeita registro duplicado do mesmo e-mail', async () => {
    await request(app.getHttpServer()).post('/api/v1/auth/register').send(client).expect(409);
  });

  it('faz login com as credenciais criadas', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: client.email, password: client.password })
      .expect(201);

    expect(res.body.accessToken).toBeDefined();
  });

  it('rejeita login com senha errada', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: client.email, password: 'senha-errada' })
      .expect(401);
  });

  it('bloqueia cliente de acessar rota exclusiva de staff (RBAC)', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: client.email, password: client.password })
      .expect(201);

    const token = login.body.accessToken;

    await request(app.getHttpServer())
      .get('/api/v1/dashboard/summary?from=2026-01-01&to=2026-12-31')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('exige autenticação para listar o catálogo de serviços', async () => {
    await request(app.getHttpServer()).get('/api/v1/services').expect(401);
  });

  it('lista o catálogo de serviços autenticado', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: client.email, password: client.password })
      .expect(201);

    await request(app.getHttpServer())
      .get('/api/v1/services')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);
  });

  it('expõe a documentação Swagger', async () => {
    await request(app.getHttpServer()).get('/api/docs').expect(200);
  });

  it('lista empresas ativas publicamente (seletor do cadastro sem ?empresa=)', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/companies/public').expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((c: { slug: string }) => c.slug === companySlug)).toBe(true);
    // Nunca deve vazar dados sensíveis na listagem pública.
    expect(res.body[0]).not.toHaveProperty('active');
  });

  it('lista só unidades publicadas de uma empresa publicamente', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/companies/${companySlug}/branches`)
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].slug).toBe(branchSlug);
  });

  it('registra cliente já escolhendo uma unidade publicada (link com ?empresa=&unidade=)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        companySlug,
        branchSlug,
        name: 'Cliente Com Unidade',
        email: `e2e-branch-${Date.now()}@autoprime.app`,
        password: 'Senha@1234',
        lgpdConsent: 'true',
      })
      .expect(201);

    expect(res.body.accessToken).toBeDefined();
  });

  it('rejeita branchSlug de unidade inexistente/não publicada', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        companySlug,
        branchSlug: 'unidade-que-nao-existe',
        name: 'Cliente Inválido',
        email: `e2e-branch-invalida-${Date.now()}@autoprime.app`,
        password: 'Senha@1234',
        lgpdConsent: 'true',
      })
      .expect(404);
  });
});
