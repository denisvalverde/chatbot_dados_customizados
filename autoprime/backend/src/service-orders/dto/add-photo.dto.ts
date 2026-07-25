import { ApiProperty } from '@nestjs/swagger';
import { PhotoStage } from '@prisma/client';
import { IsEnum, IsString } from 'class-validator';

export class AddPhotoDto {
  @ApiProperty({ enum: PhotoStage })
  @IsEnum(PhotoStage)
  stage!: PhotoStage;

  @ApiProperty()
  @IsString()
  url!: string;
}
