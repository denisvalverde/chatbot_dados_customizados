import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SendWhatsappInput {
  phone: string;
  templateName: string;
  variables: Record<string, string>;
}

/**
 * Adapter para a WhatsApp Business Cloud API (Meta). Sem WHATSAPP_TOKEN,
 * roda em modo mock. Quando configurado, faz a chamada real via fetch para
 * graph.facebook.com — sem dependências extras.
 */
@Injectable()
export class WhatsappAdapter {
  private readonly logger = new Logger(WhatsappAdapter.name);

  constructor(private readonly config: ConfigService) {}

  async send(input: SendWhatsappInput): Promise<{ mocked: boolean }> {
    const token = this.config.get<string>('whatsapp.token');
    const phoneId = this.config.get<string>('whatsapp.phoneId');

    if (!token || !phoneId) {
      this.logger.warn(
        `[mock] WhatsApp para ${input.phone}: template=${input.templateName} vars=${JSON.stringify(input.variables)}`,
      );
      return { mocked: true };
    }

    await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: input.phone,
        type: 'template',
        template: {
          name: input.templateName,
          language: { code: 'pt_BR' },
          components: [
            {
              type: 'body',
              parameters: Object.values(input.variables).map((text) => ({ type: 'text', text })),
            },
          ],
        },
      }),
    });

    return { mocked: false };
  }
}
