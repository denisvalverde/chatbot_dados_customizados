import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateClientDto) {
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
        client: {
          create: {
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

  async findAll(search?: string) {
    return this.prisma.user.findMany({
      where: {
        role: Role.CLIENT,
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

  async findOne(id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: { user: true, vehicles: true, loyaltyAccount: true },
    });
    if (!client) throw new NotFoundException('Cliente não encontrado.');
    return client;
  }

  async update(id: string, dto: UpdateClientDto) {
    await this.findOne(id);
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

  async remove(id: string) {
    await this.findOne(id);
    const client = await this.prisma.client.findUniqueOrThrow({ where: { id } });
    await this.prisma.user.update({ where: { id: client.userId }, data: { isActive: false } });
    return { success: true };
  }
}
