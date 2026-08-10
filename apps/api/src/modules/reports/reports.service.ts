import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import { income, expenses } from '../../database/schema';
import { taxYearRange, incomeInTaxYear } from '../../common/tax-year';

@Injectable()
export class ReportsService {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  /**
   * Monthly trend across a Pakistani tax year (July → June), not the calendar year.
   * Pass `year` to look at a past tax year; defaults to the current one.
   */
  async getIncomeVsExpenses(userId: string, year?: string) {
    const range = taxYearRange(year);
    const userIncome = await this.db.select().from(income).where(eq(income.userId, userId));
    const userExpenses = await this.db.select().from(expenses).where(eq(expenses.userId, userId));

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // 12 buckets starting at July of the opening calendar year.
    return Array.from({ length: 12 }, (_, offset) => {
      const bucketStart = new Date(Date.UTC(range.taxYear - 1, 6 + offset, 1));
      const bucketEnd = new Date(Date.UTC(range.taxYear - 1, 7 + offset, 1));

      const within = (value: any) => {
        const date = new Date(value);
        return !Number.isNaN(date.getTime()) && date >= bucketStart && date < bucketEnd;
      };

      const inc = userIncome
        .filter((i: any) => within(i.receivedAt || i.createdAt))
        .reduce((sum: number, i: any) => sum + Number(i.amountPKR || 0), 0);

      const exp = userExpenses
        .filter((e: any) => within(e.expenseDate || e.createdAt))
        .reduce((sum: number, e: any) => sum + Number(e.amountPKR || 0), 0);

      return {
        month: monthNames[bucketStart.getUTCMonth()],
        year: bucketStart.getUTCFullYear(),
        income: Math.round(inc * 100) / 100,
        expenses: Math.round(exp * 100) / 100,
        profit: Math.round((inc - exp) * 100) / 100,
      };
    });
  }

  async getIncomeConsolidation(userId: string, year?: string) {
    const range = taxYearRange(year);
    const allIncome = await this.db.select().from(income).where(eq(income.userId, userId));
    const userIncome = incomeInTaxYear(allIncome, range);

    let totalPKR = 0;
    let unmatchedPKR = 0;
    const platformBreakdown: Record<string, number> = {};

    userIncome.forEach((inc: any) => {
      const amount = Number(inc.amountPKR || 0);
      totalPKR += amount;

      if (!inc.platform && !inc.clientId) {
        unmatchedPKR += amount;
      }

      if (inc.platform) {
        platformBreakdown[inc.platform] = (platformBreakdown[inc.platform] || 0) + amount;
      }
    });

    const byPlatform = Object.keys(platformBreakdown).map((platform) => ({
      platform,
      amountPKR: platformBreakdown[platform],
      percentage: totalPKR > 0 ? Number(((platformBreakdown[platform] / totalPKR) * 100).toFixed(1)) : 0,
    })).sort((a, b) => b.amountPKR - a.amountPKR);

    const unmatchedPercentage = totalPKR > 0 ? Number(((unmatchedPKR / totalPKR) * 100).toFixed(1)) : 0;
    const trackedPercentage = totalPKR > 0 ? Number((100 - unmatchedPercentage).toFixed(1)) : 0;

    return {
      taxYear: range.taxYear,
      taxYearLabel: range.label,
      totalPKR: Math.round(totalPKR * 100) / 100,
      byPlatform,
      trackedPercentage,
      unmatchedPercentage,
    };
  }
}
