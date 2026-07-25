import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailAdapter } from './adapters/email.adapter';
import { PushAdapter } from './adapters/push.adapter';
import { WhatsappAdapter } from './adapters/whatsapp.adapter';

describe('NotificationsService', () => {
  function makeService() {
    const prisma = {
      notification: {
        create: jest.fn().mockResolvedValue({ id: 'n1' }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const email = { send: jest.fn().mockResolvedValue(undefined) };
    const push = { send: jest.fn().mockResolvedValue(undefined) };
    const whatsapp = { send: jest.fn().mockResolvedValue(undefined) };

    const service = new NotificationsService(
      prisma as unknown as PrismaService,
      email as unknown as EmailAdapter,
      push as unknown as PushAdapter,
      whatsapp as unknown as WhatsappAdapter,
    );

    return { service, prisma, email, push, whatsapp };
  }

  it('formata a confirmação de agendamento no fuso da empresa, não no fuso do servidor', async () => {
    const { service, email } = makeService();
    // 23:30 em São Paulo (UTC-3) — se formatado sem timeZone explícito no
    // fuso do processo (UTC no Railway), apareceria como "02:30" do dia
    // seguinte para o cliente.
    const when = new Date('2026-07-26T02:30:00.000Z');

    await service.sendAppointmentConfirmation('u1', 'cliente@teste.com', when, 'America/Sao_Paulo');

    expect(email.send).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining('25/07/2026 às 23:30'),
      }),
    );
  });

  it('usa o fallback documentado (America/Sao_Paulo) quando nenhum fuso é informado', async () => {
    const { service, email } = makeService();
    const when = new Date('2026-07-25T11:00:00.000Z'); // 08:00 em America/Sao_Paulo

    await service.sendAppointmentConfirmation('u1', 'cliente@teste.com', when);

    expect(email.send).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining('25/07/2026 às 08:00'),
      }),
    );
  });
});
