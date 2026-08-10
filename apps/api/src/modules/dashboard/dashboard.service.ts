import { Injectable, Inject } from '@nestjs/common';
import { eq, desc } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import { income, expenses, invoices } from '../../database/schema';

@Injectable()
export class DashboardService {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  async getSummary(userId: string) {
    const userIncome = await this.db.select().from(income).where(eq(income.userId, userId));
    const userExpenses = await this.db.select().from(expenses).where(eq(expenses.userId, userId));
    const userInvoices = await this.db.select().from(invoices).where(eq(invoices.userId, userId));

    const totalIncome = userIncome.reduce((sum: number, inc: any) => sum + Number(inc.amountPKR || 0), 0);
    const totalExpenses = userExpenses.reduce((sum: number, exp: any) => sum + Number(exp.amountPKR || 0), 0);
    const netProfit = totalIncome - totalExpenses;

    const pendingInvoices = userInvoices.filter((inv: any) => inv.status !== 'paid' && inv.status !== 'cancelled');
    const pendingAmount = pendingInvoices.reduce((sum: number, inv: any) => sum + Number(inv.totalPKR || 0), 0);

    return {
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      netProfit: Math.round(netProfit * 100) / 100,
      pendingInvoices: pendingInvoices.length,
      pendingAmount: Math.round(pendingAmount * 100) / 100,
      ...this.calculateGrowth(userIncome, userExpenses),
      currency: 'PKR',
    };
  }

  /**
   * Month-over-month change, replacing the previously hardcoded 12.5%.
   * Returns null when the prior month has no data — the UI must not show a
   * percentage it cannot derive.
   */
  private calculateGrowth(userIncome: any[], userExpenses: any[]) {
    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

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
    const incomeLast = sumBetween(userIncome, 'receivedAt', 'amountPKR', startOfLastMonth, startOfThisMonth);
    const expenseThis = sumBetween(userExpenses, 'expenseDate', 'amountPKR', startOfThisMonth, now);
    const expenseLast = sumBetween(userExpenses, 'expenseDate', 'amountPKR', startOfLastMonth, startOfThisMonth);

    return {
      monthlyGrowth: change(incomeThis, incomeLast),
      expenseGrowth: change(expenseThis, expenseLast),
    };
  }

  async getRecentActivity(userId: string) {
    const userIncome = await this.db.select().from(income).where(eq(income.userId, userId)).orderBy(desc(income.createdAt)).limit(5);
    const userExpenses = await this.db.select().from(expenses).where(eq(expenses.userId, userId)).orderBy(desc(expenses.createdAt)).limit(5);
    const userInvoices = await this.db.select().from(invoices).where(eq(invoices.userId, userId)).orderBy(desc(invoices.createdAt)).limit(5);

    const activity = [
      ...userIncome.map((inc: any) => ({ type: 'income', data: inc, date: inc.createdAt })),
      ...userExpenses.map((exp: any) => ({ type: 'expense', data: exp, date: exp.createdAt })),
      ...userInvoices.map((inv: any) => ({ type: 'invoice', data: inv, date: inv.createdAt })),
    ];

    activity.sort((a: any, b: any) => b.date.getTime() - a.date.getTime());

    return activity.slice(0, 10);
  }
}
