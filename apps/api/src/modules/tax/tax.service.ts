import { Injectable, Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import { income, expenses, taxRules } from '../../database/schema';
import {
  DEFAULT_TAX_YEAR,
  taxYearRange,
  incomeInTaxYear,
  expensesInTaxYear,
} from '../../common/tax-year';

export interface TaxEstimateResult {
  taxYear: number;
  taxYearLabel: string;
  periodStart: string;
  periodEnd: string;
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

  async calculateTaxEstimate(
    userId: string,
    isPsebRegistered = true,
    taxYear: number = DEFAULT_TAX_YEAR,
  ): Promise<TaxEstimateResult> {
    const range = taxYearRange(taxYear);

    const allIncome = await this.db.select().from(income).where(eq(income.userId, userId));
    const allExpenses = await this.db.select().from(expenses).where(eq(expenses.userId, userId));

    // Only transactions inside the Pakistani tax year (1 Jul – 30 Jun) count towards the estimate.
    const userIncome = incomeInTaxYear(allIncome, range);
    const userExpenses = expensesInTaxYear(allExpenses, range);

    let exportIncomePKR = 0;
    let localIncomePKR = 0;

    userIncome.forEach((inc: any) => {
      const amount = Number(inc.amountPKR || 0);
      const isExport =
        inc.currency !== 'PKR' || ['upwork', 'fiverr', 'freelancer'].includes((inc.platform || '').toLowerCase());
      if (isExport) {
        exportIncomePKR += amount;
      } else {
        localIncomePKR += amount;
      }
    });

    const totalGrossIncomePKR = Math.round((exportIncomePKR + localIncomePKR) * 100) / 100;
    const totalExpensesPKR =
      Math.round(userExpenses.reduce((sum: number, exp: any) => sum + Number(exp.amountPKR || 0), 0) * 100) / 100;
    const netProfitPKR = Math.max(0, Math.round((totalGrossIncomePKR - totalExpensesPKR) * 100) / 100);

    const exportTaxRatePercentage = await this.getExportTaxRate(isPsebRegistered, range.label, taxYear);
    const exportTaxLiabilityPKR = Math.round(exportIncomePKR * (exportTaxRatePercentage / 100) * 100) / 100;

    // Section 154A is a final tax on gross export proceeds, so business expenses are
    // only deductible against locally-sourced income taxed under the normal slabs.
    const localTaxableIncomePKR = Math.max(0, localIncomePKR - totalExpensesPKR);
    const localTaxLiabilityPKR = Math.round(this.calculateLocalTaxSlabs(localTaxableIncomePKR) * 100) / 100;

    const totalTaxLiabilityPKR = Math.round((exportTaxLiabilityPKR + localTaxLiabilityPKR) * 100) / 100;

    const standardRate = await this.getExportTaxRate(false, range.label, taxYear);
    const psebSavingsPKR = isPsebRegistered
      ? Math.round(exportIncomePKR * ((standardRate - exportTaxRatePercentage) / 100) * 100) / 100
      : 0;

    const effectiveTaxRatePercentage =
      totalGrossIncomePKR > 0
        ? Math.round((totalTaxLiabilityPKR / totalGrossIncomePKR) * 100 * 100) / 100
        : 0;

    return {
      taxYear,
      taxYearLabel: range.label,
      periodStart: range.start.toISOString().split('T')[0],
      periodEnd: new Date(range.end.getTime() - 86400000).toISOString().split('T')[0],
      totalGrossIncomePKR,
      exportIncomePKR: Math.round(exportIncomePKR * 100) / 100,
      localIncomePKR: Math.round(localIncomePKR * 100) / 100,
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
      disclaimer:
        'Estimates are calculated pursuant to Section 154A of the Income Tax Ordinance 2001. This report does not constitute legal or certified tax advice.',
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

  private async getExportTaxRate(isPsebRegistered: boolean, yearLabel: string, taxYear: number): Promise<number> {
    const incomeType = isPsebRegistered ? 'IT_EXPORT_PSEB' : 'IT_EXPORT_STANDARD';

    let [rule] = await this.db
      .select()
      .from(taxRules)
      .where(and(eq(taxRules.taxYear, yearLabel), eq(taxRules.incomeType, incomeType)))
      .limit(1);

    if (!rule) {
      const rate = isPsebRegistered ? 0.0025 : 0.01;
      [rule] = await this.db
        .insert(taxRules)
        .values({
          taxYear: yearLabel,
          incomeType,
          rate: rate.toString(),
          effectiveFrom: `${taxYear - 1}-07-01`,
          notes: 'Auto-seeded default rate. Edit via the tax rules endpoints.',
        })
        .returning();
    }

    return Number(rule.rate) * 100;
  }

  async listRules(yearLabel?: string) {
    if (yearLabel) {
      return this.db.select().from(taxRules).where(eq(taxRules.taxYear, yearLabel));
    }
    return this.db.select().from(taxRules);
  }

  async createRule(data: {
    taxYear: string;
    incomeType: string;
    rate: number;
    threshold?: number;
    effectiveFrom: string;
    effectiveTo?: string;
    notes?: string;
  }) {
    const [rule] = await this.db
      .insert(taxRules)
      .values({
        taxYear: data.taxYear,
        incomeType: data.incomeType,
        rate: data.rate.toString(),
        threshold: data.threshold !== undefined ? data.threshold.toString() : null,
        effectiveFrom: data.effectiveFrom,
        effectiveTo: data.effectiveTo ?? null,
        notes: data.notes,
      })
      .returning();
    return rule;
  }

  async updateRule(
    id: string,
    data: { rate?: number; threshold?: number; effectiveFrom?: string; effectiveTo?: string; notes?: string },
  ) {
    const updateData: Record<string, any> = {};
    if (data.rate !== undefined) updateData.rate = data.rate.toString();
    if (data.threshold !== undefined) updateData.threshold = data.threshold.toString();
    if (data.effectiveFrom !== undefined) updateData.effectiveFrom = data.effectiveFrom;
    if (data.effectiveTo !== undefined) updateData.effectiveTo = data.effectiveTo;
    if (data.notes !== undefined) updateData.notes = data.notes;

    const [rule] = await this.db.update(taxRules).set(updateData).where(eq(taxRules.id, id)).returning();
    return rule;
  }

  async deleteRule(id: string) {
    const [rule] = await this.db.delete(taxRules).where(eq(taxRules.id, id)).returning();
    return rule;
  }

  /**
   * "What if" projection. `localIncomePKR` lets the caller model locally-sourced income,
   * which is where expenses are actually deductible — export proceeds are taxed gross
   * under s.154A, so expenses correctly have no effect on that portion.
   */
  async simulateTaxScenario(
    userId: string,
    hypotheticalIncomePKR: number,
    hypotheticalExpensesPKR = 0,
    taxYear: number = DEFAULT_TAX_YEAR,
    isPsebRegistered = true,
    hypotheticalLocalIncomePKR = 0,
  ) {
    const current = await this.calculateTaxEstimate(userId, isPsebRegistered, taxYear);
    const range = taxYearRange(taxYear);

    const exportIncome = Math.max(0, hypotheticalIncomePKR);
    const localIncome = Math.max(0, hypotheticalLocalIncomePKR);
    const expensesPKR = Math.max(0, hypotheticalExpensesPKR);

    const exportTaxRatePercentage = await this.getExportTaxRate(isPsebRegistered, range.label, taxYear);
    const exportTaxLiabilityPKR = Math.round(exportIncome * (exportTaxRatePercentage / 100) * 100) / 100;

    const localTaxableIncomePKR = Math.max(0, localIncome - expensesPKR);
    const localTaxLiabilityPKR = Math.round(this.calculateLocalTaxSlabs(localTaxableIncomePKR) * 100) / 100;

    const scenarioTaxPKR = Math.round((exportTaxLiabilityPKR + localTaxLiabilityPKR) * 100) / 100;
    const scenarioGrossIncome = exportIncome + localIncome;

    return {
      taxYear,
      taxYearLabel: range.label,
      current: {
        incomePKR: current.totalGrossIncomePKR,
        exportIncomePKR: current.exportIncomePKR,
        localIncomePKR: current.localIncomePKR,
        expensesPKR: current.totalExpensesPKR,
        taxPKR: current.totalTaxLiabilityPKR,
      },
      scenario: {
        incomePKR: scenarioGrossIncome,
        exportIncomePKR: exportIncome,
        localIncomePKR: localIncome,
        expensesPKR,
        exportTaxPKR: exportTaxLiabilityPKR,
        localTaxPKR: localTaxLiabilityPKR,
        taxPKR: scenarioTaxPKR,
      },
      differencePKR: Math.round((scenarioTaxPKR - current.totalTaxLiabilityPKR) * 100) / 100,
      exportTaxRatePercentage,
      notes:
        'Export proceeds are taxed on gross value under Section 154A, so business expenses reduce only locally-sourced income.',
    };
  }
}
