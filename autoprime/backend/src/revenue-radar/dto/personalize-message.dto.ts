import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class PersonalizeMessageDto {
  @ApiProperty()
  @IsUUID()
  clientId!: string;

  @ApiProperty({ description: 'Rascunho gerado pelo Radar.' })
  @IsString()
  @MaxLength(2000)
  message!: string;

  @ApiProperty({
    required: false,
    type: [String],
    description: 'Fatos reais exibidos no cartão (ritmo, último serviço, horário livre).',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(300, { each: true })
  facts?: string[];
}
