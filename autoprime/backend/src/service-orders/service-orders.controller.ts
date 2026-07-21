import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role, ServiceOrderStatus } from '@prisma/client';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
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
  create(@Body() dto: CreateServiceOrderDto) {
    return this.service.create(dto);
  }

  @Roles(...STAFF, Role.CLIENT, Role.FINANCE)
  @Get()
  findAll(@Query('status') status?: ServiceOrderStatus) {
    return this.service.findAll(status);
  }

  @Roles(...STAFF, Role.CLIENT, Role.FINANCE)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Roles(...STAFF)
  @Patch(':id/start')
  start(@Param('id') id: string) {
    return this.service.start(id);
  }

  @Roles(...STAFF)
  @Patch(':id/checklist/:itemId')
  toggleChecklist(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body('checked') checked: boolean,
  ) {
    return this.service.toggleChecklistItem(id, itemId, checked);
  }

  @Roles(...STAFF)
  @Post(':id/photos')
  addPhoto(@Param('id') id: string, @Body() dto: AddPhotoDto) {
    return this.service.addPhoto(id, dto);
  }

  @Roles(...STAFF)
  @Patch(':id/complete')
  complete(@Param('id') id: string) {
    return this.service.complete(id);
  }

  @Roles(...STAFF)
  @Patch(':id/deliver')
  deliver(@Param('id') id: string, @Body('signatureUrl') signatureUrl?: string) {
    return this.service.deliver(id, signatureUrl);
  }
}
