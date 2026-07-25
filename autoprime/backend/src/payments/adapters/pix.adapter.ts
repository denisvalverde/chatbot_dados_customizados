import { randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChargeResult, CreateChargeInput, PaymentAdapter } from './payment-adapter.interface';

/**
 * Gera um payload PIX "copia e cola" válido no padrão EMV QR Code (BR Code).
 * Isso é um formato público do Banco Central — não depende de nenhum PSP —
 * então o payload gerado aqui é real e escaneável. A CONFIRMAÇÃO do
 * pagamento, porém, depende de um PSP real (webhook) ou de conciliação
 * manual, já que não há credenciais de um Provedor de Serviço de Pagamento
 * configuradas neste ambiente.
 */
@Injectable()
export class PixAdapter implements PaymentAdapter {
  private readonly logger = new Logger(PixAdapter.name);

  constructor(private readonly config: ConfigService) {}

  async createCharge(input: CreateChargeInput): Promise<ChargeResult> {
    const pixKey = this.config.get<string>('payments.pixKey') ?? 'pix@autoprime.app';
    const merchantName = 'AUTOPRIME LAVA RAPIDO';
    const merchantCity = 'SAO PAULO';
    const txId =
      input.referenceId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 25) || randomUUID().slice(0, 25);

    const payload = this.buildEmvPayload({
      pixKey,
      merchantName,
      merchantCity,
      amount: input.amount,
      txId,
    });

    this.logger.log(
      `PIX copia-e-cola gerado para ${input.referenceId} (confirmação manual/PSP pendente)`,
    );

    return {
      providerRef: txId,
      status: 'PENDING',
      pixCopyPaste: payload,
      pixQrCode: payload,
    };
  }

  private buildEmvPayload(params: {
    pixKey: string;
    merchantName: string;
    merchantCity: string;
    amount: number;
    txId: string;
  }): string {
    const field = (id: string, value: string) =>
      `${id}${value.length.toString().padStart(2, '0')}${value}`;

    const merchantAccountInfo = field(
      '26',
      field('00', 'br.gov.bcb.pix') + field('01', params.pixKey),
    );

    const payloadWithoutCrc =
      field('00', '01') +
      field('01', '11') +
      merchantAccountInfo +
      field('52', '0000') +
      field('53', '986') +
      field('54', params.amount.toFixed(2)) +
      field('58', 'BR') +
      field('59', params.merchantName.slice(0, 25)) +
      field('60', params.merchantCity.slice(0, 15)) +
      field('62', field('05', params.txId)) +
      '6304';

    const crc = this.crc16(payloadWithoutCrc);
    return payloadWithoutCrc + crc;
  }

  private crc16(payload: string): string {
    let crc = 0xffff;
    for (let i = 0; i < payload.length; i++) {
      crc ^= payload.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) {
        crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
        crc &= 0xffff;
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }
}
