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

  async getIncomeConsolidation(userId: string, year?: string) {
    // Optional: filter by year if provided (e.g., '2025' or '2025-26')
    let userIncome = await this.db.select().from(income).where(eq(income.userId, userId));
    
    if (year) {
      const yearStart = parseInt(year.substring(0, 4));
      // Very simplistic yearly filter - assuming tax year July-June for PK
      userIncome = userIncome.filter((inc: any) => {
        const date = new Date(inc.receivedAt || inc.createdAt);
        if (year.length > 4) {
          // e.g. 2025-26
          return (date.getFullYear() === yearStart && date.getMonth() >= 6) || 
                 (date.getFullYear() === yearStart + 1 && date.getMonth() < 6);
        }
        return date.getFullYear() === yearStart;
      });
    }

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
      totalPKR,
      byPlatform,
      trackedPercentage,
      unmatchedPercentage,
    };
  }
}
