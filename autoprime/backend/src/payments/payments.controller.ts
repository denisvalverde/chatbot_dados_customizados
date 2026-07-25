import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CompanyId } from '../common/decorators/company-id.decorator';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

const STAFF = [Role.ADMIN, Role.MANAGER, Role.EMPLOYEE, Role.FINANCE];

@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Roles(...STAFF, Role.CLIENT)
  @Post()
  create(@CompanyId() companyId: string, @Body() dto: CreatePaymentDto) {
    return this.paymentsService.createPayment(companyId, dto);
  }

  @Roles(...STAFF)
  @Patch(':id/confirm')
  confirm(@CompanyId() companyId: string, @Param('id') id: string) {
    return this.paymentsService.confirmPayment(companyId, id);
  }

  @Roles(...STAFF, Role.CLIENT)
  @Get('service-order/:serviceOrderId')
  findByServiceOrder(
    @CompanyId() companyId: string,
    @Param('serviceOrderId') serviceOrderId: string,
  ) {
    return this.paymentsService.findByServiceOrder(companyId, serviceOrderId);
  }
}
