import { Injectable, Logger } from '@nestjs/common';

export interface ExchangeRatesData {
  base: string;
  rates: Record<string, number>;
  updatedAt: string;
}

@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);
  private cachedRates: Record<string, number> = {
    USD: 280.50,
    EUR: 302.10,
    GBP: 356.40,
    PKR: 1.0,
  };
  private lastFetchTimestamp = 0;
  private readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  async getRate(fromCurrency: string, toCurrency = 'PKR'): Promise<number> {
    const from = (fromCurrency || 'USD').toUpperCase();
    const to = (toCurrency || 'PKR').toUpperCase();

    if (from === to) return 1.0;

    await this.refreshRatesIfNeeded();

    const fromRateInPKR = this.cachedRates[from] || 280.50;
    const toRateInPKR = this.cachedRates[to] || 1.0;

    // Returns rate relative to target currency (e.g. 1 USD = 280.50 PKR)
    return Math.round((fromRateInPKR / toRateInPKR) * 10000) / 10000;
  }

  async convertToPKR(amount: number, fromCurrency: string): Promise<{ amountPKR: number; exchangeRate: number }> {
    const rate = await this.getRate(fromCurrency, 'PKR');
    const amountPKR = Math.round((amount * rate) * 100) / 100;
    return { amountPKR, exchangeRate: rate };
  }

  async getAllRates(): Promise<ExchangeRatesData> {
    await this.refreshRatesIfNeeded();
    return {
      base: 'PKR',
      rates: { ...this.cachedRates },
      updatedAt: new Date(this.lastFetchTimestamp || Date.now()).toISOString(),
    };
  }

  private async refreshRatesIfNeeded(): Promise<void> {
    const now = Date.now();
    if (this.lastFetchTimestamp && (now - this.lastFetchTimestamp) < this.CACHE_TTL_MS) {
      return;
    }

    try {
      // Primary: ExchangeRate-API (Configurable via EXCHANGE_RATE_API_URL env variable)
      const apiUrl = process.env.EXCHANGE_RATE_API_URL || 'https://api.exchangerate-api.com/v4/latest/USD';
      const res = await fetch(apiUrl);
      if (res.ok) {
        const data = await res.json();
        const usdToPkr = data.rates?.PKR;
        const usdToEur = data.rates?.EUR;
        const usdToGbp = data.rates?.GBP;

        if (usdToPkr && usdToPkr > 0) {
          this.cachedRates.USD = usdToPkr;
          this.cachedRates.EUR = usdToEur ? Math.round((usdToPkr / usdToEur) * 100) / 100 : 302.10;
          this.cachedRates.GBP = usdToGbp ? Math.round((usdToPkr / usdToGbp) * 100) / 100 : 356.40;
          this.cachedRates.PKR = 1.0;
          this.lastFetchTimestamp = now;
          this.logger.log(`Live exchange rates updated from ExchangeRate-API: 1 USD = ${usdToPkr} PKR`);
          return;
        }
      }
    } catch (err) {
      this.logger.warn(`Failed to fetch primary exchange rates. Using fallback rates. Error: ${err}`);
    }

    // Fallback timestamp if fetch fails
    if (!this.lastFetchTimestamp) {
      this.lastFetchTimestamp = now;
    }
  }
}
