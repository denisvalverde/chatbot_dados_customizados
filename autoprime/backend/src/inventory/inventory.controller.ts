import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
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
  createProduct(@Body() dto: CreateProductDto) {
    return this.inventoryService.createProduct(dto);
  }

  @Get('products')
  findAll() {
    return this.inventoryService.findAllProducts();
  }

  @Get('products/low-stock')
  lowStock() {
    return this.inventoryService.findLowStock();
  }

  @Get('products/:id')
  findOne(@Param('id') id: string) {
    return this.inventoryService.findOneProduct(id);
  }

  @Post('products/:id/movements')
  registerMovement(@Param('id') id: string, @Body() dto: CreateStockMovementDto) {
    return this.inventoryService.registerMovement(id, dto);
  }
}
