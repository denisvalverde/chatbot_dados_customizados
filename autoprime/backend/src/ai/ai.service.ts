import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { AppointmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GenerateMessageDto } from './dto/generate-message.dto';

const BUSINESS_HOURS = { start: 8, end: 18 }; // 08:00 às 18:00
const SLOT_STEP_MINUTES = 30;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly anthropic: Anthropic | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const apiKey = this.config.get<string>('ai.anthropicApiKey');
    this.anthropic = apiKey ? new Anthropic({ apiKey }) : null;
  }

  /**
   * Sugere horários livres em um dia, considerando os agendamentos já
   * existentes e a duração do serviço desejado. Lógica determinística —
   * não depende de LLM.
   */
  async suggestSlots(date: string, durationMinutes: number) {
    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd = new Date(`${date}T23:59:59`);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        startAt: { gte: dayStart, lte: dayEnd },
        status: {
          in: [
            AppointmentStatus.PENDING,
            AppointmentStatus.CONFIRMED,
            AppointmentStatus.IN_PROGRESS,
          ],
        },
      },
      orderBy: { startAt: 'asc' },
    });

    const slots: { startAt: string; endAt: string }[] = [];
    const businessStart = new Date(
      `${date}T${String(BUSINESS_HOURS.start).padStart(2, '0')}:00:00`,
    );
    const businessEnd = new Date(`${date}T${String(BUSINESS_HOURS.end).padStart(2, '0')}:00:00`);

    for (
      let cursor = new Date(businessStart);
      cursor.getTime() + durationMinutes * 60_000 <= businessEnd.getTime();
      cursor = new Date(cursor.getTime() + SLOT_STEP_MINUTES * 60_000)
    ) {
      const slotEnd = new Date(cursor.getTime() + durationMinutes * 60_000);
      const conflicts = appointments.some((a) => cursor < a.endAt && slotEnd > a.startAt);
      if (!conflicts) {
        slots.push({ startAt: cursor.toISOString(), endAt: slotEnd.toISOString() });
      }
    }

    return { date, durationMinutes, availableSlots: slots };
  }

  /**
   * Clientes VIP: maior gasto acumulado e maior frequência de visitas.
   */
  async identifyVipClients(limit = 10) {
    const clients = await this.prisma.client.findMany({
      include: {
        user: true,
        serviceOrders: { where: { status: 'COMPLETED' }, include: { items: true } },
      },
    });

    return clients
      .map((c) => ({
        clientId: c.id,
        name: c.user.name,
        visits: c.serviceOrders.length,
        totalSpent: c.serviceOrders.reduce(
          (sum, o) => sum + o.items.reduce((s, i) => s + Number(i.price), 0),
          0,
        ),
      }))
      .filter((c) => c.visits > 0)
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, limit);
  }

  /**
   * Clientes inativos: sem agendamento nos últimos `sinceDays` dias.
   */
  async identifyInactiveClients(sinceDays = 60) {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - sinceDays);

    const clients = await this.prisma.client.findMany({
      include: { user: true, appointments: { orderBy: { startAt: 'desc' }, take: 1 } },
    });

    return clients
      .filter((c) => c.appointments.length > 0 && c.appointments[0].startAt < threshold)
      .map((c) => ({
        clientId: c.id,
        name: c.user.name,
        email: c.user.email,
        lastVisit: c.appointments[0].startAt,
      }));
  }

  /**
   * Gera mensagens de comunicação (lembrete, promoção, reativação, etc).
   * Usa Claude quando ANTHROPIC_API_KEY está configurada; caso contrário,
   * usa templates determinísticos para que a funcionalidade nunca fique
   * indisponível.
   */
  async generateMessage(
    dto: GenerateMessageDto,
  ): Promise<{ message: string; generatedBy: 'claude' | 'template' }> {
    if (this.anthropic) {
      try {
        const prompt = this.buildPrompt(dto);
        const response = await this.anthropic.messages.create({
          model: 'claude-sonnet-4-5',
          max_tokens: 300,
          messages: [{ role: 'user', content: prompt }],
        });
        const text = response.content.find((b) => b.type === 'text');
        if (text && text.type === 'text') {
          return { message: text.text.trim(), generatedBy: 'claude' };
        }
      } catch (error) {
        this.logger.warn(
          `Falha ao chamar Anthropic, usando template. Motivo: ${(error as Error).message}`,
        );
      }
    }

    return { message: this.templateMessage(dto), generatedBy: 'template' };
  }

  private buildPrompt(dto: GenerateMessageDto): string {
    const intents: Record<string, string> = {
      appointment_reminder: 'lembrete amigável de agendamento confirmado',
      promo: 'mensagem promocional de um serviço de lava-rápido',
      reactivation: 'mensagem para reativar um cliente que não vem há tempos',
      thank_you: 'mensagem de agradecimento após o atendimento',
      reply_suggestion: 'uma resposta educada para a mensagem do cliente',
    };

    return `Você é o atendimento do AutoPrime, um lava-rápido e estética automotiva premium.
Escreva uma ${intents[dto.kind]} para o cliente "${dto.clientName}", em português do Brasil,
tom cordial e profissional, no máximo 3 frases.
${dto.context ? `Contexto adicional: ${dto.context}` : ''}`;
  }

  private templateMessage(dto: GenerateMessageDto): string {
    switch (dto.kind) {
      case 'appointment_reminder':
        return `Olá ${dto.clientName}! Passando para confirmar seu horário no AutoPrime. Até breve!`;
      case 'promo':
        return `${dto.clientName}, temos uma condição especial esta semana no AutoPrime. Que tal agendar seu próximo serviço?`;
      case 'reactivation':
        return `Sentimos sua falta, ${dto.clientName}! Faz tempo que você não aparece no AutoPrime — vamos cuidar do seu carro novamente?`;
      case 'thank_you':
        return `Obrigado por escolher o AutoPrime, ${dto.clientName}! Esperamos que tenha gostado do serviço.`;
      case 'reply_suggestion':
      default:
        return `Olá ${dto.clientName}, obrigado pelo contato! Em breve um de nossos atendentes vai te responder.`;
    }
  }
}
