import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

const REQUIRED_TO_PUBLISH = [
  'address',
  'number',
  'district',
  'city',
  'state',
  'zipCode',
  'phone',
] as const;

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, dto: CreateBranchDto) {
    const existing = await this.prisma.branch.findUnique({
      where: { companyId_slug: { companyId, slug: dto.slug } },
    });
    if (existing)
      throw new ConflictException('Já existe uma unidade com este identificador nesta empresa.');

    return this.prisma.branch.create({ data: { companyId, ...dto } });
  }

  findAll(companyId: string) {
    return this.prisma.branch.findMany({ where: { companyId }, orderBy: { name: 'asc' } });
  }

  async findOne(companyId: string, id: string) {
    const branch = await this.prisma.branch.findFirst({ where: { id, companyId } });
    if (!branch) throw new NotFoundException('Unidade não encontrada.');
    return branch;
  }

  async update(companyId: string, id: string, dto: UpdateBranchDto) {
    await this.findOne(companyId, id);
    return this.prisma.branch.update({ where: { id }, data: dto });
  }

  /**
   * Publica a unidade só depois de confirmar que os campos obrigatórios de
   * endereço/contato foram preenchidos — nunca inventados pelo sistema.
   */
  async publish(companyId: string, id: string) {
    const branch = await this.findOne(companyId, id);
    const missing = REQUIRED_TO_PUBLISH.filter((field) => !branch[field]);
    if (missing.length > 0) {
      throw new BadRequestException(
        `Preencha os campos obrigatórios antes de publicar: ${missing.join(', ')}.`,
      );
    }
    return this.prisma.branch.update({ where: { id }, data: { isPublished: true } });
  }

  async unpublish(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.prisma.branch.update({
      where: { id },
      data: { isPublished: false, acceptsAppointments: false },
    });
  }

  /**
   * Listagem pública (seletor de unidade no cadastro/home) — só unidades
   * publicadas e ativas, de uma empresa específica.
   */
  findPublicByCompanySlug(companySlug: string) {
    return this.prisma.branch.findMany({
      where: { isPublished: true, isActive: true, company: { slug: companySlug, active: true } },
      select: {
        id: true,
        name: true,
        slug: true,
        city: true,
        state: true,
        address: true,
        number: true,
        district: true,
        phone: true,
        whatsapp: true,
        description: true,
        imageUrl: true,
        acceptsAppointments: true,
      },
      orderBy: { name: 'asc' },
    });
  }
}
