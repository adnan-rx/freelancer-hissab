import { Controller, Get, Query } from '@nestjs/common';
import { ExchangeRateService } from './exchange-rate.service';

@Controller('exchange-rate')
export class ExchangeRateController {
  constructor(private readonly exchangeRateService: ExchangeRateService) {}

  @Get()
  getRates() {
    return this.exchangeRateService.getAllRates();
  }

  @Get('convert')
  async convert(
    @Query('amount') amountStr: string,
    @Query('from') from: string,
  ) {
    const amount = parseFloat(amountStr || '1');
    return this.exchangeRateService.convertToPKR(amount, from || 'USD');
  }
}
