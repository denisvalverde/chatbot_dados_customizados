import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Public } from '../common/decorators/public.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CompanyId } from '../common/decorators/company-id.decorator';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

const STAFF = [Role.ADMIN, Role.MANAGER];

@ApiTags('branches')
@Controller()
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Public()
  @Get('companies/:slug/branches')
  findPublicByCompany(@Param('slug') slug: string) {
    return this.branchesService.findPublicByCompanySlug(slug);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(...STAFF)
  @Post('branches')
  create(@CompanyId() companyId: string, @Body() dto: CreateBranchDto) {
    return this.branchesService.create(companyId, dto);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(...STAFF)
  @Get('branches')
  findAll(@CompanyId() companyId: string) {
    return this.branchesService.findAll(companyId);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(...STAFF)
  @Get('branches/:id')
  findOne(@CompanyId() companyId: string, @Param('id') id: string) {
    return this.branchesService.findOne(companyId, id);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(...STAFF)
  @Patch('branches/:id')
  update(@CompanyId() companyId: string, @Param('id') id: string, @Body() dto: UpdateBranchDto) {
    return this.branchesService.update(companyId, id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(...STAFF)
  @Patch('branches/:id/publish')
  publish(@CompanyId() companyId: string, @Param('id') id: string) {
    return this.branchesService.publish(companyId, id);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(...STAFF)
  @Patch('branches/:id/unpublish')
  unpublish(@CompanyId() companyId: string, @Param('id') id: string) {
    return this.branchesService.unpublish(companyId, id);
  }
}
