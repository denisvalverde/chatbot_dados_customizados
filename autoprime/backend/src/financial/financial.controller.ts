import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role, TransactionType } from '@prisma/client';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CompanyId } from '../common/decorators/company-id.decorator';
import { FinancialService } from './financial.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';

const FINANCE_ROLES = [Role.ADMIN, Role.MANAGER, Role.FINANCE];

@ApiTags('financial')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(...FINANCE_ROLES)
@Controller('financial')
export class FinancialController {
  constructor(private readonly financialService: FinancialService) {}

  @Post('transactions')
  createTransaction(@CompanyId() companyId: string, @Body() dto: CreateTransactionDto) {
    return this.financialService.createTransaction(companyId, dto);
  }

  @Get('transactions')
  findTransactions(
    @CompanyId() companyId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('type') type?: TransactionType,
  ) {
    return this.financialService.findTransactions(companyId, from, to, type);
  }

  @Get('cash-flow')
  cashFlow(@CompanyId() companyId: string, @Query('from') from: string, @Query('to') to: string) {
    return this.financialService.cashFlow(companyId, from, to);
  }

  @Get('dre')
  dre(@CompanyId() companyId: string, @Query('from') from: string, @Query('to') to: string) {
    return this.financialService.dre(companyId, from, to);
  }
}
