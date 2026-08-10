import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
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

export type TransactionSortKey = 'date' | 'entity' | 'category' | 'amount';

export interface FindTransactionsQuery {
  search?: string;
  type?: TransactionType;
  /** Inclusive, 'YYYY-MM-DD'. Filters on the transaction's own date, not createdAt. */
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
  sortBy?: TransactionSortKey;
  sortDir?: 'asc' | 'desc';
}

export interface PaginatedTransactions {
  data: UnifiedTransaction[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 200;

@Injectable()
export class TransactionsService {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  async findAll(userId: string, query: FindTransactionsQuery): Promise<PaginatedTransactions> {
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

    const mappedIncome: UnifiedTransaction[] = incomeRecords.map((inc: any) => ({
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
    const expenseRecords = await this.db.select().from(expenses).where(eq(expenses.userId, userId));

    const mappedExpenses: UnifiedTransaction[] = expenseRecords.map((exp: any) => ({
      id: exp.id,
      type: 'EXPENSE',
      date: exp.expenseDate, // this is a date string from DB
      // Normalised to PKR like income, so the two sides of the ledger are comparable.
      amount: parseFloat(exp.amountPKR ?? exp.amount),
      currency: 'PKR',
      description: exp.description,
      category: exp.category,
      entity: exp.vendor || 'General',
      createdAt: exp.createdAt.toISOString(),
    }));

    // 3. Combine
    let allTransactions = [...mappedIncome, ...mappedExpenses];

    // 4. Filter by Type
    if (query.type) {
      allTransactions = allTransactions.filter((t) => t.type === query.type);
    }

    // 5. Filter by Search (description, entity, category)
    if (query.search) {
      const s = query.search.toLowerCase();
      allTransactions = allTransactions.filter(
        (t) =>
          t.description.toLowerCase().includes(s) ||
          t.entity.toLowerCase().includes(s) ||
          t.category.toLowerCase().includes(s),
      );
    }

    // 6. Filter by date range — inclusive on both ends, comparing calendar days so a
    // start/end of the same day never excludes same-day transactions on a timezone quirk.
    if (query.startDate) {
      const start = new Date(`${query.startDate}T00:00:00.000Z`).getTime();
      allTransactions = allTransactions.filter((t) => new Date(t.date).getTime() >= start);
    }
    if (query.endDate) {
      const end = new Date(`${query.endDate}T23:59:59.999Z`).getTime();
      allTransactions = allTransactions.filter((t) => new Date(t.date).getTime() <= end);
    }

    // 7. Sort — was hardcoded to date descending, so clicking any other
    // column header only reordered the 20 rows already on the current page
    // instead of the full result set behind the pagination.
    const sortKey = query.sortBy || 'date';
    const sortDir = query.sortDir === 'asc' ? 1 : -1;
    const sortValue = (t: UnifiedTransaction): string | number => {
      switch (sortKey) {
        case 'amount':
          return t.amount;
        case 'entity':
          return t.entity.toLowerCase();
        case 'category':
          return t.category.toLowerCase();
        default:
          return new Date(t.date).getTime();
      }
    };
    allTransactions.sort((a, b) => {
      const av = sortValue(a);
      const bv = sortValue(b);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return cmp * sortDir;
    });

    // 8. Paginate
    const total = allTransactions.length;
    const pageSize = Math.min(Math.max(1, query.pageSize || DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(Math.max(1, query.page || 1), totalPages);
    const offset = (page - 1) * pageSize;

    return {
      data: allTransactions.slice(offset, offset + pageSize),
      total,
      page,
      pageSize,
      totalPages,
    };
  }
}
