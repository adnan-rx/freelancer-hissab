import { Injectable, Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import { income, expenses, taxRules } from '../../database/schema';

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

    // Section 154A final tax rate on export proceeds from DB Rule Engine
    const exportTaxRatePercentage = await this.getExportTaxRate(isPsebRegistered, taxYear);
    const exportTaxRateDecimal = exportTaxRatePercentage / 100;
    const exportTaxLiabilityPKR = Math.round((exportIncomePKR * exportTaxRateDecimal) * 100) / 100;

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

  private async getExportTaxRate(isPsebRegistered: boolean, taxYear: number): Promise<number> {
    const yearStr = `${taxYear-1}-${taxYear.toString().substring(2)}`;
    const incomeType = isPsebRegistered ? 'IT_EXPORT_PSEB' : 'IT_EXPORT_STANDARD';
    
    let [rule] = await this.db.select().from(taxRules).where(and(eq(taxRules.taxYear, yearStr), eq(taxRules.incomeType, incomeType))).limit(1);
    
    if (!rule) {
      const rate = isPsebRegistered ? 0.0025 : 0.01;
      [rule] = await this.db.insert(taxRules).values({
        taxYear: yearStr,
        incomeType,
        rate: rate.toString(),
        effectiveFrom: `${taxYear-1}-07-01`,
      }).returning();
    }
    
    return Number(rule.rate) * 100;
  }

  async simulateTaxScenario(userId: string, hypotheticalIncomePKR: number, hypotheticalExpensesPKR: number = 0, taxYear = 2026, isPsebRegistered = true) {
    const current = await this.calculateTaxEstimate(userId, isPsebRegistered, taxYear);
    
    const exportTaxRatePercentage = await this.getExportTaxRate(isPsebRegistered, taxYear);
    const exportTaxRateDecimal = exportTaxRatePercentage / 100;

    // For simulator, assuming all income is export for simplicity in v1
    const exportTaxLiabilityPKR = Math.round((hypotheticalIncomePKR * exportTaxRateDecimal) * 100) / 100;
    
    const scenario = {
      incomePKR: hypotheticalIncomePKR,
      expensesPKR: hypotheticalExpensesPKR,
      taxPKR: exportTaxLiabilityPKR,
    };

    return {
      current: {
        incomePKR: current.totalGrossIncomePKR,
        expensesPKR: current.totalExpensesPKR,
        taxPKR: current.totalTaxLiabilityPKR
      },
      scenario,
      differencePKR: scenario.taxPKR - current.totalTaxLiabilityPKR,
    };
  }
}
