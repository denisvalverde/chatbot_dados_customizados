import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

/**
 * Adapter de e-mail real via SMTP (nodemailer). Se nenhuma credencial SMTP
 * estiver configurada, cai em modo "dry-run" e apenas loga o envio —
 * assim o restante do sistema funciona em dev sem depender de um provedor.
 */
@Injectable()
export class EmailAdapter {
  private readonly logger = new Logger(EmailAdapter.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('smtp.host');
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: this.config.get<number>('smtp.port'),
        auth: {
          user: this.config.get<string>('smtp.user'),
          pass: this.config.get<string>('smtp.pass'),
        },
      });
    }
  }

  async send(input: SendEmailInput): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(`[dry-run] SMTP não configurado. E-mail para ${input.to}: ${input.subject}`);
      return;
    }

    await this.transporter.sendMail({
      from: this.config.get<string>('smtp.from'),
      to: input.to,
      subject: input.subject,
      html: input.html,
    });
  }
}
