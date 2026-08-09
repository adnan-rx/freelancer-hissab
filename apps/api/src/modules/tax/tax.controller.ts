import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TaxService } from './tax.service';
import { SimulateTaxDto, CreateTaxRuleDto, UpdateTaxRuleDto } from './dto/tax.dto';
import { parseTaxYear, taxYearRange } from '../../common/tax-year';

@Controller('tax')
@UseGuards(JwtAuthGuard)
export class TaxController {
  constructor(private readonly taxService: TaxService) {}

  @Get('estimate')
  getEstimate(@CurrentUser() user: any, @Query('pseb') pseb?: string, @Query('year') year?: string) {
    const userId = typeof user === 'string' ? user : user?.id || user;
    const isPseb = pseb !== 'false';
    return this.taxService.calculateTaxEstimate(userId, isPseb, parseTaxYear(year));
  }

  @Post('simulate')
  simulateTax(@CurrentUser() user: any, @Body() dto: SimulateTaxDto) {
    const userId = typeof user === 'string' ? user : user?.id || user;
    return this.taxService.simulateTaxScenario(
      userId,
      dto.incomePKR,
      dto.expensesPKR || 0,
      parseTaxYear(dto.year),
      dto.pseb ?? true,
      dto.localIncomePKR || 0,
    );
  }

  // ---- Tax rules engine (doc 17) -------------------------------------------
  // Reads are open to any signed-in user so the UI can show which rate applied.
  // Writes are admin-only: these rows drive every user's tax calculation.

  @Get('rules')
  listRules(@Query('year') year?: string) {
    return this.taxService.listRules(year ? taxYearRange(year).label : undefined);
  }

  @Post('rules')
  @UseGuards(AdminGuard)
  createRule(@Body() dto: CreateTaxRuleDto) {
    return this.taxService.createRule(dto);
  }

  @Patch('rules/:id')
  @UseGuards(AdminGuard)
  updateRule(@Param('id') id: string, @Body() dto: UpdateTaxRuleDto) {
    return this.taxService.updateRule(id, dto);
  }

  @Delete('rules/:id')
  @UseGuards(AdminGuard)
  deleteRule(@Param('id') id: string) {
    return this.taxService.deleteRule(id);
  }
}
