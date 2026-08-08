import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import { expenses } from '../../database/schema';
import { CreateExpenseDto } from './dto/expense.dto';

@Injectable()
export class ExpensesService {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  async findAll(userId: string, query?: { category?: string }) {
    let whereClause: any = eq(expenses.userId, userId);

    if (query?.category) {
      whereClause = and(whereClause, eq(expenses.category, query.category as any));
    }

    return this.db.select().from(expenses).where(whereClause);
  }

  async create(userId: string, dto: CreateExpenseDto) {
    const [expense] = await this.db.insert(expenses).values({
      userId,
      amount: dto.amount.toString(),
      currency: dto.currency || 'PKR',
      category: dto.category as any,
      description: dto.description,
      vendor: dto.vendor,
      expenseDate: dto.expenseDate ? (typeof dto.expenseDate === 'string' ? dto.expenseDate : (dto.expenseDate as any).toISOString().split('T')[0]) : new Date().toISOString().split('T')[0],
    }).returning();

    return expense;
  }

  async delete(userId: string, id: string) {
    const result = await this.db
      .delete(expenses)
      .where(and(eq(expenses.id, id), eq(expenses.userId, userId)))
      .returning();

    if (!result.length) {
      throw new NotFoundException('Expense not found');
    }
    return result[0];
  }
}
