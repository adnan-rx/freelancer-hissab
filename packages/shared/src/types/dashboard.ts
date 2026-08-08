export interface DashboardSummary {
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  pendingInvoices: number;
  pendingAmount: number;
  monthlyGrowth: number;
  currency: string;
}

export interface RecentActivity {
  id: string;
  type: 'income' | 'expense' | 'invoice';
  description: string;
  amount: number;
  currency: string;
  date: string;
}

export interface MonthlyBreakdown {
  month: string;
  income: number;
  expenses: number;
  profit: number;
}
