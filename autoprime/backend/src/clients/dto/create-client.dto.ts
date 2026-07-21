import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateClientDto {
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

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  document?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  rg?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  addressStreet?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  addressNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  addressCity?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  addressState?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  addressZip?: string;
}
