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
import { CatalogService } from './catalog.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

const ALL_COMPANY_ROLES = [
  Role.ADMIN,
  Role.MANAGER,
  Role.EMPLOYEE,
  Role.WASHER,
  Role.DETAILER,
  Role.FINANCE,
  Role.CLIENT,
];

@ApiTags('catalog')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('services')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Roles(...ALL_COMPANY_ROLES)
  @Get()
  findAll(@CompanyId() companyId: string, @Query('all') all?: string) {
    return this.catalogService.findAll(companyId, all !== 'true');
  }

  @Roles(...ALL_COMPANY_ROLES)
  @Get(':id')
  findOne(@CompanyId() companyId: string, @Param('id') id: string) {
    return this.catalogService.findOne(companyId, id);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Post()
  create(@CompanyId() companyId: string, @Body() dto: CreateServiceDto) {
    return this.catalogService.create(companyId, dto);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Patch(':id')
  update(@CompanyId() companyId: string, @Param('id') id: string, @Body() dto: UpdateServiceDto) {
    return this.catalogService.update(companyId, id, dto);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Delete(':id')
  remove(@CompanyId() companyId: string, @Param('id') id: string) {
    return this.catalogService.deactivate(companyId, id);
  }
}
