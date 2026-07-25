import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { DEFAULT_TIMEZONE } from '../common/timezone.util';

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
        timezone: dto.timezone ?? DEFAULT_TIMEZONE,
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

  /**
   * Listagem pública para o seletor de empresa no cadastro/home — só campos
   * seguros, só empresas ativas.
   */
  async findAllPublic() {
    const companies = await this.prisma.company.findMany({
      where: { active: true },
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    });
    return companies;
  }

  async findBySlug(slug: string) {
    const company = await this.prisma.company.findUnique({ where: { slug } });
    if (!company || !company.active) {
      throw new NotFoundException('Empresa não encontrada.');
    }
    return { id: company.id, name: company.name, slug: company.slug, timezone: company.timezone };
  }

  async findById(id: string) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) throw new NotFoundException('Empresa não encontrada.');
    return company;
  }

  async setActive(id: string, active: boolean) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) throw new NotFoundException('Empresa não encontrada.');
    return this.prisma.company.update({ where: { id }, data: { active } });
  }

  async updateTimezone(id: string, timezone: string) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) throw new NotFoundException('Empresa não encontrada.');
    return this.prisma.company.update({ where: { id }, data: { timezone } });
  }

  /**
   * Serviços ativos de uma empresa, para a home pública e o cadastro — só
   * campos seguros para exibição a visitantes não autenticados (sem custo,
   * fornecedor etc.).
   */
  async findPublicServicesBySlug(slug: string) {
    const company = await this.prisma.company.findUnique({ where: { slug } });
    if (!company || !company.active) return [];

    return this.prisma.service.findMany({
      where: { companyId: company.id, active: true },
      select: {
        id: true,
        name: true,
        category: true,
        description: true,
        price: true,
        estimatedMinutes: true,
        photos: true,
      },
      orderBy: { name: 'asc' },
    });
  }
}
