import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateServiceDto) {
    const { checklist, products, ...rest } = dto;
    return this.prisma.service.create({
      data: {
        ...rest,
        checklistItems: checklist
          ? { create: checklist.map((label, order) => ({ label, order })) }
          : undefined,
        productsUsed: products
          ? { create: products.map((p) => ({ productId: p.productId, quantity: p.quantity })) }
          : undefined,
      },
      include: { checklistItems: true, productsUsed: { include: { product: true } } },
    });
  }

  findAll(onlyActive = true) {
    return this.prisma.service.findMany({
      where: onlyActive ? { active: true } : undefined,
      include: { checklistItems: true, productsUsed: { include: { product: true } } },
      orderBy: { category: 'asc' },
    });
  }

  async findOne(id: string) {
    const service = await this.prisma.service.findUnique({
      where: { id },
      include: { checklistItems: true, productsUsed: { include: { product: true } } },
    });
    if (!service) throw new NotFoundException('Serviço não encontrado.');
    return service;
  }

  async update(id: string, dto: UpdateServiceDto) {
    await this.findOne(id);
    const { checklist, products, ...rest } = dto;

    return this.prisma.$transaction(async (tx) => {
      if (checklist) {
        await tx.serviceChecklistTemplate.deleteMany({ where: { serviceId: id } });
      }
      if (products) {
        await tx.serviceProduct.deleteMany({ where: { serviceId: id } });
      }

      return tx.service.update({
        where: { id },
        data: {
          ...rest,
          checklistItems: checklist
            ? { create: checklist.map((label, order) => ({ label, order })) }
            : undefined,
          productsUsed: products
            ? { create: products.map((p) => ({ productId: p.productId, quantity: p.quantity })) }
            : undefined,
        },
        include: { checklistItems: true, productsUsed: { include: { product: true } } },
      });
    });
  }

  async deactivate(id: string) {
    await this.findOne(id);
    return this.prisma.service.update({ where: { id }, data: { active: false } });
  }
}
