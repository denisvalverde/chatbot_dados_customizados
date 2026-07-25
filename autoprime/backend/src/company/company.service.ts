import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';

@Injectable()
export class CompanyService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCompanyDto) {
    const [existingSlug, existingEmail] = await Promise.all([
      this.prisma.company.findUnique({ where: { slug: dto.slug } }),
      this.prisma.user.findUnique({ where: { email: dto.adminEmail } }),
    ]);
    if (existingSlug) throw new ConflictException('Já existe uma empresa com este identificador.');
    if (existingEmail) throw new ConflictException('Já existe uma conta com este e-mail.');

    const passwordHash = await bcrypt.hash(dto.adminPassword, 12);

    return this.prisma.company.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        users: {
          create: {
            name: dto.adminName,
            email: dto.adminEmail,
            passwordHash,
            role: Role.ADMIN,
          },
        },
      },
      include: { users: true },
    });
  }

  findAll() {
    return this.prisma.company.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findBySlug(slug: string) {
    const company = await this.prisma.company.findUnique({ where: { slug } });
    if (!company || !company.active) {
      throw new NotFoundException('Empresa não encontrada.');
    }
    return { id: company.id, name: company.name, slug: company.slug };
  }

  async setActive(id: string, active: boolean) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) throw new NotFoundException('Empresa não encontrada.');
    return this.prisma.company.update({ where: { id }, data: { active } });
  }
}
