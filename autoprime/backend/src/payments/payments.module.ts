import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { StripeAdapter } from './adapters/stripe.adapter';
import { MercadoPagoAdapter } from './adapters/mercado-pago.adapter';
import { PixAdapter } from './adapters/pix.adapter';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, StripeAdapter, MercadoPagoAdapter, PixAdapter],
  exports: [PaymentsService],
})
export class PaymentsModule {}
