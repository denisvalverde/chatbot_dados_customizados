import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CompanyId } from '../common/decorators/company-id.decorator';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

@ApiTags('vehicles')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Roles(Role.ADMIN, Role.MANAGER, Role.EMPLOYEE, Role.CLIENT)
  @Post()
  create(@CompanyId() companyId: string, @Body() dto: CreateVehicleDto) {
    return this.vehiclesService.create(companyId, dto);
  }

  @Roles(Role.ADMIN, Role.MANAGER, Role.EMPLOYEE, Role.CLIENT)
  @Get()
  findByFilter(
    @CompanyId() companyId: string,
    @Query('clientId') clientId?: string,
    @Query('plate') plate?: string,
  ) {
    if (plate) return this.vehiclesService.findByPlate(companyId, plate);
    return this.vehiclesService.findAllForClient(companyId, clientId ?? '');
  }

  @Roles(Role.ADMIN, Role.MANAGER, Role.EMPLOYEE, Role.CLIENT)
  @Get(':id')
  findOne(@CompanyId() companyId: string, @Param('id') id: string) {
    return this.vehiclesService.findOne(companyId, id);
  }

  @Roles(Role.ADMIN, Role.MANAGER, Role.EMPLOYEE, Role.CLIENT)
  @Patch(':id')
  update(@CompanyId() companyId: string, @Param('id') id: string, @Body() dto: UpdateVehicleDto) {
    return this.vehiclesService.update(companyId, id, dto);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Delete(':id')
  remove(@CompanyId() companyId: string, @Param('id') id: string) {
    return this.vehiclesService.remove(companyId, id);
  }
}
