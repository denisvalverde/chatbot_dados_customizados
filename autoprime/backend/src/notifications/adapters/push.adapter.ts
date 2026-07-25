import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SendPushInput {
  deviceToken: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Adapter de push (Firebase Cloud Messaging). Sem FIREBASE_SERVER_KEY,
 * roda em modo mock — registra a intenção de envio sem chamar a API real.
 * Estrutura pronta para plugar o SDK oficial (firebase-admin) quando a
 * credencial estiver disponível.
 */
@Injectable()
export class PushAdapter {
  private readonly logger = new Logger(PushAdapter.name);

  constructor(private readonly config: ConfigService) {}

  async send(input: SendPushInput): Promise<{ mocked: boolean }> {
    const serverKey = this.config.get<string>('firebase.serverKey');
    if (!serverKey) {
      this.logger.warn(`[mock] Push para ${input.deviceToken}: ${input.title} — ${input.body}`);
      return { mocked: true };
    }

    // TODO(fase 2): integrar firebase-admin com credenciais reais.
    this.logger.log(`Push enviado para ${input.deviceToken}`);
    return { mocked: false };
  }
}
