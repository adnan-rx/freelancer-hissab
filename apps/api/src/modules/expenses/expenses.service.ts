import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import { expenses } from '../../database/schema';
import { CreateExpenseDto, UpdateExpenseDto } from './dto/expense.dto';
import { ExchangeRateService } from '../exchange-rate/exchange-rate.service';

@Injectable()
export class ExpensesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: any,
    private readonly exchangeRateService: ExchangeRateService,
  ) {}

  async findAll(userId: string, query?: { category?: string }) {
    let whereClause: any = eq(expenses.userId, userId);

    if (query?.category) {
      whereClause = and(whereClause, eq(expenses.category, query.category as any));
    }

    return this.db.select().from(expenses).where(whereClause);
  }

  async findOne(userId: string, id: string) {
    const [record] = await this.db
      .select()
      .from(expenses)
      .where(and(eq(expenses.id, id), eq(expenses.userId, userId)))
      .limit(1);

    if (!record) throw new NotFoundException('Expense not found');
    return record;
  }

  private async resolveRate(currency: string, explicitRate?: number): Promise<number> {
    if (explicitRate !== undefined && explicitRate !== null && explicitRate > 0) {
      return explicitRate;
    }
    return this.exchangeRateService.getRate(currency, 'PKR');
  }

  private toDateString(value?: Date | string): string {
    if (!value) return new Date().toISOString().split('T')[0];
    return typeof value === 'string' ? value : value.toISOString().split('T')[0];
  }

  async create(userId: string, dto: CreateExpenseDto) {
    if (dto.amount <= 0) {
      throw new BadRequestException('Expense amount must be greater than zero');
    }

    const currency = (dto.currency || 'PKR').toUpperCase();
    const exchangeRate = await this.resolveRate(currency, dto.exchangeRate);
    const amountPKR = Math.round(dto.amount * exchangeRate * 100) / 100;

    const [expense] = await this.db.insert(expenses).values({
      userId,
      amount: dto.amount.toString(),
      currency,
      exchangeRate: exchangeRate.toString(),
      amountPKR: amountPKR.toString(),
      category: dto.category as any,
      description: dto.description,
      vendor: dto.vendor,
      expenseDate: this.toDateString(dto.expenseDate),
    }).returning();

    return expense;
  }

  async update(userId: string, id: string, dto: UpdateExpenseDto) {
    const existing = await this.findOne(userId, id);

    if (dto.amount !== undefined && dto.amount <= 0) {
      throw new BadRequestException('Expense amount must be greater than zero');
    }

    const updateData: Record<string, any> = {};

    if (dto.category !== undefined) updateData.category = dto.category as any;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.vendor !== undefined) updateData.vendor = dto.vendor;
    if (dto.expenseDate !== undefined) updateData.expenseDate = this.toDateString(dto.expenseDate);

    const amountChanged = dto.amount !== undefined;
    const currencyChanged = dto.currency !== undefined;
    const rateChanged = dto.exchangeRate !== undefined;

    if (amountChanged || currencyChanged || rateChanged) {
      const amount = dto.amount ?? Number(existing.amount);
      const currency = (dto.currency ?? existing.currency).toUpperCase();
      const exchangeRate = rateChanged
        ? await this.resolveRate(currency, dto.exchangeRate)
        : currencyChanged
          ? await this.resolveRate(currency)
          : Number(existing.exchangeRate);

      updateData.amount = amount.toString();
      updateData.currency = currency;
      updateData.exchangeRate = exchangeRate.toString();
      updateData.amountPKR = (Math.round(amount * exchangeRate * 100) / 100).toString();
    }

    const [updated] = await this.db
      .update(expenses)
      .set(updateData)
      .where(and(eq(expenses.id, id), eq(expenses.userId, userId)))
      .returning();

    return updated;
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
