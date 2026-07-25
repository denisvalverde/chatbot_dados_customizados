import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export const MESSAGE_KINDS = [
  'appointment_reminder',
  'promo',
  'reactivation',
  'thank_you',
  'reply_suggestion',
] as const;
export type MessageKind = (typeof MESSAGE_KINDS)[number];

export class GenerateMessageDto {
  @ApiProperty({ enum: MESSAGE_KINDS })
  @IsIn(MESSAGE_KINDS)
  kind!: MessageKind;

  @ApiProperty({ description: 'Nome do cliente' })
  @IsString()
  clientName!: string;

  @ApiProperty({
    required: false,
    description: 'Contexto adicional livre (ex.: pergunta do cliente)',
  })
  @IsOptional()
  @IsString()
  context?: string;
}
