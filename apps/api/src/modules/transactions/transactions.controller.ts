import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import type { TransactionType, TransactionSortKey } from './transactions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

const SORT_KEYS: TransactionSortKey[] = ['date', 'entity', 'category', 'amount'];

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
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: string,
  ) {
    // Returned bare — the global TransformInterceptor already wraps every
    // response as { success, data, error }. Spreading a second `success: true`
    // in here used to double-wrap this one endpoint as
    // { success, data: { success, data, total, ... }, error }, forcing the
    // frontend to guess which shape it got.
    return this.transactionsService.findAll(user.id, {
      search,
      type,
      startDate,
      endDate,
      page: pageStr ? parseInt(pageStr, 10) : undefined,
      pageSize: pageSizeStr ? parseInt(pageSizeStr, 10) : undefined,
      sortBy: SORT_KEYS.includes(sortBy as TransactionSortKey) ? (sortBy as TransactionSortKey) : undefined,
      sortDir: sortDir === 'asc' ? 'asc' : sortDir === 'desc' ? 'desc' : undefined,
    });
  }
}
