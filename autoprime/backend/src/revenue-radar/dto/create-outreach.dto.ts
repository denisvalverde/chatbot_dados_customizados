import { ApiProperty } from '@nestjs/swagger';
import { NotificationChannel, OpportunityKind } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateOutreachDto {
  @ApiProperty()
  @IsUUID()
  clientId!: string;

  @ApiProperty({ enum: OpportunityKind })
  @IsEnum(OpportunityKind)
  kind!: OpportunityKind;

  @ApiProperty({ description: 'Mensagem efetivamente enviada (pode ter sido editada).' })
  @IsString()
  @MaxLength(2000)
  message!: string;

  @ApiProperty({ description: 'Valor potencial estimado pelo Radar no momento do contato (R$).' })
  @IsNumber()
  @Min(0)
  estimatedValue!: number;

  @ApiProperty({ enum: NotificationChannel, required: false, default: 'WHATSAPP' })
  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;
}
