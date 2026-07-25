import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CompanyId } from '../common/decorators/company-id.decorator';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(Role.ADMIN, Role.MANAGER, Role.FINANCE)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  summary(@CompanyId() companyId: string, @Query('from') from: string, @Query('to') to: string) {
    return this.dashboardService.summary(companyId, from, to);
  }

  @Get('top-services')
  topServices(
    @CompanyId() companyId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.dashboardService.topServices(companyId, from, to);
  }

  @Get('employee-productivity')
  employeeProductivity(
    @CompanyId() companyId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.dashboardService.employeeProductivity(companyId, from, to);
  }

  @Get('peak-hours')
  peakHours(@CompanyId() companyId: string, @Query('from') from: string, @Query('to') to: string) {
    return this.dashboardService.peakHours(companyId, from, to);
  }
}
