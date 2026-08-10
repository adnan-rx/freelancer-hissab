import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import { income, invoices } from '../../database/schema';
import { CreateIncomeDto, UpdateIncomeDto } from './dto/income.dto';
import { ExchangeRateService } from '../exchange-rate/exchange-rate.service';

@Injectable()
export class IncomeService {
  constructor(
    @Inject(DRIZZLE) private readonly db: any,
    private readonly exchangeRateService: ExchangeRateService,
  ) {}

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

  async findOne(userId: string, id: string) {
    const [record] = await this.db
      .select()
      .from(income)
      .where(and(eq(income.id, id), eq(income.userId, userId)))
      .limit(1);

    if (!record) throw new NotFoundException('Income not found');
    return record;
  }

  /**
   * Resolves the PKR rate for an amount. An explicit rate always wins so imports and
   * corrections stay reproducible; otherwise the live/cached rate for the currency is used.
   * PKR is always 1 — the previous hardcoded 280 fallback multiplied local income by 280.
   */
  private async resolveRate(currency: string, explicitRate?: number): Promise<number> {
    if (explicitRate !== undefined && explicitRate !== null && explicitRate > 0) {
      return explicitRate;
    }
    return this.exchangeRateService.getRate(currency, 'PKR');
  }

  async create(userId: string, dto: CreateIncomeDto) {
    if (dto.amount <= 0) {
      throw new BadRequestException('Income amount must be greater than zero');
    }

    const currency = (dto.currency || 'USD').toUpperCase();
    const exchangeRate = await this.resolveRate(currency, dto.exchangeRate);
    const amountPKR = Math.round(dto.amount * exchangeRate * 100) / 100;

    const [newIncome] = await this.db.insert(income).values({
      userId,
      clientId: dto.clientId,
      invoiceId: dto.invoiceId,
      amount: dto.amount.toString(),
      currency,
      exchangeRate: exchangeRate.toString(),
      amountPKR: amountPKR.toString(),
      platform: dto.platform as any,
      description: dto.description,
      category: dto.category,
      sbpPurposeCode: dto.sbpPurposeCode || (currency !== 'PKR' ? '9100' : null),
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

  async update(userId: string, id: string, dto: UpdateIncomeDto) {
    const existing = await this.findOne(userId, id);

    if (dto.amount !== undefined && dto.amount <= 0) {
      throw new BadRequestException('Income amount must be greater than zero');
    }

    const updateData: Record<string, any> = {};

    if (dto.clientId !== undefined) updateData.clientId = dto.clientId || null;
    if (dto.platform !== undefined) updateData.platform = dto.platform as any;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.category !== undefined) updateData.category = dto.category;
    if (dto.sbpPurposeCode !== undefined) updateData.sbpPurposeCode = dto.sbpPurposeCode;
    if (dto.prcReferenceNumber !== undefined) updateData.prcReferenceNumber = dto.prcReferenceNumber;
    if (dto.receivedAt !== undefined) updateData.receivedAt = new Date(dto.receivedAt);

    // Any change to amount, currency or rate forces a PKR recompute so the ledger
    // can never drift from the figures every report and tax estimate reads.
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
      .update(income)
      .set(updateData)
      .where(and(eq(income.id, id), eq(income.userId, userId)))
      .returning();

    return updated;
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
