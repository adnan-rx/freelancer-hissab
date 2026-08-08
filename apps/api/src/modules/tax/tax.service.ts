import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import { income, expenses } from '../../database/schema';

export interface TaxEstimateResult {
  taxYear: number;
  totalGrossIncomePKR: number;
  exportIncomePKR: number;
  localIncomePKR: number;
  totalExpensesPKR: number;
  netProfitPKR: number;
  isPsebRegistered: boolean;
  exportTaxRatePercentage: number;
  exportTaxLiabilityPKR: number;
  localTaxLiabilityPKR: number;
  totalTaxLiabilityPKR: number;
  psebSavingsPKR: number;
  effectiveTaxRatePercentage: number;
  fbrFilingDeadline: string;
  disclaimer: string;
}

@Injectable()
export class TaxService {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  async calculateTaxEstimate(userId: string, isPsebRegistered = true, taxYear = 2026): Promise<TaxEstimateResult> {
    const userIncome = await this.db.select().from(income).where(eq(income.userId, userId));
    const userExpenses = await this.db.select().from(expenses).where(eq(expenses.userId, userId));

    let exportIncomePKR = 0;
    let localIncomePKR = 0;

    userIncome.forEach((inc: any) => {
      const amount = Number(inc.amountPKR || 0);
      const isExport = inc.currency !== 'PKR' || ['upwork', 'fiverr', 'freelancer'].includes((inc.platform || '').toLowerCase());
      if (isExport) {
        exportIncomePKR += amount;
      } else {
        localIncomePKR += amount;
      }
    });

    const totalGrossIncomePKR = exportIncomePKR + localIncomePKR;
    const totalExpensesPKR = userExpenses.reduce((sum: number, exp: any) => sum + Number(exp.amount || 0), 0);
    const netProfitPKR = Math.max(0, totalGrossIncomePKR - totalExpensesPKR);

    // Section 154A final tax rate on export proceeds
    const exportTaxRatePercentage = isPsebRegistered ? 0.25 : 1.0;
    const exportTaxLiabilityPKR = Math.round((exportIncomePKR * (exportTaxRatePercentage / 100)) * 100) / 100;

    // Standard FBR individual tax slabs on local income
    const localTaxLiabilityPKR = this.calculateLocalTaxSlabs(localIncomePKR);

    const totalTaxLiabilityPKR = Math.round((exportTaxLiabilityPKR + localTaxLiabilityPKR) * 100) / 100;

    // Savings achieved by having PSEB registration (0.75% tax reduction)
    const psebSavingsPKR = isPsebRegistered ? Math.round((exportIncomePKR * 0.0075) * 100) / 100 : 0;

    const effectiveTaxRatePercentage = totalGrossIncomePKR > 0
      ? Math.round(((totalTaxLiabilityPKR / totalGrossIncomePKR) * 100) * 100) / 100
      : 0;

    return {
      taxYear,
      totalGrossIncomePKR,
      exportIncomePKR,
      localIncomePKR,
      totalExpensesPKR,
      netProfitPKR,
      isPsebRegistered,
      exportTaxRatePercentage,
      exportTaxLiabilityPKR,
      localTaxLiabilityPKR,
      totalTaxLiabilityPKR,
      psebSavingsPKR,
      effectiveTaxRatePercentage,
      fbrFilingDeadline: `September 30, ${taxYear}`,
      disclaimer: 'Estimates are calculated pursuant to Section 154A of the Income Tax Ordinance 2001. This report does not constitute legal or certified tax advice.',
    };
  }

  private calculateLocalTaxSlabs(incomePKR: number): number {
    if (incomePKR <= 600000) {
      return 0;
    } else if (incomePKR <= 1200000) {
      return (incomePKR - 600000) * 0.025;
    } else if (incomePKR <= 2400000) {
      return 15000 + (incomePKR - 1200000) * 0.125;
    } else if (incomePKR <= 3600000) {
      return 165000 + (incomePKR - 2400000) * 0.225;
    } else {
      return 435000 + (incomePKR - 3600000) * 0.35;
    }
  }
}
