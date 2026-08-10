import { Injectable, Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import { income, expenses, taxRules } from '../../database/schema';
import {
  getCurrentTaxYear,
  taxYearRange,
  incomeInTaxYear,
  expensesInTaxYear,
} from '../../common/tax-year';
import { round2 } from '../../common/money';

export const EXPORT_INCOME_TYPES = {
  pseb: 'IT_EXPORT_PSEB',
  standard: 'IT_EXPORT_STANDARD',
} as const;

/** Slab rows live in `tax_rules` as incomeType = LOCAL_SLAB, threshold = lower bound. */
export const LOCAL_SLAB_INCOME_TYPE = 'LOCAL_SLAB';

/**
 * Documented fallbacks, used only when the database has no rule for the year.
 *
 * These are NOT written back to `tax_rules`: `getExportTaxRate` used to INSERT a
 * row from inside a GET, which meant any signed-in user mutated globally-shared
 * configuration just by loading the tax page, and races produced duplicate rows
 * that made the applied rate non-deterministic.
 */
const DEFAULT_EXPORT_RATES: Record<string, number> = {
  [EXPORT_INCOME_TYPES.pseb]: 0.0025,
  [EXPORT_INCOME_TYPES.standard]: 0.01,
};

/** Marginal slabs, ascending by lower bound. Override per year via `tax_rules`. */
const DEFAULT_LOCAL_SLABS: Array<{ threshold: number; rate: number }> = [
  { threshold: 0, rate: 0 },
  { threshold: 600000, rate: 0.025 },
  { threshold: 1200000, rate: 0.125 },
  { threshold: 2400000, rate: 0.225 },
  { threshold: 3600000, rate: 0.35 },
];

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
  /** True when no DB rule matched and the documented fallback was used. */
  usingDefaultRates: boolean;
  fbrFilingDeadline: string;
  disclaimer: string;
}

@Injectable()
export class TaxService {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  async calculateTaxEstimate(
    userId: string,
    isPsebRegistered = false,
    taxYear: number = getCurrentTaxYear(),
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

    exportIncomePKR = round2(exportIncomePKR);
    localIncomePKR = round2(localIncomePKR);

    const totalGrossIncomePKR = round2(exportIncomePKR + localIncomePKR);
    const totalExpensesPKR = round2(
      userExpenses.reduce((sum: number, exp: any) => sum + Number(exp.amountPKR || 0), 0),
    );
    const netProfitPKR = round2(totalGrossIncomePKR - totalExpensesPKR);

    const exportRate = await this.getExportTaxRate(isPsebRegistered, range);
    const exportTaxRatePercentage = exportRate.percentage;
    const exportTaxLiabilityPKR = round2(exportIncomePKR * (exportTaxRatePercentage / 100));

    // Section 154A is a final tax on gross export proceeds, so business expenses are
    // only deductible against locally-sourced income taxed under the normal slabs.
    const localTaxableIncomePKR = Math.max(0, localIncomePKR - totalExpensesPKR);
    const slabs = await this.getLocalSlabs(range);
    const localTaxLiabilityPKR = round2(this.calculateLocalTaxSlabs(localTaxableIncomePKR, slabs.slabs));

    const totalTaxLiabilityPKR = round2(exportTaxLiabilityPKR + localTaxLiabilityPKR);

    const standardRate = await this.getExportTaxRate(false, range);
    const psebSavingsPKR = isPsebRegistered
      ? round2(exportIncomePKR * ((standardRate.percentage - exportTaxRatePercentage) / 100))
      : 0;

    const effectiveTaxRatePercentage =
      totalGrossIncomePKR > 0 ? round2((totalTaxLiabilityPKR / totalGrossIncomePKR) * 100) : 0;

    return {
      taxYear: range.taxYear,
      taxYearLabel: range.label,
      periodStart: range.start.toISOString().split('T')[0],
      periodEnd: new Date(range.end.getTime() - 86400000).toISOString().split('T')[0],
      totalGrossIncomePKR,
      exportIncomePKR,
      localIncomePKR,
      totalExpensesPKR,
      // A loss is reported as a loss; this used to be clamped to 0.
      netProfitPKR,
      isPsebRegistered,
      exportTaxRatePercentage,
      exportTaxLiabilityPKR,
      localTaxLiabilityPKR,
      totalTaxLiabilityPKR,
      psebSavingsPKR,
      effectiveTaxRatePercentage,
      usingDefaultRates: exportRate.isDefault || slabs.isDefault,
      fbrFilingDeadline: `September 30, ${range.taxYear}`,
      disclaimer:
        'Estimates are calculated pursuant to Section 154A of the Income Tax Ordinance 2001. This report does not constitute legal or certified tax advice.',
    };
  }

  /** Progressive marginal slabs — each bracket taxes only the income above its threshold. */
  private calculateLocalTaxSlabs(incomePKR: number, slabs: Array<{ threshold: number; rate: number }>): number {
    if (incomePKR <= 0 || slabs.length === 0) return 0;

    const ordered = [...slabs].sort((a, b) => a.threshold - b.threshold);
    let tax = 0;

    for (let i = 0; i < ordered.length; i++) {
      const { threshold, rate } = ordered[i];
      if (incomePKR <= threshold) break;
      const upperBound = i + 1 < ordered.length ? ordered[i + 1].threshold : Infinity;
      const taxableInBracket = Math.min(incomePKR, upperBound) - threshold;
      if (taxableInBracket > 0) tax += taxableInBracket * rate;
    }

    return tax;
  }

