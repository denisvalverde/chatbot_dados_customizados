import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '@prisma/client';

const STAFF_ROLES = [
  Role.ADMIN,
  Role.MANAGER,
  Role.EMPLOYEE,
  Role.WASHER,
  Role.DETAILER,
  Role.FINANCE,
];

export class CreateStaffDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  email!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ enum: STAFF_ROLES })
  @IsEnum(Role)
  @IsIn(STAFF_ROLES)
  role!: Role;

  @ApiProperty()
  @IsString()
  position!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;
}
