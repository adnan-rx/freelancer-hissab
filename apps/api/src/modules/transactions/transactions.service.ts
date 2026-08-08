import { Injectable, Inject } from '@nestjs/common';
import { eq, desc } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import { income, expenses, clients } from '../../database/schema';

export type TransactionType = 'INCOME' | 'EXPENSE';

export interface UnifiedTransaction {
  id: string;
  type: TransactionType;
  date: string;
  amount: number;
  currency: string;
  description: string;
  category: string;
  entity: string; // client name or vendor
  createdAt: string;
}

@Injectable()
export class TransactionsService {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  async findAll(userId: string, query: { search?: string; type?: TransactionType }) {
    // 1. Fetch Income
    const incomeRecords = await this.db
      .select({
        id: income.id,
        amount: income.amountPKR,
        currency: income.currency, // We will just display 'PKR' as normalized currency for the UI
        description: income.description,
        category: income.category,
        clientName: clients.name,
        date: income.receivedAt,
        createdAt: income.createdAt,
      })
      .from(income)
      .leftJoin(clients, eq(income.clientId, clients.id))
      .where(eq(income.userId, userId));

    const mappedIncome: UnifiedTransaction[] = incomeRecords.map((inc) => ({
      id: inc.id,
      type: 'INCOME',
      date: inc.date.toISOString(),
      amount: parseFloat(inc.amount),
      currency: 'PKR', // normalize to PKR
      description: inc.description,
      category: inc.category || 'Direct Income',
      entity: inc.clientName || 'Direct',
      createdAt: inc.createdAt.toISOString(),
    }));

    // 2. Fetch Expenses
    const expenseRecords = await this.db
      .select()
      .from(expenses)
      .where(eq(expenses.userId, userId));

    const mappedExpenses: UnifiedTransaction[] = expenseRecords.map((exp) => ({
      id: exp.id,
      type: 'EXPENSE',
      date: exp.expenseDate, // this is a date string from DB
      amount: parseFloat(exp.amount),
      currency: exp.currency,
      description: exp.description,
      category: exp.category,
      entity: exp.vendor || 'General',
      createdAt: exp.createdAt.toISOString(),
    }));

    // 3. Combine
    let allTransactions = [...mappedIncome, ...mappedExpenses];

    // 4. Filter by Type
    if (query.type) {
      allTransactions = allTransactions.filter(t => t.type === query.type);
    }

    // 5. Filter by Search (description, entity, category)
    if (query.search) {
      const s = query.search.toLowerCase();
      allTransactions = allTransactions.filter(t => 
        t.description.toLowerCase().includes(s) ||
        t.entity.toLowerCase().includes(s) ||
        t.category.toLowerCase().includes(s)
      );
    }

    // 6. Sort by Date Descending
    allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return allTransactions;
  }
}
