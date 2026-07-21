import { BadRequestException } from '@nestjs/common';
import { ServiceOrderStatus, StockMovementType, TransactionType } from '@prisma/client';
import { ServiceOrdersService } from './service-orders.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ServiceOrdersService', () => {
  let service: ServiceOrdersService;
  let tx: {
    serviceProduct: { findMany: jest.Mock };
    product: { update: jest.Mock };
    stockMovement: { create: jest.Mock };
    transaction: { create: jest.Mock };
    serviceOrder: { update: jest.Mock };
  };
  let prisma: { serviceOrder: { findUnique: jest.Mock }; $transaction: jest.Mock };

  const order = {
    id: 'os1',
    number: 42,
    status: ServiceOrderStatus.OPEN,
    clientId: 'c1',
    items: [
      { serviceId: 's1', price: 40 },
      { serviceId: 's2', price: 70 },
    ],
  };

  beforeEach(() => {
    tx = {
      serviceProduct: {
        findMany: jest.fn().mockResolvedValue([{ productId: 'p1', quantity: 0.5 }]),
      },
      product: { update: jest.fn() },
      stockMovement: { create: jest.fn() },
      transaction: { create: jest.fn() },
      serviceOrder: {
        update: jest.fn().mockResolvedValue({ ...order, status: ServiceOrderStatus.COMPLETED }),
      },
    };

    prisma = {
      serviceOrder: { findUnique: jest.fn().mockResolvedValue(order) },
      $transaction: jest.fn((callback) => callback(tx)),
    };

    service = new ServiceOrdersService(prisma as unknown as PrismaService);
  });

  it('ao concluir, baixa o estoque dos produtos usados e lança receita', async () => {
    const result = await service.complete('os1');

    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { quantity: { decrement: 0.5 } },
    });
    expect(tx.stockMovement.create).toHaveBeenCalledWith({
      data: {
        productId: 'p1',
        type: StockMovementType.OUT,
        quantity: 0.5,
        reason: 'OS #42',
      },
    });
    expect(tx.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: TransactionType.INCOME,
        amount: 110, // 40 + 70
        serviceOrderId: 'os1',
      }),
    });
    expect(result.status).toBe(ServiceOrderStatus.COMPLETED);
  });

  it('não permite concluir uma OS já concluída', async () => {
    prisma.serviceOrder.findUnique.mockResolvedValue({
      ...order,
      status: ServiceOrderStatus.COMPLETED,
    });

    await expect(service.complete('os1')).rejects.toThrow(BadRequestException);
  });
});
