import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateShiftDto {
  @ApiProperty({ minimum: 0, maximum: 6, description: '0=Domingo .. 6=Sábado' })
  @IsInt()
  @Min(0)
  @Max(6)
  weekday!: number;

  @ApiProperty({ example: '08:00' })
  @IsString()
  startTime!: string;

  @ApiProperty({ example: '18:00' })
  @IsString()
  endTime!: string;

  @ApiProperty({ required: false, example: '12:00' })
  @IsOptional()
  @IsString()
  breakStart?: string;

  @ApiProperty({ required: false, example: '13:00' })
  @IsOptional()
  @IsString()
  breakEnd?: string;
}
