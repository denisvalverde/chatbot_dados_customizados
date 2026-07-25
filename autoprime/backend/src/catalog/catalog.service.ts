import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  create(companyId: string, dto: CreateServiceDto) {
    const { checklist, products, ...rest } = dto;
    return this.prisma.service.create({
      data: {
        ...rest,
        companyId,
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

  findAll(companyId: string, onlyActive = true) {
    return this.prisma.service.findMany({
      where: { companyId, ...(onlyActive ? { active: true } : {}) },
      include: { checklistItems: true, productsUsed: { include: { product: true } } },
      orderBy: { category: 'asc' },
    });
  }

  async findOne(companyId: string, id: string) {
    const service = await this.prisma.service.findFirst({
      where: { id, companyId },
      include: { checklistItems: true, productsUsed: { include: { product: true } } },
    });
    if (!service) throw new NotFoundException('Serviço não encontrado.');
    return service;
  }

  async update(companyId: string, id: string, dto: UpdateServiceDto) {
    await this.findOne(companyId, id);
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

  async deactivate(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.prisma.service.update({ where: { id }, data: { active: false } });
  }
}
