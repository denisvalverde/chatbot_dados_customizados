import { randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChargeResult, CreateChargeInput, PaymentAdapter } from './payment-adapter.interface';

/**
 * Adapter Mercado Pago. Sem MERCADO_PAGO_ACCESS_TOKEN, opera em modo sandbox.
 */
@Injectable()
export class MercadoPagoAdapter implements PaymentAdapter {
  private readonly logger = new Logger(MercadoPagoAdapter.name);

  constructor(private readonly config: ConfigService) {}

  async createCharge(input: CreateChargeInput): Promise<ChargeResult> {
    const accessToken = this.config.get<string>('payments.mercadoPagoAccessToken');
    if (!accessToken) {
      this.logger.warn(`[sandbox] Cobrança Mercado Pago simulada para ${input.referenceId}`);
      return {
        providerRef: `sandbox_mp_${randomUUID()}`,
        status: 'PENDING',
        checkoutUrl: `https://checkout.sandbox.autoprime.local/mp/${input.referenceId}`,
      };
    }

    // TODO(fase 2): usar a API REST do Mercado Pago com accessToken real.
    throw new Error(
      'Integração Mercado Pago real ainda não implementada — configure o modo sandbox.',
    );
  }
}
