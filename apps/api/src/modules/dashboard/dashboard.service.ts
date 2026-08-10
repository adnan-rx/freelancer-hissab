import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import { income, expenses, invoices } from '../../database/schema';
import { taxYearRange, incomeInTaxYear, expensesInTaxYear, isWithinTaxYear } from '../../common/tax-year';
import { round2 } from '../../common/money';

/** Statuses that represent money genuinely owed to the user. */
const PENDING_INVOICE_STATUSES = ['sent', 'viewed', 'overdue'];

@Injectable()
export class DashboardService {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  /**
   * Scoped to a Pakistani tax year, like every other financial surface.
   * These totals used to be lifetime sums with no period filter at all, so the
   * dashboard disagreed with the tax estimate and the reports page on the same data.
   */
  async getSummary(userId: string, year?: string) {
    const range = taxYearRange(year);

    const allIncome = await this.db.select().from(income).where(eq(income.userId, userId));
    const allExpenses = await this.db.select().from(expenses).where(eq(expenses.userId, userId));
    const allInvoices = await this.db.select().from(invoices).where(eq(invoices.userId, userId));

    const userIncome = incomeInTaxYear(allIncome, range);
    const userExpenses = expensesInTaxYear(allExpenses, range);
    const userInvoices = allInvoices.filter((inv: any) => isWithinTaxYear(inv.createdAt, range));

    const totalIncome = userIncome.reduce((sum: number, inc: any) => sum + Number(inc.amountPKR || 0), 0);
    const totalExpenses = userExpenses.reduce((sum: number, exp: any) => sum + Number(exp.amountPKR || 0), 0);
    const netProfit = totalIncome - totalExpenses;

    // Drafts have never been sent to anyone, so they are not money owed.
    const pendingInvoices = userInvoices.filter((inv: any) => PENDING_INVOICE_STATUSES.includes(inv.status));
    const pendingAmount = pendingInvoices.reduce((sum: number, inv: any) => sum + Number(inv.totalPKR || 0), 0);

    const draftInvoices = userInvoices.filter((inv: any) => inv.status === 'draft');

    return {
      taxYear: range.taxYear,
      taxYearLabel: range.label,
      periodStart: range.start.toISOString().split('T')[0],
      periodEnd: new Date(range.end.getTime() - 86400000).toISOString().split('T')[0],
      totalIncome: round2(totalIncome),
      totalExpenses: round2(totalExpenses),
      netProfit: round2(netProfit),
      pendingInvoices: pendingInvoices.length,
      pendingAmount: round2(pendingAmount),
      draftInvoices: draftInvoices.length,
      ...this.calculateGrowth(userIncome, userExpenses),
      currency: 'PKR',
    };
  }

  /**
   * Month-over-month change comparing like with like: the current month up to
   * today against the SAME number of days last month. Comparing a partial month
   * against a full one reported ~-90% growth on the 3rd of every month.
   * Returns null when the prior window has no data to compare against.
   */
  private calculateGrowth(userIncome: any[], userExpenses: any[]) {
    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Same elapsed span last month, clamped so a 31st never overflows a short month.
    const elapsedMs = now.getTime() - startOfThisMonth.getTime();
    const endOfLastMonthWindow = new Date(
      Math.min(startOfLastMonth.getTime() + elapsedMs, startOfThisMonth.getTime()),
    );

    const sumBetween = (rows: any[], dateKey: string, amountKey: string, from: Date, to: Date) =>
      rows.reduce((sum, row) => {
        const date = new Date(row[dateKey] || row.createdAt);
        return date >= from && date < to ? sum + Number(row[amountKey] || 0) : sum;
      }, 0);

    const change = (current: number, previous: number): number | null => {
      if (previous <= 0) return null;
      return Math.round(((current - previous) / previous) * 100 * 10) / 10;
    };

    const incomeThis = sumBetween(userIncome, 'receivedAt', 'amountPKR', startOfThisMonth, now);
    const incomeLast = sumBetween(userIncome, 'receivedAt', 'amountPKR', startOfLastMonth, endOfLastMonthWindow);
    const expenseThis = sumBetween(userExpenses, 'expenseDate', 'amountPKR', startOfThisMonth, now);
    const expenseLast = sumBetween(userExpenses, 'expenseDate', 'amountPKR', startOfLastMonth, endOfLastMonthWindow);

    return {
      monthlyGrowth: change(incomeThis, incomeLast),
      expenseGrowth: change(expenseThis, expenseLast),
    };
  }
}
