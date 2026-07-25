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
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@ApiTags('clients')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Roles(Role.ADMIN, Role.MANAGER, Role.EMPLOYEE)
  @Post()
  create(@CompanyId() companyId: string, @Body() dto: CreateClientDto) {
    return this.clientsService.create(companyId, dto);
  }

  @Roles(Role.ADMIN, Role.MANAGER, Role.EMPLOYEE, Role.FINANCE)
  @Get()
  findAll(@CompanyId() companyId: string, @Query('search') search?: string) {
    return this.clientsService.findAll(companyId, search);
  }

  @Roles(Role.ADMIN, Role.MANAGER, Role.EMPLOYEE, Role.FINANCE)
  @Get(':id')
  findOne(@CompanyId() companyId: string, @Param('id') id: string) {
    return this.clientsService.findOne(companyId, id);
  }

  @Roles(Role.ADMIN, Role.MANAGER, Role.EMPLOYEE)
  @Patch(':id')
  update(@CompanyId() companyId: string, @Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.clientsService.update(companyId, id, dto);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Delete(':id')
  remove(@CompanyId() companyId: string, @Param('id') id: string) {
    return this.clientsService.remove(companyId, id);
  }
}
