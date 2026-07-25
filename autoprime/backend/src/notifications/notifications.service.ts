import { Injectable } from '@nestjs/common';
import { NotificationChannel, NotificationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailAdapter } from './adapters/email.adapter';
import { PushAdapter } from './adapters/push.adapter';
import { WhatsappAdapter } from './adapters/whatsapp.adapter';
import { DEFAULT_TIMEZONE, formatInZone } from '../common/timezone.util';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailAdapter,
    private readonly push: PushAdapter,
    private readonly whatsapp: WhatsappAdapter,
  ) {}

  async sendWelcomeEmail(to: string, name: string) {
    await this.email.send({
      to,
      subject: 'Bem-vindo(a) ao AutoPrime',
      html: `<p>Olá ${name}, seja bem-vindo(a) ao AutoPrime! Sua conta foi criada com sucesso.</p>`,
    });
  }

  async sendPasswordResetEmail(to: string, resetToken: string) {
    await this.email.send({
      to,
      subject: 'Redefinição de senha — AutoPrime',
      html: `<p>Use o código a seguir para redefinir sua senha: <strong>${resetToken}</strong></p>`,
    });
  }

  async sendAppointmentConfirmation(
    userId: string,
    to: string,
    when: Date,
    timezone: string = DEFAULT_TIMEZONE,
  ) {
    // Formata no fuso da empresa — nunca no fuso do servidor
    // (`Date#toLocaleString` sem `timeZone` explícito usa o fuso do processo).
    const formatted = formatInZone(when, timezone);
    await this.logAndSend(userId, NotificationChannel.EMAIL, 'Agendamento confirmado', async () => {
      await this.email.send({
        to,
        subject: 'Agendamento confirmado — AutoPrime',
        html: `<p>Seu agendamento foi confirmado para ${formatted}.</p>`,
      });
    });
  }

  async sendAppointmentReminderWhatsapp(
    userId: string,
    phone: string,
    when: Date,
    timezone: string = DEFAULT_TIMEZONE,
  ) {
    const formatted = formatInZone(when, timezone);
    await this.logAndSend(
      userId,
      NotificationChannel.WHATSAPP,
      'Lembrete de agendamento',
      async () => {
        await this.whatsapp.send({
          phone,
          templateName: 'appointment_reminder',
          variables: { '1': formatted },
        });
      },
    );
  }

  async sendPush(userId: string, deviceToken: string, title: string, body: string) {
    await this.logAndSend(userId, NotificationChannel.PUSH, title, async () => {
      await this.push.send({ deviceToken, title, body });
    });
  }

  private async logAndSend(
    userId: string,
    channel: NotificationChannel,
    title: string,
    action: () => Promise<void>,
  ) {
    const record = await this.prisma.notification.create({
      data: { userId, channel, title, body: title, status: NotificationStatus.QUEUED },
    });

    try {
      await action();
      await this.prisma.notification.update({
        where: { id: record.id },
        data: { status: NotificationStatus.SENT, sentAt: new Date() },
      });
    } catch (error) {
      await this.prisma.notification.update({
        where: { id: record.id },
        data: { status: NotificationStatus.FAILED },
      });
      throw error;
    }
  }
}
