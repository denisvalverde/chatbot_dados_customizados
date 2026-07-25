import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CompanyId } from '../common/decorators/company-id.decorator';
import { InventoryService } from './inventory.service';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateStockMovementDto } from './dto/stock-movement.dto';

const INVENTORY_ROLES = [Role.ADMIN, Role.MANAGER, Role.EMPLOYEE];

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(...INVENTORY_ROLES)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('products')
  createProduct(@CompanyId() companyId: string, @Body() dto: CreateProductDto) {
    return this.inventoryService.createProduct(companyId, dto);
  }

  @Get('products')
  findAll(@CompanyId() companyId: string) {
    return this.inventoryService.findAllProducts(companyId);
  }

  @Get('products/low-stock')
  lowStock(@CompanyId() companyId: string) {
    return this.inventoryService.findLowStock(companyId);
  }

  @Get('products/:id')
  findOne(@CompanyId() companyId: string, @Param('id') id: string) {
    return this.inventoryService.findOneProduct(companyId, id);
  }

  @Post('products/:id/movements')
  registerMovement(
    @CompanyId() companyId: string,
    @Param('id') id: string,
    @Body() dto: CreateStockMovementDto,
  ) {
    return this.inventoryService.registerMovement(companyId, id, dto);
  }
}
