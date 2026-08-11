import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import { income, invoices, clients } from '../../database/schema';
import { CreateIncomeDto, UpdateIncomeDto } from './dto/income.dto';
import { ExchangeRateService } from '../exchange-rate/exchange-rate.service';
import { round2, round4 } from '../../common/money';

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
      return round4(explicitRate);
    }
    return round4(await this.exchangeRateService.getRate(currency, 'PKR'));
  }

  /**
   * Ids arriving in a request body must be proven to belong to the caller. The FK
   * only checks existence, so without this a user could attach their income to
   * another tenant's client and have it cascade-deleted from under them.
   */
  private async assertOwnsReferences(userId: string, clientId?: string | null, invoiceId?: string | null) {
    if (clientId) {
      const [row] = await this.db
        .select({ id: clients.id })
        .from(clients)
        .where(and(eq(clients.id, clientId), eq(clients.userId, userId)))
        .limit(1);
      if (!row) throw new NotFoundException('Client not found');
    }
    if (invoiceId) {
      const [row] = await this.db
        .select({ id: invoices.id })
        .from(invoices)
        .where(and(eq(invoices.id, invoiceId), eq(invoices.userId, userId)))
        .limit(1);
      if (!row) throw new NotFoundException('Invoice not found');
    }
  }

  /**
   * An invoice only becomes `paid` once the income logged against it covers its
   * total — a Rs 10 remittance used to close a Rs 9,999 invoice.
   */
  private async settleInvoiceIfFullyPaid(tx: any, userId: string, invoiceId: string) {
    const [invoice] = await tx
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.userId, userId)))
      .limit(1);
    if (!invoice || invoice.status === 'paid' || invoice.status === 'cancelled') return;

    const linked = await tx
      .select({ amountPKR: income.amountPKR })
      .from(income)
      .where(and(eq(income.invoiceId, invoiceId), eq(income.userId, userId)));

    const receivedPKR = linked.reduce((sum: number, row: any) => sum + Number(row.amountPKR || 0), 0);
    // Compare in PKR so a payment in a different currency still reconciles.
    // 1 rupee of slack absorbs rounding between the two conversions.
    if (receivedPKR + 1 < Number(invoice.totalPKR || 0)) return;

    await tx
      .update(invoices)
      .set({ status: 'paid', paidAt: new Date(), updatedAt: new Date() })
      .where(and(eq(invoices.id, invoiceId), eq(invoices.userId, userId)));
  }

  async create(userId: string, dto: CreateIncomeDto) {
    if (dto.amount <= 0) {
      throw new BadRequestException('Income amount must be greater than zero');
    }
    await this.assertOwnsReferences(userId, dto.clientId, dto.invoiceId);

    const currency = (dto.currency || 'USD').toUpperCase();
    const exchangeRate = await this.resolveRate(currency, dto.exchangeRate);
    const amountPKR = round2(dto.amount * exchangeRate);

    return this.db.transaction(async (tx: any) => {
      const [newIncome] = await tx.insert(income).values({
        userId,
        clientId: dto.clientId,
        invoiceId: dto.invoiceId,
        amount: round2(dto.amount).toString(),
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
        await this.settleInvoiceIfFullyPaid(tx, userId, dto.invoiceId);
      }

      return newIncome;
    });
  }

  async update(userId: string, id: string, dto: UpdateIncomeDto) {
    const existing = await this.findOne(userId, id);

    if (dto.amount !== undefined && dto.amount <= 0) {
      throw new BadRequestException('Income amount must be greater than zero');
    }
    await this.assertOwnsReferences(userId, dto.clientId, dto.invoiceId);

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

      updateData.amount = round2(amount).toString();
      updateData.currency = currency;
      updateData.exchangeRate = exchangeRate.toString();
      updateData.amountPKR = round2(amount * exchangeRate).toString();
    }

    // Drizzle throws "No values to set" on an empty object, which surfaced as a
    // 500 whenever a user saved an edit form without changing anything.
    if (Object.keys(updateData).length === 0) {
      return existing;
    }

    return this.db.transaction(async (tx: any) => {
      const [updated] = await tx
        .update(income)
        .set(updateData)
        .where(and(eq(income.id, id), eq(income.userId, userId)))
        .returning();

      // The amount may have changed, so re-evaluate whether the invoice is settled.
      const invoiceId = updated?.invoiceId ?? existing.invoiceId;
      if (invoiceId) {
        await this.settleInvoiceIfFullyPaid(tx, userId, invoiceId);
      }

      return updated;
    });
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
