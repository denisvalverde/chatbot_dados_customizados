import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { EmailAdapter } from './adapters/email.adapter';
import { PushAdapter } from './adapters/push.adapter';
import { WhatsappAdapter } from './adapters/whatsapp.adapter';

@Module({
  providers: [NotificationsService, EmailAdapter, PushAdapter, WhatsappAdapter],
  exports: [NotificationsService],
})
export class NotificationsModule {}