  /**
   * Picks the rule in force for the tax year: latest `effectiveFrom` that has
   * started by the year end, and not already superseded by `effectiveTo`.
   * Previously this used `.limit(1)` with no ordering, so with duplicate rows
   * present the applied rate varied between requests.
   */
  private async getExportTaxRate(
    isPsebRegistered: boolean,
    range: { label: string; end: Date },
  ): Promise<{ percentage: number; isDefault: boolean }> {
    const incomeType = isPsebRegistered ? EXPORT_INCOME_TYPES.pseb : EXPORT_INCOME_TYPES.standard;

    const rules = await this.db
      .select()
      .from(taxRules)
      .where(and(eq(taxRules.taxYear, range.label), eq(taxRules.incomeType, incomeType)));

    const rule = this.pickEffectiveRule(rules, range.end);

    if (!rule) {
      return { percentage: DEFAULT_EXPORT_RATES[incomeType] * 100, isDefault: true };
    }
    return { percentage: Number(rule.rate) * 100, isDefault: false };
  }

  private async getLocalSlabs(range: { label: string; end: Date }) {
    const rows = await this.db
      .select()
      .from(taxRules)
      .where(and(eq(taxRules.taxYear, range.label), eq(taxRules.incomeType, LOCAL_SLAB_INCOME_TYPE)));

    const effective = rows.filter((r: any) => this.isRuleEffective(r, range.end));

    if (effective.length === 0) {
      return { slabs: DEFAULT_LOCAL_SLABS, isDefault: true };
    }

    return {
      slabs: effective.map((r: any) => ({ threshold: Number(r.threshold || 0), rate: Number(r.rate) })),
      isDefault: false,
    };
  }

  private isRuleEffective(rule: any, asOf: Date): boolean {
    const from = rule.effectiveFrom ? new Date(rule.effectiveFrom) : null;
    const to = rule.effectiveTo ? new Date(rule.effectiveTo) : null;
    if (from && from > asOf) return false;
    if (to && to < asOf) return false;
    return true;
  }

  private pickEffectiveRule(rules: any[], asOf: Date) {
    return rules
      .filter((r) => this.isRuleEffective(r, asOf))
      .sort((a, b) => {
        const af = a.effectiveFrom ? new Date(a.effectiveFrom).getTime() : 0;
        const bf = b.effectiveFrom ? new Date(b.effectiveFrom).getTime() : 0;
        if (bf !== af) return bf - af;
        // Deterministic tiebreak so duplicates can never flip between requests.
        return String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''));
      })[0];
  }

  async listRules(yearLabel?: string) {
    const rows = yearLabel
      ? await this.db.select().from(taxRules).where(eq(taxRules.taxYear, yearLabel))
      : await this.db.select().from(taxRules);

    return rows.sort(
      (a: any, b: any) =>
        String(a.taxYear).localeCompare(String(b.taxYear)) ||
        String(a.incomeType).localeCompare(String(b.incomeType)) ||
        Number(a.threshold || 0) - Number(b.threshold || 0),
    );
  }

  /** The rates the engine falls back to when a year has no rules configured. */
  getDefaultRates() {
    return {
      exportRates: Object.entries(DEFAULT_EXPORT_RATES).map(([incomeType, rate]) => ({ incomeType, rate })),
      localSlabs: DEFAULT_LOCAL_SLABS,
      note: 'Used only when no tax_rules row matches the requested tax year.',
    };
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

    if (Object.keys(updateData).length === 0) {
      const [current] = await this.db.select().from(taxRules).where(eq(taxRules.id, id)).limit(1);
      return current;
    }

    updateData.updatedAt = new Date();
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
    taxYear: number = getCurrentTaxYear(),
    isPsebRegistered = false,
    hypotheticalLocalIncomePKR = 0,
  ) {
    const current = await this.calculateTaxEstimate(userId, isPsebRegistered, taxYear);
    const range = taxYearRange(taxYear);

    const exportIncome = Math.max(0, hypotheticalIncomePKR);
    const localIncome = Math.max(0, hypotheticalLocalIncomePKR);
    const expensesPKR = Math.max(0, hypotheticalExpensesPKR);

    const exportRate = await this.getExportTaxRate(isPsebRegistered, range);
    const exportTaxLiabilityPKR = round2(exportIncome * (exportRate.percentage / 100));

    const localTaxableIncomePKR = Math.max(0, localIncome - expensesPKR);
    const slabs = await this.getLocalSlabs(range);
    const localTaxLiabilityPKR = round2(this.calculateLocalTaxSlabs(localTaxableIncomePKR, slabs.slabs));

    const scenarioTaxPKR = round2(exportTaxLiabilityPKR + localTaxLiabilityPKR);
    const scenarioGrossIncome = round2(exportIncome + localIncome);

    return {
      taxYear: range.taxYear,
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
      differencePKR: round2(scenarioTaxPKR - current.totalTaxLiabilityPKR),
      exportTaxRatePercentage: exportRate.percentage,
      usingDefaultRates: exportRate.isDefault || slabs.isDefault,
      notes:
        'Export proceeds are taxed on gross value under Section 154A, so business expenses reduce only locally-sourced income.',
    };
  }
}
