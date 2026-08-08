import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import { income, invoices } from '../../database/schema';
import { CreateIncomeDto } from './dto/income.dto';

@Injectable()
export class IncomeService {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  async findAll(userId: string, query?: { clientId?: string; platform?: string }) {
    let whereClause: any = eq(income.userId, userId);

    if (query?.clientId) {
      whereClause = and(whereClause, eq(income.clientId, query.clientId));
    }
    if (query?.platform) {
      whereClause = and(whereClause, eq(income.platform, query.platform as any));
    }

    return this.db.select().from(income).where(whereClause);
  }

  async create(userId: string, dto: CreateIncomeDto) {
    const exchangeRate = dto.exchangeRate || 280;
    const amountPKR = dto.amount * exchangeRate;

    const [newIncome] = await this.db.insert(income).values({
      userId,
      clientId: dto.clientId,
      invoiceId: dto.invoiceId,
      amount: dto.amount.toString(),
      currency: dto.currency,
      exchangeRate: exchangeRate.toString(),
      amountPKR: amountPKR.toString(),
      platform: dto.platform as any,
      description: dto.description,
      category: dto.category,
      sbpPurposeCode: dto.sbpPurposeCode || '9100',
      prcReferenceNumber: dto.prcReferenceNumber,
      receivedAt: dto.receivedAt ? new Date(dto.receivedAt) : new Date(),
    }).returning();

    if (dto.invoiceId) {
      await this.db
        .update(invoices)
        .set({ status: 'paid', updatedAt: new Date() })
        .where(and(eq(invoices.id, dto.invoiceId), eq(invoices.userId, userId)));
    }

    return newIncome;
  }

  async delete(userId: string, id: string) {
    const result = await this.db
      .delete(income)
      .where(and(eq(income.id, id), eq(income.userId, userId)))
      .returning();

    if (!result.length) {
      throw new NotFoundException('Income not found');
    }
    return result[0];
  }
}
