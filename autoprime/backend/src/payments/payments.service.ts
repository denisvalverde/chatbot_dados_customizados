import { randomUUID } from 'crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentMethod, PaymentProvider, PaymentStatus, TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StripeAdapter } from './adapters/stripe.adapter';
import { MercadoPagoAdapter } from './adapters/mercado-pago.adapter';
import { PixAdapter } from './adapters/pix.adapter';
import { ChargeResult } from './adapters/payment-adapter.interface';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeAdapter,
    private readonly mercadoPago: MercadoPagoAdapter,
    private readonly pix: PixAdapter,
  ) {}

  async createPayment(dto: CreatePaymentDto) {
    const order = await this.prisma.serviceOrder.findUnique({
      where: { id: dto.serviceOrderId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Ordem de serviço não encontrada.');

    const amount = order.items.reduce((sum, item) => sum + Number(item.price), 0);
    if (amount <= 0) throw new BadRequestException('OS sem itens para cobrança.');

    const { provider, adapter } = this.resolveProvider(dto.method);
    const charge = adapter
      ? await adapter.createCharge({
          amount,
          description: `AutoPrime OS #${order.number}`,
          referenceId: order.id,
        })
      : this.cashDeskCharge();

    return this.prisma.payment.create({
      data: {
        serviceOrderId: order.id,
        provider,
        method: dto.method,
        amount,
        status: this.mapStatus(charge.status),
        providerRef: charge.providerRef,
        pixQrCode: charge.pixQrCode,
        pixCopyPaste: charge.pixCopyPaste,
      },
    });
  }

  async confirmPayment(id: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException('Pagamento não encontrado.');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id },
        data: { status: PaymentStatus.PAID, paidAt: new Date() },
      });

      await tx.transaction.create({
        data: {
          type: TransactionType.INCOME,
          category: 'Pagamentos',
          description: `Pagamento confirmado (${payment.provider})`,
          amount: payment.amount,
          method: payment.method,
          serviceOrderId: payment.serviceOrderId,
        },
      });

      return updated;
    });
  }

  findByServiceOrder(serviceOrderId: string) {
    return this.prisma.payment.findMany({
      where: { serviceOrderId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private resolveProvider(method: PaymentMethod) {
    switch (method) {
      case PaymentMethod.PIX:
        return { provider: PaymentProvider.PIX_MANUAL, adapter: this.pix };
      case PaymentMethod.CREDIT_CARD:
      case PaymentMethod.DEBIT_CARD:
      case PaymentMethod.APPLE_PAY:
      case PaymentMethod.GOOGLE_PAY:
        return { provider: PaymentProvider.STRIPE, adapter: this.stripe };
      case PaymentMethod.BANK_SLIP:
        return { provider: PaymentProvider.MERCADO_PAGO, adapter: this.mercadoPago };
      case PaymentMethod.CASH:
      default:
        return { provider: PaymentProvider.CASH_DESK, adapter: null };
    }
  }

  private cashDeskCharge(): ChargeResult {
    return { providerRef: `cash_${randomUUID()}`, status: 'PENDING' };
  }

  private mapStatus(status: 'PENDING' | 'PAID' | 'FAILED'): PaymentStatus {
    if (status === 'PAID') return PaymentStatus.PAID;
    if (status === 'FAILED') return PaymentStatus.FAILED;
    return PaymentStatus.PENDING;
  }
}
