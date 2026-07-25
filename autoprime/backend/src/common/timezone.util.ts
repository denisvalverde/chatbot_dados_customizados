import { BadRequestException } from '@nestjs/common';
import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';
import { DateTime, IANAZone } from 'luxon';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Fallback documentado apenas para empresas brasileiras sem fuso configurado
 * (ex.: linhas antigas criadas antes do campo `Company.timezone` existir).
 * Nunca usado como regra de negócio para empresas com timezone definido —
 * o servidor Railway roda em UTC e o navegador do usuário pode estar em
 * qualquer fuso; nenhum dos dois deve influenciar disponibilidade/horários.
 */
export const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

// O runtime ICU aceita offsets fixos (ex.: "-03:00") como `timeZone` válido
// para `Intl`/`IANAZone.isValidZone` — mas um offset fixo não é um fuso
// nomeado (não segue regras de horário de verão da região, e é exatamente o
// tipo de "offset hardcoded" que este projeto proíbe como configuração de
// empresa). Por isso exigimos explicitamente um identificador IANA nomeado.
const RAW_OFFSET_PATTERN = /^(UTC|GMT)?[+-]\d{1,2}(:?\d{2})?$/i;

export function isValidIanaTimezone(zone: string): boolean {
  if (!zone || RAW_OFFSET_PATTERN.test(zone.trim())) return false;
  return IANAZone.isValidZone(zone);
}

export function assertValidTimezone(zone: string): void {
  if (!isValidIanaTimezone(zone)) {
    throw new BadRequestException(
      `"${zone}" não é um fuso horário IANA válido (ex.: "America/Sao_Paulo").`,
    );
  }
}

/** Decorator class-validator para validar um fuso IANA em DTOs. */
export function IsIanaTimezone(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isIanaTimezone',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return typeof value === 'string' && isValidIanaTimezone(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} deve ser um fuso horário IANA válido (ex.: "America/Sao_Paulo").`;
        },
      },
    });
  };
}

export async function getCompanyTimezone(
  prisma: PrismaService,
  companyId: string,
): Promise<string> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { timezone: true },
  });
  return company?.timezone ?? DEFAULT_TIMEZONE;
}

/**
 * Combina uma data local ("YYYY-MM-DD") e um horário local ("HH:mm") no fuso
 * informado, retornando o instante absoluto (JS Date / UTC) correspondente.
 * Isto é o único jeito correto de interpretar "08:00 no horário da empresa"
 * — nunca faça `new Date(`${date}T${time}`)`, que usa o fuso do processo.
 */
export function zonedDateTime(dateISO: string, time: string, zone: string): Date {
  const dt = DateTime.fromISO(`${dateISO}T${time}`, { zone });
  if (!dt.isValid) {
    throw new BadRequestException(
      `Data/horário inválido: ${dateISO} ${time} (${dt.invalidReason}).`,
    );
  }
  return dt.toJSDate();
}

/** Início (00:00:00.000) do dia calendário local `dateISO` no fuso da empresa. */
export function startOfDayInZone(dateISO: string, zone: string): Date {
  const dt = DateTime.fromISO(dateISO, { zone }).startOf('day');
  if (!dt.isValid) {
    throw new BadRequestException(`Data inválida: ${dateISO} (${dt.invalidReason}).`);
  }
  return dt.toJSDate();
}

/** Fim (23:59:59.999) do dia calendário local `dateISO` no fuso da empresa. */
export function endOfDayInZone(dateISO: string, zone: string): Date {
  const dt = DateTime.fromISO(dateISO, { zone }).endOf('day');
  if (!dt.isValid) {
    throw new BadRequestException(`Data inválida: ${dateISO} (${dt.invalidReason}).`);
  }
  return dt.toJSDate();
}

/** Hora local (0-23) de um instante, no fuso da empresa — nunca `Date#getHours()`. */
export function getHourInZone(instant: Date, zone: string): number {
  return DateTime.fromJSDate(instant, { zone: 'utc' }).setZone(zone).hour;
}

/** Formata um instante no fuso da empresa, para e-mails/WhatsApp/telas. */
export function formatInZone(
  instant: Date,
  zone: string,
  format = "dd/LL/yyyy 'às' HH:mm",
): string {
  return DateTime.fromJSDate(instant, { zone: 'utc' }).setZone(zone).toFormat(format);
}

export function isPastInstant(instant: Date, reference: Date = new Date()): boolean {
  return instant.getTime() <= reference.getTime();
}
