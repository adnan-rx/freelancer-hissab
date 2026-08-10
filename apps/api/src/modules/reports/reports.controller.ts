import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('income-vs-expenses')
  getIncomeVsExpenses(@CurrentUser() user: any, @Query('year') year?: string) {
    return this.reportsService.getIncomeVsExpenses(user.id, year);
  }

  @Get('income-consolidation')
  getIncomeConsolidation(@CurrentUser() user: any, @Query('year') year?: string) {
    return this.reportsService.getIncomeConsolidation(user.id, year);
  }
}
