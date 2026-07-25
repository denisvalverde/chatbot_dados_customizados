import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CompanyId } from '../common/decorators/company-id.decorator';
import { EmployeesService } from './employees.service';
import { CreateShiftDto } from './dto/create-shift.dto';

@ApiTags('employees')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Roles(Role.ADMIN, Role.MANAGER)
  @Get()
  findAll(@CompanyId() companyId: string) {
    return this.employeesService.findAll(companyId);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Get(':id')
  findOne(@CompanyId() companyId: string, @Param('id') id: string) {
    return this.employeesService.findOne(companyId, id);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Post(':id/shifts')
  addShift(@CompanyId() companyId: string, @Param('id') id: string, @Body() dto: CreateShiftDto) {
    return this.employeesService.addShift(companyId, id, dto);
  }

  @Roles(Role.ADMIN, Role.MANAGER, Role.EMPLOYEE, Role.WASHER, Role.DETAILER)
  @Post(':id/check-in')
  checkIn(@CompanyId() companyId: string, @Param('id') id: string) {
    return this.employeesService.checkIn(companyId, id);
  }

  @Roles(Role.ADMIN, Role.MANAGER, Role.EMPLOYEE, Role.WASHER, Role.DETAILER)
  @Post(':id/check-out')
  checkOut(@CompanyId() companyId: string, @Param('id') id: string) {
    return this.employeesService.checkOut(companyId, id);
  }

  @Roles(Role.ADMIN, Role.MANAGER, Role.FINANCE)
  @Post(':id/commission/:referenceMonth')
  commission(
    @CompanyId() companyId: string,
    @Param('id') id: string,
    @Param('referenceMonth') referenceMonth: string,
  ) {
    return this.employeesService.calculateCommission(companyId, id, referenceMonth);
  }
}
