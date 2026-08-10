import { Injectable, Inject, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { eq, and, or, ilike } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import { invoices, invoiceItems, clients, users, income } from '../../database/schema';
import { CreateInvoiceDto, UpdateInvoiceDto } from './dto/invoice.dto';
import { ExchangeRateService } from '../exchange-rate/exchange-rate.service';
import { round2, round4 } from '../../common/money';

/**
 * Which status a given status may move to. `paid` and `cancelled` are terminal —
 * an issued invoice is a tax document, so it is never silently rewritten.
 * Enforced by BOTH `update()` and `updateStatus()`; previously only `update()`
 * carried the rules, so PATCH /invoices/:id/status bypassed every lock.
 */
const ALLOWED_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ['draft', 'sent', 'cancelled'],
  sent: ['sent', 'viewed', 'overdue', 'paid', 'cancelled'],
  viewed: ['viewed', 'sent', 'overdue', 'paid', 'cancelled'],
  overdue: ['overdue', 'sent', 'viewed', 'paid', 'cancelled'],
  paid: [],
  cancelled: [],
};

@Injectable()
export class InvoicesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: any,
    private readonly exchangeRateService: ExchangeRateService,
  ) {}

  /**
   * A client id arriving from the request body must be proven to belong to the
   * caller. Without this an invoice could be attached to another tenant's client,
   * and that client's owner would then cascade-delete an invoice they cannot see.
   */
  private async assertOwnsClient(userId: string, clientId: string) {
    const [row] = await this.db
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.id, clientId), eq(clients.userId, userId)))
      .limit(1);
    if (!row) throw new NotFoundException('Client not found');
  }

  private assertMoneyBounds(taxRate: number, discountAmount: number) {
    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
      throw new BadRequestException('Tax rate must be between 0 and 100');
    }
    if (!Number.isFinite(discountAmount) || discountAmount < 0) {
      throw new BadRequestException('Discount amount cannot be negative');
    }
  }

  /** Explicit rate wins (imports/corrections stay reproducible); otherwise the live rate. */
  private async resolveRate(currency: string, explicitRate?: number): Promise<number> {
    if (explicitRate !== undefined && explicitRate !== null && explicitRate > 0) {
      return round4(explicitRate);
    }
    return round4(await this.exchangeRateService.getRate(currency, 'PKR'));
  }

  /**
   * Single source of truth for invoice arithmetic. `totalPKR` is derived from the
   * already-rounded `total` so the stored figures reconcile exactly.
   */
  private computeTotals(
    items: Array<{ quantity: number; rate: number }>,
    taxRate: number,
    discountAmount: number,
    exchangeRate: number,
  ) {
    let subtotal = 0;
    items.forEach((item) => {
      if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
        throw new BadRequestException('Item quantity must be greater than zero');
      }
      if (!Number.isFinite(item.rate) || item.rate < 0) {
        throw new BadRequestException('Item rate cannot be negative');
      }
      subtotal += item.quantity * item.rate;
    });

    subtotal = round2(subtotal);
    const taxAmount = round2(subtotal * (taxRate / 100));
    const total = round2(subtotal + taxAmount - discountAmount);

    if (total < 0) {
      throw new BadRequestException('Invoice total cannot be negative — check the discount amount');
    }

    return { subtotal, taxAmount, total, totalPKR: round2(total * exchangeRate) };
  }

  async findAll(userId: string, query?: { status?: string; clientId?: string; search?: string }) {
    let whereClause: any = eq(invoices.userId, userId);

    if (query?.status) {
      whereClause = and(whereClause, eq(invoices.status, query.status as any));
    }
    if (query?.clientId) {
      whereClause = and(whereClause, eq(invoices.clientId, query.clientId));
    }
    if (query?.search) {
      // Match on invoice number or client name — the UI offers both.
      const term = `%${query.search}%`;
      whereClause = and(whereClause, or(ilike(invoices.invoiceNumber, term), ilike(clients.name, term)));
    }

    const result = await this.db
      .select({
        invoice: invoices,
        client: clients,
      })
      .from(invoices)
      .leftJoin(clients, eq(invoices.clientId, clients.id))
      .where(whereClause);

    return result.map((r: any) => ({ ...r.invoice, client: r.client }));
  }

  async findOne(userId: string, id: string) {
    const invoiceResult = await this.db
      .select({
        invoice: invoices,
        client: clients,
      })
      .from(invoices)
      .leftJoin(clients, eq(invoices.clientId, clients.id))
      .where(and(eq(invoices.id, id), eq(invoices.userId, userId)))
      .limit(1);

    if (!invoiceResult.length) {
      throw new NotFoundException('Invoice not found');
    }

    const items = await this.db
      .select()
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, id))
      .orderBy(invoiceItems.sortOrder);

    return { ...invoiceResult[0].invoice, client: invoiceResult[0].client, items };
  }

  /** Next sequential number for this user, honouring their configured prefix. */
  async nextInvoiceNumber(userId: string): Promise<string> {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    const prefix = user?.invoicePrefix || `FH-${new Date().getFullYear()}-`;

    const existing = await this.db
      .select({ invoiceNumber: invoices.invoiceNumber })
      .from(invoices)
      .where(eq(invoices.userId, userId));

    const taken = new Set(existing.map((inv: any) => inv.invoiceNumber));
    let sequence = existing.length + 1;
    let candidate = `${prefix}${sequence.toString().padStart(4, '0')}`;
    while (taken.has(candidate)) {
      sequence++;
      candidate = `${prefix}${sequence.toString().padStart(4, '0')}`;
    }
    return candidate;
  }

  async create(userId: string, dto: CreateInvoiceDto) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('An invoice must contain at least one line item');
    }

    const taxRate = Number(dto.taxRate || 0);
    const discountAmount = Number(dto.discountAmount || 0);
    this.assertMoneyBounds(taxRate, discountAmount);

    let targetClientId = dto.clientId;

    if (targetClientId) {
      // Never trust a client id from the body — it must belong to this user.
      await this.assertOwnsClient(userId, targetClientId);
    } else {
      const clientName = dto.clientName?.trim() || 'Direct Client';
      const existingClient = await this.db
        .select()
        .from(clients)
        .where(and(eq(clients.userId, userId), eq(clients.name, clientName)))
        .limit(1);

      if (existingClient.length > 0) {
        targetClientId = existingClient[0].id;
      } else {
        const [newClient] = await this.db
          .insert(clients)
          .values({
            userId,
            name: clientName,
            email: dto.clientEmail || null,
            platform: 'direct',
            currency: dto.currency || 'USD',
          })
          .returning();
        targetClientId = newClient.id;
      }
    }

    let invoiceNumber = dto.invoiceNumber?.trim();

    if (invoiceNumber) {
      // The DB has a unique (invoice_number, user_id) index; surface a readable
      // conflict instead of letting the raw constraint error escape as a 500.
      const [clash] = await this.db
        .select({ id: invoices.id })
        .from(invoices)
        .where(and(eq(invoices.userId, userId), eq(invoices.invoiceNumber, invoiceNumber)))
        .limit(1);
      if (clash) {
        throw new ConflictException(`Invoice number "${invoiceNumber}" already exists. Choose a different number.`);
      }
    } else {
      invoiceNumber = await this.nextInvoiceNumber(userId);
    }

    const currency = dto.currency || 'USD';
    const exchangeRate = await this.resolveRate(currency, dto.exchangeRate);
    const items = dto.items.map((it) => ({ ...it, quantity: Number(it.quantity), rate: Number(it.rate) }));
    const totals = this.computeTotals(items, taxRate, discountAmount, exchangeRate);
    const initialStatus = dto.status === 'draft' ? 'draft' : 'sent';

    const invoiceId = await this.db.transaction(async (tx: any) => {
      const [invoice] = await tx.insert(invoices).values({
        userId,
        clientId: targetClientId,
        invoiceNumber,
        dueDate: this.toDateString(dto.dueDate),
        currency,
        exchangeRate: exchangeRate.toString(),
        subtotal: totals.subtotal.toString(),
        taxRate: taxRate.toString(),
        taxAmount: totals.taxAmount.toString(),
        discountAmount: discountAmount.toString(),
        total: totals.total.toString(),
        totalPKR: totals.totalPKR.toString(),
        notes: dto.notes,
        status: initialStatus,
      }).returning();

      await tx.insert(invoiceItems).values(
        items.map((item, idx) => ({
          invoiceId: invoice.id,
          description: item.description,
          quantity: item.quantity.toString(),
          rate: item.rate.toString(),
          amount: round2(item.quantity * item.rate).toString(),
          sortOrder: idx,
        })),
      );

      return invoice.id;
    });

    return this.findOne(userId, invoiceId);
  }

  private toDateString(value?: Date | string | null): string | null {
    if (!value) return null;
    return typeof value === 'string' ? value : (value as Date).toISOString().split('T')[0];
  }

  async update(userId: string, id: string, dto: UpdateInvoiceDto) {
    const existing = await this.findOne(userId, id);

    if (existing.status === 'paid') {
      throw new BadRequestException('Paid invoices are legally locked to maintain tax compliance & PRC audit records and cannot be edited.');
    }

    if (existing.status === 'cancelled') {
      throw new BadRequestException('Cancelled invoices are archived for audit trail purposes and cannot be edited.');
    }

    const isDraft = existing.status === 'draft';

    let targetClientId = existing.clientId;
    if (isDraft && dto.clientId && dto.clientId !== existing.clientId) {
      await this.assertOwnsClient(userId, dto.clientId);
      targetClientId = dto.clientId;
    }

    let invoiceNumber = existing.invoiceNumber;
    if (isDraft && dto.invoiceNumber && dto.invoiceNumber.trim() !== existing.invoiceNumber) {
      const trimmed = dto.invoiceNumber.trim();
      const existingWithSameNumber = await this.db
        .select({ id: invoices.id })
        .from(invoices)
        .where(and(eq(invoices.userId, userId), eq(invoices.invoiceNumber, trimmed)))
        .limit(1);

      if (existingWithSameNumber.length > 0 && existingWithSameNumber[0].id !== id) {
        throw new ConflictException(`Invoice number "${trimmed}" already exists. Choose a different number.`);
      }
      invoiceNumber = trimmed;
    }

    const currency = dto.currency || existing.currency || 'USD';
    const currencyChanged = !!dto.currency && dto.currency !== existing.currency;
    const exchangeRate =
      dto.exchangeRate !== undefined
        ? await this.resolveRate(currency, Number(dto.exchangeRate))
        : currencyChanged
          ? await this.resolveRate(currency)
          : round4(Number(existing.exchangeRate || 1));

    const taxRate = dto.taxRate !== undefined ? Number(dto.taxRate) : Number(existing.taxRate || 0);
    const discountAmount =
      dto.discountAmount !== undefined ? Number(dto.discountAmount) : Number(existing.discountAmount || 0);
    this.assertMoneyBounds(taxRate, discountAmount);

    const dueDate = dto.dueDate !== undefined ? this.toDateString(dto.dueDate) : (existing.dueDate || null);
    const notes = dto.notes !== undefined ? dto.notes : existing.notes;

    // Status transition rules — the same table `updateStatus` uses.
    let newStatus = existing.status;
    if (dto.status && dto.status !== existing.status) {
      if (dto.status === 'paid') {
        throw new BadRequestException('Use the status endpoint or record income remittance to mark an invoice as paid.');
      }
      this.assertTransitionAllowed(existing.status, dto.status);
      newStatus = dto.status as any;
    }

    if (dto.items && dto.items.length === 0) {
      throw new BadRequestException('An invoice must contain at least one line item');
    }

    const itemsToProcess: Array<{ description: string; quantity: number; rate: number }> =
      dto.items && dto.items.length > 0
        ? dto.items.map((it) => ({
            description: it.description,
            quantity: Number(it.quantity),
            rate: Number(it.rate),
          }))
        : (existing.items || []).map((it: any) => ({
            description: it.description,
            quantity: Number(it.quantity),
            rate: Number(it.rate),
          }));

    if (itemsToProcess.length === 0) {
      throw new BadRequestException('An invoice must contain at least one line item');
    }

    const totals = this.computeTotals(itemsToProcess, taxRate, discountAmount, exchangeRate);

    await this.db.transaction(async (tx: any) => {
      await tx
        .update(invoices)
        .set({
          clientId: targetClientId,
          invoiceNumber,
          dueDate,
          currency,
          exchangeRate: exchangeRate.toString(),
          subtotal: totals.subtotal.toString(),
          taxRate: taxRate.toString(),
          taxAmount: totals.taxAmount.toString(),
          discountAmount: discountAmount.toString(),
          total: totals.total.toString(),
          totalPKR: totals.totalPKR.toString(),
          status: newStatus,
          notes,
          updatedAt: new Date(),
        })
        .where(and(eq(invoices.id, id), eq(invoices.userId, userId)));

      if (dto.items && dto.items.length > 0) {
        await tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
        await tx.insert(invoiceItems).values(
          dto.items.map((item, idx) => ({
            invoiceId: id,
            description: item.description,
            quantity: Number(item.quantity).toString(),
            rate: Number(item.rate).toString(),
            amount: round2(Number(item.quantity) * Number(item.rate)).toString(),
            sortOrder: idx,
          })),
        );
      }
    });

    return this.findOne(userId, id);
  }

  private assertTransitionAllowed(from: string, to: string) {
    const allowed = ALLOWED_STATUS_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      if (from === 'paid') {
        throw new BadRequestException(
          'Paid invoices are legally locked to maintain tax compliance & PRC audit records and cannot change status.',
        );
      }
      if (from === 'cancelled') {
        throw new BadRequestException('Cancelled invoices are archived for audit trail purposes and cannot change status.');
      }
      throw new BadRequestException(`An invoice cannot move from "${from}" to "${to}".`);
    }
  }

  /**
   * Marking an invoice paid also records the matching income, in one transaction.
   * Without it the money left "pending" without ever entering the ledger every
   * report, tax estimate and wealth reconciliation reads from.
   */
  async updateStatus(userId: string, id: string, status: string) {
    const existing = await this.findOne(userId, id);

    if (status === existing.status) {
      return existing;
    }
    this.assertTransitionAllowed(existing.status, status);

    await this.db.transaction(async (tx: any) => {
      await tx
        .update(invoices)
        .set({
          status: status as any,
          paidAt: status === 'paid' ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(and(eq(invoices.id, id), eq(invoices.userId, userId)));

      if (status !== 'paid') return;

      const [alreadyLogged] = await tx
        .select({ id: income.id })
        .from(income)
        .where(and(eq(income.invoiceId, id), eq(income.userId, userId)))
        .limit(1);
      if (alreadyLogged) return;

      await tx.insert(income).values({
        userId,
        clientId: existing.clientId,
        invoiceId: id,
        amount: existing.total,
        currency: existing.currency,
        exchangeRate: existing.exchangeRate,
        amountPKR: existing.totalPKR,
        platform: (existing.client?.platform as any) || 'direct',
        description: `Payment received for invoice ${existing.invoiceNumber}`,
        sbpPurposeCode: existing.currency !== 'PKR' ? '9100' : null,
        receivedAt: new Date(),
      });
    });

    return this.findOne(userId, id);
  }

  /**
   * Ownership is checked BEFORE anything is deleted. The line-item delete used to
   * run first, scoped only by invoiceId, which let any authenticated user strip
   * the items off another tenant's invoice and get a 404 as if nothing happened.
   */
  async delete(userId: string, id: string) {
    const existing = await this.findOne(userId, id);

    if (existing.status === 'paid') {
      throw new BadRequestException(
        'Paid invoices are legally locked to maintain tax compliance & PRC audit records and cannot be deleted. Cancel it instead.',
      );
    }

    await this.db.transaction(async (tx: any) => {
      await tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
      await tx.delete(invoices).where(and(eq(invoices.id, id), eq(invoices.userId, userId)));
    });

    return existing;
  }
}
