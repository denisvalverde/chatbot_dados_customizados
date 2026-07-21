import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { StockMovementType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateStockMovementDto } from './dto/stock-movement.dto';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  createProduct(dto: CreateProductDto) {
    return this.prisma.product.create({
      data: { ...dto, expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined },
    });
  }

  findAllProducts() {
    return this.prisma.product.findMany({ include: { supplier: true }, orderBy: { name: 'asc' } });
  }

  async findLowStock() {
    const products = await this.prisma.product.findMany({ include: { supplier: true } });
    return products.filter((p) => Number(p.quantity) <= Number(p.minQuantity));
  }

  async findOneProduct(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { supplier: true, stockMovements: { orderBy: { createdAt: 'desc' }, take: 50 } },
    });
    if (!product) throw new NotFoundException('Produto não encontrado.');
    return product;
  }

  async registerMovement(productId: string, dto: CreateStockMovementDto) {
    const product = await this.findOneProduct(productId);

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
