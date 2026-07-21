import { PrismaClient, Role, FuelType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function hash(password: string) {
  return bcrypt.hash(password, 12);
}

async function main() {
  console.log('Seeding AutoPrime...');

  const adminPassword = await hash('Admin@123');
  const admin = await prisma.user.upsert({
    where: { email: 'admin@autoprime.app' },
    update: {},
    create: {
      email: 'admin@autoprime.app',
      name: 'Administrador AutoPrime',
      passwordHash: adminPassword,
      role: Role.ADMIN,
      employee: { create: { position: 'Administrador', commissionRate: 0 } },
    },
  });

  const managerPassword = await hash('Manager@123');
  await prisma.user.upsert({
    where: { email: 'gerente@autoprime.app' },
    update: {},
    create: {
      email: 'gerente@autoprime.app',
      name: 'Gerente Geral',
      passwordHash: managerPassword,
      role: Role.MANAGER,
      employee: { create: { position: 'Gerente', commissionRate: 2 } },
    },
  });

  const washerPassword = await hash('Washer@123');
  const washerUser = await prisma.user.upsert({
    where: { email: 'lavador@autoprime.app' },
    update: {},
    create: {
      email: 'lavador@autoprime.app',
      name: 'João Lavador',
      passwordHash: washerPassword,
      role: Role.WASHER,
      employee: { create: { position: 'Lavador', commissionRate: 8 } },
    },
    include: { employee: true },
  });

  const detailerPassword = await hash('Detailer@123');
  await prisma.user.upsert({
    where: { email: 'detalhador@autoprime.app' },
    update: {},
    create: {
      email: 'detalhador@autoprime.app',
      name: 'Maria Detalhadora',
      passwordHash: detailerPassword,
      role: Role.DETAILER,
      employee: { create: { position: 'Detalhador(a)', commissionRate: 10 } },
    },
  });

  const clientPassword = await hash('Cliente@123');
  const clientUser = await prisma.user.upsert({
    where: { email: 'cliente@autoprime.app' },
    update: {},
    create: {
      email: 'cliente@autoprime.app',
      name: 'Carlos Cliente',
      phone: '11999990000',
      passwordHash: clientPassword,
      role: Role.CLIENT,
      client: {
        create: {
          document: '12345678900',
          addressCity: 'São Paulo',
          addressState: 'SP',
          lgpdConsentAt: new Date(),
        },
      },
    },
    include: { client: true },
  });

  const shampoo = await prisma.product.upsert({
    where: { sku: 'SHAMPOO-001' },
    update: {},
    create: {
      name: 'Shampoo automotivo neutro',
      sku: 'SHAMPOO-001',
      unit: 'L',
      quantity: 50,
      minQuantity: 10,
      costPrice: 25,
    },
  });

  const cera = await prisma.product.upsert({
    where: { sku: 'CERA-001' },
    update: {},
    create: {
      name: 'Cera de carnaúba',
      sku: 'CERA-001',
      unit: 'un',
      quantity: 20,
      minQuantity: 5,
      costPrice: 60,
    },
  });

  const lavagemSimples = await prisma.service.upsert({
    where: { id: 'seed-lavagem-simples' },
    update: {},
    create: {
      id: 'seed-lavagem-simples',
      name: 'Lavagem Simples',
      category: 'Lavagem',
      description: 'Lavagem externa completa com shampoo neutro.',
      price: 40,
      estimatedMinutes: 30,
      employeesRequired: 1,
      checklistItems: {
        create: [
          { label: 'Lavar carroceria', order: 0 },
          { label: 'Limpar rodas e pneus', order: 1 },
          { label: 'Secar veículo', order: 2 },
        ],
      },
      productsUsed: { create: [{ productId: shampoo.id, quantity: 0.5 }] },
    },
  });

  await prisma.service.upsert({
    where: { id: 'seed-lavagem-completa' },
    update: {},
    create: {
      id: 'seed-lavagem-completa',
      name: 'Lavagem Completa',
      category: 'Lavagem',
      description: 'Lavagem externa + interna + aspiração.',
      price: 70,
      estimatedMinutes: 60,
      employeesRequired: 1,
      checklistItems: {
        create: [
          { label: 'Lavar carroceria', order: 0 },
          { label: 'Aspirar interior', order: 1 },
          { label: 'Limpar painel', order: 2 },
          { label: 'Secar veículo', order: 3 },
        ],
      },
      productsUsed: { create: [{ productId: shampoo.id, quantity: 0.8 }] },
    },
  });

  await prisma.service.upsert({
    where: { id: 'seed-cristalizacao' },
    update: {},
    create: {
      id: 'seed-cristalizacao',
      name: 'Cristalização de Pintura',
      category: 'Estética',
      description: 'Aplicação de cristalizador de pintura com proteção UV.',
      price: 350,
      estimatedMinutes: 180,
      employeesRequired: 2,
      checklistItems: {
        create: [
          { label: 'Descontaminação da pintura', order: 0 },
          { label: 'Polimento', order: 1 },
          { label: 'Aplicação do cristalizador', order: 2 },
        ],
      },
      productsUsed: { create: [{ productId: cera.id, quantity: 1 }] },
    },
  });

  const vehicle = await prisma.vehicle.upsert({
    where: { id: 'seed-vehicle-1' },
    update: {},
    create: {
      id: 'seed-vehicle-1',
      clientId: clientUser.client!.id,
      brand: 'Volkswagen',
      model: 'Golf',
      year: 2021,
      fuel: FuelType.FLEX,
      color: 'Prata',
      plate: 'ABC1D23',
      km: 32000,
    },
  });

  console.log('Seed concluído.');
  console.log('Login admin: admin@autoprime.app / Admin@123');
  console.log('Login cliente: cliente@autoprime.app / Cliente@123');
  console.log({ adminId: admin.id, washerId: washerUser.employee?.id, vehicleId: vehicle.id, lavagemSimplesId: lavagemSimples.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
