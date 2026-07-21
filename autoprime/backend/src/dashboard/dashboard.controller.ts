import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(Role.ADMIN, Role.MANAGER, Role.FINANCE)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  summary(@Query('from') from: string, @Query('to') to: string) {
    return this.dashboardService.summary(from, to);
  }

  @Get('top-services')
  topServices(@Query('from') from: string, @Query('to') to: string) {
    return this.dashboardService.topServices(from, to);
  }

  @Get('employee-productivity')
  employeeProductivity(@Query('from') from: string, @Query('to') to: string) {
    return this.dashboardService.employeeProductivity(from, to);
  }

  @Get('peak-hours')
  peakHours(@Query('from') from: string, @Query('to') to: string) {
    return this.dashboardService.peakHours(from, to);
  }
}
