import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { AppointmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GenerateMessageDto } from './dto/generate-message.dto';
import {
  endOfDayInZone,
  getCompanyTimezone,
  isPastInstant,
  startOfDayInZone,
  zonedDateTime,
} from '../common/timezone.util';

const BUSINESS_HOURS = { start: '08:00', end: '18:00' };
const SLOT_STEP_MINUTES = 30;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly anthropic: Anthropic | null;
  private readonly model: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const apiKey = this.config.get<string>('ai.anthropicApiKey');
    this.anthropic = apiKey ? new Anthropic({ apiKey }) : null;
    this.model = this.config.get<string>('ai.model') ?? 'claude-sonnet-5-5';
  }

  /**
   * Sugere horários livres em um dia, considerando os agendamentos já
   * existentes e a duração do serviço desejado. Lógica determinística — não
   * depende de LLM. Esta função é a ÚNICA fonte de verdade de disponibilidade:
   * qualquer sugestão apresentada ao cliente (inclusive por um agente de IA)
   * deve vir exclusivamente daqui, nunca ser inventada ou recalculada em
   * outra camada. Mesmo assim, `SchedulingService.create` revalida o slot no
   * momento da confirmação — uma sugestão obtida segundos atrás não garante
   * que o horário continue livre.
   *
   * "08:00"/"18:00" são interpretados como horário LOCAL da empresa, no fuso
   * IANA configurado em `Company.timezone` — nunca no fuso do processo
   * Node (que no Railway é UTC e localmente pode ser qualquer um).
   */
  async suggestSlots(companyId: string, date: string, durationMinutes: number) {
    const timezone = await getCompanyTimezone(this.prisma, companyId);
    const dayStart = startOfDayInZone(date, timezone);
    const dayEnd = endOfDayInZone(date, timezone);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        companyId,
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
    const businessStart = zonedDateTime(date, BUSINESS_HOURS.start, timezone);
    const businessEnd = zonedDateTime(date, BUSINESS_HOURS.end, timezone);
    const now = new Date();

    for (
      let cursor = new Date(businessStart);
      cursor.getTime() + durationMinutes * 60_000 <= businessEnd.getTime();
      cursor = new Date(cursor.getTime() + SLOT_STEP_MINUTES * 60_000)
    ) {
      if (isPastInstant(cursor, now)) continue;

      const slotEnd = new Date(cursor.getTime() + durationMinutes * 60_000);
      const conflicts = appointments.some((a) => cursor < a.endAt && slotEnd > a.startAt);
      if (!conflicts) {
        slots.push({ startAt: cursor.toISOString(), endAt: slotEnd.toISOString() });
      }
    }

    return { date, timezone, durationMinutes, availableSlots: slots };
  }

  /**
   * Clientes VIP: maior gasto acumulado e maior frequência de visitas.
   */
  async identifyVipClients(companyId: string, limit = 10) {
    const clients = await this.prisma.client.findMany({
      where: { companyId },
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
  async identifyInactiveClients(companyId: string, sinceDays = 60) {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - sinceDays);

    const clients = await this.prisma.client.findMany({
      where: { companyId },
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
          model: this.model,
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

  /**
   * Reescreve uma mensagem do Radar de Receita para soar humana, usando APENAS
   * os fatos fornecidos. Regras duras no prompt: não inventar desconto, preço,
   * brinde nem horário; manter o horário oferecido exatamente como está. Sem
   * ANTHROPIC_API_KEY (ou em falha), devolve o rascunho determinístico.
   */
  async personalizeOutreach(input: {
    companyName: string;
    clientName: string;
    draft: string;
    facts: string[];
  }): Promise<{ message: string; generatedBy: 'claude' | 'template' }> {
    if (!this.anthropic) return { message: input.draft, generatedBy: 'template' };
    try {
      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 400,
        system:
          `Você escreve mensagens de WhatsApp para ${input.companyName}, um lava-rápido / estética automotiva no Brasil. ` +
          'Português do Brasil, tom caloroso e direto, como um atendente que conhece o cliente. ' +
          'Máximo 3 frases curtas, no máximo 1 emoji. ' +
          'REGRAS: use somente os fatos fornecidos; NÃO invente descontos, preços, brindes, prazos ou horários; ' +
          'se o rascunho oferece um horário, mantenha-o exatamente igual; termine com uma pergunta simples de sim/não. ' +
          'Responda apenas com o texto final da mensagem.',
        messages: [
          {
            role: 'user',
            content:
              `Cliente: ${input.clientName}\n` +
              `Fatos:\n${input.facts.map((f) => `- ${f}`).join('\n') || '- (nenhum fato extra)'}\n\n` +
              `Rascunho:\n${input.draft}`,
          },
        ],
      });
      const text = response.content.find((b) => b.type === 'text');
      if (text && text.type === 'text' && text.text.trim()) {
        return { message: text.text.trim(), generatedBy: 'claude' };
      }
    } catch (error) {
      this.logger.warn(
        `Falha ao personalizar com IA, usando rascunho. Motivo: ${(error as Error).message}`,
      );
    }
    return { message: input.draft, generatedBy: 'template' };
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
