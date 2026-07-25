import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, dto: CreateClientDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Já existe uma conta com este e-mail.');

    const passwordHash = await bcrypt.hash(dto.password, 12);

    return this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        phone: dto.phone,
        passwordHash,
        role: Role.CLIENT,
        companyId,
        client: {
          create: {
            companyId,
            document: dto.document,
            rg: dto.rg,
            addressStreet: dto.addressStreet,
            addressNumber: dto.addressNumber,
            addressCity: dto.addressCity,
            addressState: dto.addressState,
            addressZip: dto.addressZip,
            lgpdConsentAt: new Date(),
          },
        },
      },
      include: { client: true },
    });
  }

  async findAll(companyId: string, search?: string) {
    return this.prisma.user.findMany({
      where: {
        role: Role.CLIENT,
        companyId,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { client: { document: { contains: search } } },
              ],
            }
          : {}),
      },
      include: { client: { include: { vehicles: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(companyId: string, id: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, companyId },
      include: { user: true, vehicles: true, loyaltyAccount: true },
    });
    if (!client) throw new NotFoundException('Cliente não encontrado.');
    return client;
  }

  async update(companyId: string, id: string, dto: UpdateClientDto) {
    await this.findOne(companyId, id);
    const { name, phone, ...clientFields } = dto;
    return this.prisma.client.update({
      where: { id },
      data: {
        ...clientFields,
        user: {
          update: {
            ...(name ? { name } : {}),
            ...(phone ? { phone } : {}),
          },
        },
      },
      include: { user: true },
    });
  }

  async remove(companyId: string, id: string) {
    const client = await this.findOne(companyId, id);
    await this.prisma.user.update({ where: { id: client.userId }, data: { isActive: false } });
    return { success: true };
  }
}
