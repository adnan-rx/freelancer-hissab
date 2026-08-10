import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import type { TransactionType } from './transactions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  async findAll(
    @CurrentUser() user: any,
    @Query('search') search?: string,
    @Query('type') type?: TransactionType,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') pageStr?: string,
    @Query('pageSize') pageSizeStr?: string,
  ) {
    const result = await this.transactionsService.findAll(user.id, {
      search,
      type,
      startDate,
      endDate,
      page: pageStr ? parseInt(pageStr, 10) : undefined,
      pageSize: pageSizeStr ? parseInt(pageSizeStr, 10) : undefined,
    });

    return {
      success: true,
      ...result,
    };
  }
}
