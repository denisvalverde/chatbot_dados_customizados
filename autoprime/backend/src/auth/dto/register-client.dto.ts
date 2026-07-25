import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterClientDto {
  @ApiProperty({
    description: 'Slug da empresa (ex.: "autoprime-demo") em que o cliente está se cadastrando',
  })
  @IsString()
  companySlug!: string;

  @ApiProperty({
    required: false,
    description: 'Slug da unidade escolhida (ex.: "suzano"). Opcional.',
  })
  @IsOptional()
  @IsString()
  branchSlug?: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false, description: 'CPF' })
  @IsOptional()
  @IsString()
  document?: string;

  @ApiProperty({ description: 'Aceite explícito dos termos LGPD' })
  @IsString()
  lgpdConsent!: string;
}
