import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { StockMovementType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateStockMovementDto } from './dto/stock-movement.dto';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  createProduct(companyId: string, dto: CreateProductDto) {
    return this.prisma.product.create({
      data: { ...dto, companyId, expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined },
    });
  }

  findAllProducts(companyId: string) {
    return this.prisma.product.findMany({
      where: { companyId },
      include: { supplier: true },
      orderBy: { name: 'asc' },
    });
  }

  async findLowStock(companyId: string) {
    const products = await this.prisma.product.findMany({
      where: { companyId },
      include: { supplier: true },
    });
    return products.filter((p) => Number(p.quantity) <= Number(p.minQuantity));
  }

  async findOneProduct(companyId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, companyId },
      include: { supplier: true, stockMovements: { orderBy: { createdAt: 'desc' }, take: 50 } },
    });
    if (!product) throw new NotFoundException('Produto não encontrado.');
    return product;
  }

  async registerMovement(companyId: string, productId: string, dto: CreateStockMovementDto) {
    const product = await this.findOneProduct(companyId, productId);

    const delta = dto.type === StockMovementType.OUT ? -dto.quantity : dto.quantity;

    const newQuantity = Number(product.quantity) + delta;
    if (newQuantity < 0) {
      throw new BadRequestException('Estoque insuficiente para esta saída.');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.product.update({ where: { id: productId }, data: { quantity: newQuantity } });
      return tx.stockMovement.create({
        data: { productId, type: dto.type, quantity: dto.quantity, reason: dto.reason },
      });
    });
  }
}
