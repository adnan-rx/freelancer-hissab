import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IncomeService } from './income.service';
import { CreateIncomeDto } from './dto/income.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('income')
export class IncomeController {
  constructor(private readonly incomeService: IncomeService) {}

  @Get()
  findAll(@CurrentUser() user: any, @Query() query: { clientId?: string; platform?: string }) {
    return this.incomeService.findAll(user.id, query);
  }

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateIncomeDto) {
    return this.incomeService.create(user.id, dto);
  }

  @Delete(':id')
  delete(@CurrentUser() user: any, @Param('id') id: string) {
    return this.incomeService.delete(user.id, id);
  }
}
