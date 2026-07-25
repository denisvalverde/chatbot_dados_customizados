import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AppointmentStatus, Role } from '@prisma/client';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CompanyId } from '../common/decorators/company-id.decorator';
import { SchedulingService } from './scheduling.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto';

@ApiTags('scheduling')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('appointments')
export class SchedulingController {
  constructor(private readonly schedulingService: SchedulingService) {}

  @Roles(Role.ADMIN, Role.MANAGER, Role.EMPLOYEE, Role.CLIENT)
  @Post()
  create(@CompanyId() companyId: string, @Body() dto: CreateAppointmentDto) {
    return this.schedulingService.create(companyId, dto);
  }

  @Roles(Role.ADMIN, Role.MANAGER, Role.EMPLOYEE, Role.WASHER, Role.DETAILER, Role.CLIENT)
  @Get()
  agenda(@CompanyId() companyId: string, @Query('from') from: string, @Query('to') to: string) {
    return this.schedulingService.findAgenda(companyId, from, to);
  }

  @Roles(Role.ADMIN, Role.MANAGER, Role.EMPLOYEE, Role.WASHER, Role.DETAILER, Role.CLIENT)
  @Get(':id')
  findOne(@CompanyId() companyId: string, @Param('id') id: string) {
    return this.schedulingService.findOne(companyId, id);
  }

  @Roles(Role.ADMIN, Role.MANAGER, Role.EMPLOYEE, Role.CLIENT)
  @Patch(':id/reschedule')
  reschedule(
    @CompanyId() companyId: string,
    @Param('id') id: string,
    @Body() dto: RescheduleAppointmentDto,
  ) {
    return this.schedulingService.reschedule(companyId, id, dto);
  }

  @Roles(Role.ADMIN, Role.MANAGER, Role.EMPLOYEE, Role.CLIENT)
  @Patch(':id/cancel')
  cancel(
    @CompanyId() companyId: string,
    @Param('id') id: string,
    @Body() dto: CancelAppointmentDto,
  ) {
    return this.schedulingService.cancel(companyId, id, dto.reason);
  }

  @Roles(Role.ADMIN, Role.MANAGER, Role.EMPLOYEE, Role.WASHER, Role.DETAILER)
  @Patch(':id/status/:status')
  updateStatus(
    @CompanyId() companyId: string,
    @Param('id') id: string,
    @Param('status') status: AppointmentStatus,
  ) {
    return this.schedulingService.updateStatus(companyId, id, status);
  }
}
