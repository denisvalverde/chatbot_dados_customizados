import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CompanyId } from '../common/decorators/company-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RevenueRadarService } from './revenue-radar.service';
import { CreateOutreachDto } from './dto/create-outreach.dto';
import { PersonalizeMessageDto } from './dto/personalize-message.dto';

@ApiTags('revenue-radar')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(Role.ADMIN, Role.MANAGER, Role.EMPLOYEE)
@Controller('revenue-radar')
export class RevenueRadarController {
  constructor(private readonly radar: RevenueRadarService) {}

  /** Oportunidades priorizadas em R$, capacidade ociosa e benchmarks da empresa. */
  @Get()
  scan(@CompanyId() companyId: string) {
    return this.radar.scan(companyId);
  }

  /** Receita recuperada (atribuída a contatos do Radar) nos últimos `days` dias. */
  @Get('results')
  results(@CompanyId() companyId: string, @Query('days') days?: string) {
    const parsed = days ? parseInt(days, 10) : 30;
    const safe = Number.isFinite(parsed) ? Math.min(365, Math.max(1, parsed)) : 30;
    return this.radar.results(companyId, safe);
  }

  @Post('outreach')
  recordOutreach(
    @CompanyId() companyId: string,
    @CurrentUser('id') userId: string | undefined,
    @Body() dto: CreateOutreachDto,
  ) {
    return this.radar.recordOutreach(companyId, userId, dto);
  }

  @Post('personalize')
  personalize(@CompanyId() companyId: string, @Body() dto: PersonalizeMessageDto) {
    return this.radar.personalize(companyId, dto);
  }
}
