import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateShiftDto } from './dto/create-shift.dto';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.employee.findMany({
      where: { active: true },
      include: { user: true, shifts: true },
      orderBy: { hiredAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        user: true,
        shifts: true,
        timeEntries: { orderBy: { checkIn: 'desc' }, take: 30 },
      },
    });
    if (!employee) throw new NotFoundException('Funcionário não encontrado.');
    return employee;
  }

  addShift(employeeId: string, dto: CreateShiftDto) {
    return this.prisma.employeeShift.create({ data: { employeeId, ...dto } });
  }

  async checkIn(employeeId: string) {
    const open = await this.prisma.timeEntry.findFirst({
      where: { employeeId, checkOut: null },
    });
    if (open) throw new BadRequestException('Já existe um ponto em aberto para este funcionário.');

    return this.prisma.timeEntry.create({ data: { employeeId, checkIn: new Date() } });
  }

  async checkOut(employeeId: string) {
    const open = await this.prisma.timeEntry.findFirst({
      where: { employeeId, checkOut: null },
      orderBy: { checkIn: 'desc' },
    });
    if (!open) throw new BadRequestException('Não há ponto em aberto para este funcionário.');

    return this.prisma.timeEntry.update({ where: { id: open.id }, data: { checkOut: new Date() } });
  }

  async calculateCommission(employeeId: string, referenceMonth: string) {
    const employee = await this.findOne(employeeId);
    const [year, month] = referenceMonth.split('-').map(Number);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);

    const orders = await this.prisma.serviceOrder.findMany({
      where: {
        employees: { some: { id: employeeId } },
        status: 'COMPLETED',
        finishedAt: { gte: start, lt: end },
      },
      include: { items: true },
    });

    const revenue = orders.reduce(
      (sum, order) => sum + order.items.reduce((s, i) => s + Number(i.price), 0),
      0,
    );
    const amount = revenue * (Number(employee.commissionRate) / 100);

    return this.prisma.commission.upsert({
      where: { id: `${employeeId}-${referenceMonth}` },
      create: { id: `${employeeId}-${referenceMonth}`, employeeId, referenceMonth, amount },
      update: { amount },
    });
  }
}
