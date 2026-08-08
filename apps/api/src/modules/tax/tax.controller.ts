import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TaxService } from './tax.service';

@Controller('tax')
@UseGuards(JwtAuthGuard)
export class TaxController {
  constructor(private readonly taxService: TaxService) {}

  @Get('estimate')
  getEstimate(
    @CurrentUser() user: any,
    @Query('pseb') pseb?: string,
    @Query('year') year?: string,
  ) {
    const userId = typeof user === 'string' ? user : (user?.id || user);
    const isPseb = pseb !== 'false';
    const taxYear = year ? parseInt(year, 10) : 2026;
    return this.taxService.calculateTaxEstimate(userId, isPseb, taxYear);
  }
}
