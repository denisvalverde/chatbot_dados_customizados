import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CompanyId } from '../common/decorators/company-id.decorator';
import { AiService } from './ai.service';
import { GenerateMessageDto } from './dto/generate-message.dto';

const STAFF = [Role.ADMIN, Role.MANAGER, Role.EMPLOYEE];

@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(...STAFF)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('suggest-slots')
  suggestSlots(
    @CompanyId() companyId: string,
    @Query('date') date: string,
    @Query('durationMinutes') durationMinutes: string,
  ) {
    return this.aiService.suggestSlots(companyId, date, parseInt(durationMinutes, 10));
  }

  @Get('vip-clients')
  vipClients(@CompanyId() companyId: string, @Query('limit') limit?: string) {
    return this.aiService.identifyVipClients(companyId, limit ? parseInt(limit, 10) : undefined);
  }

  @Get('inactive-clients')
  inactiveClients(@CompanyId() companyId: string, @Query('sinceDays') sinceDays?: string) {
    return this.aiService.identifyInactiveClients(
      companyId,
      sinceDays ? parseInt(sinceDays, 10) : undefined,
    );
  }

  @Post('generate-message')
  generateMessage(@Body() dto: GenerateMessageDto) {
    return this.aiService.generateMessage(dto);
  }
}
