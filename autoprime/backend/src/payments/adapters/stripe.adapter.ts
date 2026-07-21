import { randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChargeResult, CreateChargeInput, PaymentAdapter } from './payment-adapter.interface';

/**
 * Adapter Stripe. Sem STRIPE_SECRET_KEY configurada, opera em modo sandbox:
 * gera uma cobrança simulada com status PENDING, mantendo o mesmo contrato
 * que o adapter real (que usaria o SDK oficial `stripe`) para permitir
 * trocar de modo sem alterar o restante da aplicação.
 */
@Injectable()
export class StripeAdapter implements PaymentAdapter {
  private readonly logger = new Logger(StripeAdapter.name);

  constructor(private readonly config: ConfigService) {}

  async createCharge(input: CreateChargeInput): Promise<ChargeResult> {
    const secretKey = this.config.get<string>('payments.stripeSecretKey');
    if (!secretKey) {
      this.logger.warn(`[sandbox] Cobrança Stripe simulada para ${input.referenceId}`);
      return {
        providerRef: `sandbox_stripe_${randomUUID()}`,
        status: 'PENDING',
        checkoutUrl: `https://checkout.sandbox.autoprime.local/${input.referenceId}`,
      };
    }

    // TODO(fase 2): usar o SDK oficial `stripe` com secretKey real.
    // const stripe = new Stripe(secretKey);
    // const session = await stripe.checkout.sessions.create({ ... });
    throw new Error('Integração Stripe real ainda não implementada — configure o modo sandbox.');
  }
}
