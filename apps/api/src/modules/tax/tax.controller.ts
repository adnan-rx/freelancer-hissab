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

  /**
   * PSEB status comes from the user's own record. It used to default to `true`
   * for everyone unless `?pseb=false` was passed, so an unregistered freelancer
   * was quoted the concessional 0.25% rate instead of the standard 1% — a 4x
   * understatement of their export tax. The query param remains only as an
   * explicit override for "what if I registered?" comparisons.
   */
  private resolvePseb(user: any, pseb?: string): boolean {
    if (pseb === 'true') return true;
    if (pseb === 'false') return false;
    return !!user?.psebId;
  }

  @Get('estimate')
  getEstimate(@CurrentUser() user: any, @Query('pseb') pseb?: string, @Query('year') year?: string) {
    return this.taxService.calculateTaxEstimate(user.id, this.resolvePseb(user, pseb), parseTaxYear(year));
  }

  @Post('simulate')
  simulateTax(@CurrentUser() user: any, @Body() dto: SimulateTaxDto) {
    return this.taxService.simulateTaxScenario(
      user.id,
      dto.incomePKR,
      dto.expensesPKR || 0,
      parseTaxYear(dto.year),
      dto.pseb ?? !!user?.psebId,
      dto.localIncomePKR || 0,
    );
  }

  // ---- Tax rules engine ----------------------------------------------------
  // Reads are open to any signed-in user so the UI can show which rate applied.
  // Writes are admin-only: these rows drive every user's tax calculation.

  @Get('rules')
  listRules(@Query('year') year?: string) {
    return this.taxService.listRules(year ? taxYearRange(year).label : undefined);
  }

  /** What the engine falls back to when a year has no configured rules. */
  @Get('rules/defaults')
  getDefaults() {
    return this.taxService.getDefaultRates();
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
