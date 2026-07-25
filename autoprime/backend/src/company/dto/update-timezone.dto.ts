import { ApiProperty } from '@nestjs/swagger';
import { IsIanaTimezone } from '../../common/timezone.util';

export class UpdateTimezoneDto {
  @ApiProperty({ description: 'Fuso IANA da empresa, ex.: "America/Sao_Paulo".' })
  @IsIanaTimezone()
  timezone!: string;
}
