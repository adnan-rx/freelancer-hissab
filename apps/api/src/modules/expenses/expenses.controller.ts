import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/expense.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  findAll(@CurrentUser() user: any, @Query() query: { category?: string }) {
    return this.expensesService.findAll(user.id, query);
  }

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateExpenseDto) {
    return this.expensesService.create(user.id, dto);
  }

  @Delete(':id')
  delete(@CurrentUser() user: any, @Param('id') id: string) {
    return this.expensesService.delete(user.id, id);
  }
}
