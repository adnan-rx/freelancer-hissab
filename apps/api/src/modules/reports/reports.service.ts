import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import { income, expenses, clients } from '../../database/schema';

@Injectable()
export class ReportsService {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  async getIncomeVsExpenses(userId: string, period?: string) {
    const userIncome = await this.db.select().from(income).where(eq(income.userId, userId));
    const userExpenses = await this.db.select().from(expenses).where(eq(expenses.userId, userId));

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Simplistic aggregation by month for the current year
    const currentYear = new Date().getFullYear();
    
    const monthlyData = monthNames.map((month, index) => {
      const inc = userIncome.filter((i: any) => new Date(i.receivedAt || i.createdAt).getMonth() === index && new Date(i.receivedAt || i.createdAt).getFullYear() === currentYear)
        .reduce((sum: number, i: any) => sum + Number(i.amountPKR || 0), 0);
      
      const exp = userExpenses.filter((e: any) => new Date(e.expenseDate || e.createdAt).getMonth() === index && new Date(e.expenseDate || e.createdAt).getFullYear() === currentYear)
        .reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);
      
      return {
        month,
        income: inc,
        expenses: exp,
        profit: inc - exp,
      };
    });

    return monthlyData;
  }

  async getClientBreakdown(userId: string) {
    const userIncome = await this.db.select().from(income).where(eq(income.userId, userId));
    const userClients = await this.db.select().from(clients).where(eq(clients.userId, userId));

    const clientBreakdown: Record<string, number> = {};
    
    userIncome.forEach((inc: any) => {
      if (inc.clientId) {
        const client = userClients.find((c: any) => c.id === inc.clientId);
        const name = client ? client.name : 'Unknown';
        clientBreakdown[name] = (clientBreakdown[name] || 0) + Number(inc.amountPKR || 0);
      } else {
        clientBreakdown['Other'] = (clientBreakdown['Other'] || 0) + Number(inc.amountPKR || 0);
      }
    });

    return Object.keys(clientBreakdown).map((name) => ({ name, value: clientBreakdown[name] }));
  }

  async getPlatformBreakdown(userId: string) {
    const userIncome = await this.db.select().from(income).where(eq(income.userId, userId));
    
    const platformBreakdown: Record<string, number> = {};
    
    userIncome.forEach((inc: any) => {
      const platform = inc.platform || 'Other';
      platformBreakdown[platform] = (platformBreakdown[platform] || 0) + Number(inc.amountPKR || 0);
    });

    return Object.keys(platformBreakdown).map((name) => ({ name, value: platformBreakdown[name] }));
  }
}
