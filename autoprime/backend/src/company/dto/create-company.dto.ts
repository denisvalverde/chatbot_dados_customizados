import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches, MinLength } from 'class-validator';

export class CreateCompanyDto {
  @ApiProperty({ description: 'Nome da empresa' })
  @IsString()
  name!: string;

  @ApiProperty({ description: 'Identificador único na URL, ex.: "lava-rapido-acme"' })
  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'O slug deve conter apenas letras minúsculas, números e hífens.',
  })
  slug!: string;

  @ApiProperty({ description: 'Nome do administrador inicial da empresa' })
  @IsString()
  adminName!: string;

  @ApiProperty({ description: 'E-mail do administrador inicial' })
  @IsEmail()
  adminEmail!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  adminPassword!: string;
}
