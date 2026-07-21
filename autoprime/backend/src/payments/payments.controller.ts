import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
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
  create(@Body() dto: CreatePaymentDto) {
    return this.paymentsService.createPayment(dto);
  }

  @Roles(...STAFF)
  @Patch(':id/confirm')
  confirm(@Param('id') id: string) {
    return this.paymentsService.confirmPayment(id);
  }

  @Roles(...STAFF, Role.CLIENT)
  @Get('service-order/:serviceOrderId')
  findByServiceOrder(@Param('serviceOrderId') serviceOrderId: string) {
    return this.paymentsService.findByServiceOrder(serviceOrderId);
  }
}
