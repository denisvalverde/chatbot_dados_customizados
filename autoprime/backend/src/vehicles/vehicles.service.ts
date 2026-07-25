import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, dto: CreateVehicleDto) {
    const client = await this.prisma.client.findFirst({ where: { id: dto.clientId, companyId } });
    if (!client) throw new BadRequestException('Cliente não encontrado nesta empresa.');

    return this.prisma.vehicle.create({ data: { ...dto, companyId } });
  }

  findAllForClient(companyId: string, clientId: string) {
    return this.prisma.vehicle.findMany({
      where: { clientId, companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(companyId: string, id: string) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id, companyId },
      include: { client: { include: { user: true } } },
    });
    if (!vehicle) throw new NotFoundException('Veículo não encontrado.');
    return vehicle;
  }

  async findByPlate(companyId: string, plate: string) {
    return this.prisma.vehicle.findMany({
      where: { companyId, plate: { equals: plate, mode: 'insensitive' } },
    });
  }

  async update(companyId: string, id: string, dto: UpdateVehicleDto) {
    await this.findOne(companyId, id);
    return this.prisma.vehicle.update({ where: { id }, data: dto });
  }

  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);
    await this.prisma.vehicle.delete({ where: { id } });
    return { success: true };
  }
}
