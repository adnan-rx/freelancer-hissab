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
    const totalExpenses = userExpenses.reduce((sum: number, exp: any) => sum + Number(exp.amount || 0), 0);
    const netProfit = totalIncome - totalExpenses;

    const pendingInvoices = userInvoices.filter((inv: any) => inv.status !== 'paid' && inv.status !== 'cancelled');
    const pendingAmount = pendingInvoices.reduce((sum: number, inv: any) => sum + Number(inv.totalPKR || 0), 0);

    return {
      totalIncome,
      totalExpenses,
      netProfit,
      pendingInvoices: pendingInvoices.length,
      pendingAmount,
      monthlyGrowth: 12.5,
      currency: 'PKR',
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
