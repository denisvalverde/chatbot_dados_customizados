import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role, ServiceOrderStatus } from '@prisma/client';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CompanyId } from '../common/decorators/company-id.decorator';
import { ServiceOrdersService } from './service-orders.service';
import { CreateServiceOrderDto } from './dto/create-service-order.dto';
import { AddPhotoDto } from './dto/add-photo.dto';

const STAFF = [Role.ADMIN, Role.MANAGER, Role.EMPLOYEE, Role.WASHER, Role.DETAILER];

@ApiTags('service-orders')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('service-orders')
export class ServiceOrdersController {
  constructor(private readonly service: ServiceOrdersService) {}

  @Roles(...STAFF)
  @Post()
  create(@CompanyId() companyId: string, @Body() dto: CreateServiceOrderDto) {
    return this.service.create(companyId, dto);
  }

  @Roles(...STAFF, Role.CLIENT, Role.FINANCE)
  @Get()
  findAll(@CompanyId() companyId: string, @Query('status') status?: ServiceOrderStatus) {
    return this.service.findAll(companyId, status);
  }

  @Roles(...STAFF, Role.CLIENT, Role.FINANCE)
  @Get(':id')
  findOne(@CompanyId() companyId: string, @Param('id') id: string) {
    return this.service.findOne(companyId, id);
  }

  @Roles(...STAFF)
  @Patch(':id/start')
  start(@CompanyId() companyId: string, @Param('id') id: string) {
    return this.service.start(companyId, id);
  }

  @Roles(...STAFF)
  @Patch(':id/checklist/:itemId')
  toggleChecklist(
    @CompanyId() companyId: string,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body('checked') checked: boolean,
  ) {
    return this.service.toggleChecklistItem(companyId, id, itemId, checked);
  }

  @Roles(...STAFF)
  @Post(':id/photos')
  addPhoto(@CompanyId() companyId: string, @Param('id') id: string, @Body() dto: AddPhotoDto) {
    return this.service.addPhoto(companyId, id, dto);
  }

  @Roles(...STAFF)
  @Patch(':id/complete')
  complete(@CompanyId() companyId: string, @Param('id') id: string) {
    return this.service.complete(companyId, id);
  }

  @Roles(...STAFF)
  @Patch(':id/deliver')
  deliver(
    @CompanyId() companyId: string,
    @Param('id') id: string,
    @Body('signatureUrl') signatureUrl?: string,
  ) {
    return this.service.deliver(companyId, id, signatureUrl);
  }
}
