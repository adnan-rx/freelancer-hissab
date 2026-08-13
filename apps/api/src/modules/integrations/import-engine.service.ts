import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq, isNotNull, and } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { Database, DbHandle } from '../../database/types';
import { clients, expenses, income, invoiceItems, invoices } from '../../database/schema';
import { ExchangeRateService } from '../exchange-rate/exchange-rate.service';
import { round2, round4 } from '../../common/money';
import {
  ImportPreview,
  ImportSummary,
  NormalizedTransaction,
  PlatformId,
  PreviewLineItem,
} from './interfaces/normalized-transaction.interface';

/** Preview lines returned to the UI. The counts and totals always cover every row. */
const MAX_PREVIEW_ITEMS = 50;

/** `client_platform` is a Postgres enum; anything outside it lands on `other`. */
const DB_PLATFORMS = ['upwork', 'fiverr', 'freelancer', 'direct', 'other'] as const;
type DbPlatform = (typeof DB_PLATFORMS)[number];

const DB_EXPENSE_CATEGORIES = [
  'software',
  'hardware',
  'internet',
  'office',
  'travel',
  'food',
  'marketing',
  'education',
  'tax',
  'other',
] as const;
type DbExpenseCategory = (typeof DB_EXPENSE_CATEGORIES)[number];

const DB_INVOICE_STATUSES = ['draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled'] as const;
type DbInvoiceStatus = (typeof DB_INVOICE_STATUSES)[number];

function toDbPlatform(platform: PlatformId): DbPlatform {
  return (DB_PLATFORMS as readonly string[]).includes(platform) ? (platform as DbPlatform) : 'other';
}

function toDbExpenseCategory(category?: string): DbExpenseCategory {
  const value = (category ?? '').trim().toLowerCase();
  return (DB_EXPENSE_CATEGORIES as readonly string[]).includes(value) ? (value as DbExpenseCategory) : 'other';
}

function toDbInvoiceStatus(status?: string): DbInvoiceStatus {
  const value = (status ?? '').trim().toLowerCase();
  return (DB_INVOICE_STATUSES as readonly string[]).includes(value) ? (value as DbInvoiceStatus) : 'paid';
}

export interface ImportOptions {
  /**
   * Fixes the FX rate for every non-PKR row instead of asking the rate service.
   * Used by CSV import, where the user may state the rate their bank actually gave.
   */
  exchangeRateOverride?: number;
}

interface LedgerState {
  /** Namespaced `<platform>:<externalId>` values already present for this user. */
  importedExternalIds: Set<string>;
  /**
   * `date|amount|description` for records the user entered by hand. Imported rows
   * are excluded — they are covered by `importedExternalIds`, and including them
   * would collapse two genuinely identical transactions into one.
   */
  manualSignatures: Set<string>;
  /** Lower-cased client name -> id. */
  clientIdsByName: Map<string, string>;
  /** Lower-cased invoice number -> id. */
  invoiceIdsByNumber: Map<string, string>;
}

/**
 * Normalization → deduplication → persistence.
 *
 * Every import path — an API sync from a connector, or a CSV statement — funnels
 * through here, so imported clients, invoices, income and expenses are written
 * exactly the way the manual flows write them and participate in every existing
 * report, tax, filing and reconciliation calculation unchanged.
 *
 * Deliberately absent: any tax rule. The engine never derives an SBP purpose code
 * or a tax classification; it passes through what the source stated and otherwise
 * leaves the schema default and the tax engine in charge.
 */
@Injectable()
export class ImportEngineService {
  private readonly logger = new Logger(ImportEngineService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly exchangeRateService: ExchangeRateService,
  ) {}

  /**
   * Dry run. Reads the ledger to classify each row but writes nothing, so the
   * user can confirm exactly what an import would do.
   */
  async preview(
    userId: string,
    transactions: NormalizedTransaction[],
    options: ImportOptions = {},
  ): Promise<ImportPreview> {
    const state = await this.loadLedgerState(this.db, userId);
    const rateFor = this.rateResolver(options.exchangeRateOverride);
    const warnings: string[] = [];

    const platform: PlatformId = transactions[0]?.platform ?? 'generic';
    const items: PreviewLineItem[] = [];
    const byCurrency = new Map<string, { gross: number; fees: number }>();
    const newClients = new Set<string>();
    const existingClients = new Set<string>();
    const newInvoiceNumbers = new Set<string>();

    let incomeCount = 0;
    let expenseCount = 0;
    let duplicateCount = 0;
    let grossAmountPKR = 0;
    let feesAmountPKR = 0;

    for (const tx of transactions) {
      const key = this.externalKey(tx);
      const isDuplicate = this.isDuplicate(tx, key, state);
      const rate = await rateFor(tx.currency);
      const amount = round2(Math.abs(tx.amount));
      const amountPKR = round2(amount * rate);

      if (!isDuplicate) {
        const totals = byCurrency.get(tx.currency) ?? { gross: 0, fees: 0 };

        if (tx.type === 'income') {
          incomeCount++;
          grossAmountPKR = round2(grossAmountPKR + amountPKR);
          totals.gross = round2(totals.gross + amount);

          const clientName = tx.client?.name?.trim();
          if (clientName) {
            if (state.clientIdsByName.has(clientName.toLowerCase())) existingClients.add(clientName);
            else newClients.add(clientName);
          }

          const invoiceNumber = this.invoiceNumberFor(tx);
          if (clientName && !state.invoiceIdsByNumber.has(invoiceNumber.toLowerCase())) {
            newInvoiceNumbers.add(invoiceNumber.toLowerCase());
          }
        } else {
          expenseCount++;
          feesAmountPKR = round2(feesAmountPKR + amountPKR);
          totals.fees = round2(totals.fees + amount);
        }

        byCurrency.set(tx.currency, totals);
      } else {
        duplicateCount++;
      }

      if (items.length < MAX_PREVIEW_ITEMS) {
        items.push({
          externalId: tx.externalId,
          date: this.dateOnly(tx.occurredAt),
          type: tx.type,
          description: tx.description,
          counterparty: (tx.type === 'income' ? tx.client?.name : tx.vendor) ?? '—',
          currency: tx.currency,
          amount,
          amountPKR,
          isDuplicate,
        });
      }
    }

    if (duplicateCount > 0) {
      warnings.push(`${duplicateCount} transaction(s) were already imported and will be skipped.`);
    }
    if (incomeCount + expenseCount === 0 && transactions.length > 0) {
      warnings.push('Everything in this batch is already in your ledger. Nothing new would be imported.');
    }

    return {
      platform,
      transactionCount: transactions.length,
      incomeCount,
      expenseCount,
      duplicateCount,
      grossAmountPKR,
      feesAmountPKR,
      netAmountPKR: round2(grossAmountPKR - feesAmountPKR),
      currencyTotals: Array.from(byCurrency.entries()).map(([currency, t]) => ({
        currency,
        gross: t.gross,
        fees: t.fees,
        net: round2(t.gross - t.fees),
      })),
      newClients: Array.from(newClients),
      existingClients: Array.from(existingClients),
      newInvoiceCount: newInvoiceNumbers.size,
      items,
      warnings,
    };
  }

  /**
   * Persists a normalized batch. Idempotent: a transaction already imported for
   * this user is skipped, so re-running a sync never duplicates a client,
   * invoice, income or expense record.
   */
  async apply(
    userId: string,
    transactions: NormalizedTransaction[],
    options: ImportOptions = {},
  ): Promise<ImportSummary> {
    const rateFor = this.rateResolver(options.exchangeRateOverride);

    // Resolve every rate before opening the write transaction — the rate service
    // may hit the network, and holding a DB transaction across that is wasteful.
    const rates = new Map<string, number>();
    for (const tx of transactions) {
      if (!rates.has(tx.currency)) rates.set(tx.currency, await rateFor(tx.currency));
    }

    return this.db.transaction(async (tx) => {
      const state = await this.loadLedgerState(tx, userId);

      let incomeCreatedCount = 0;
      let expensesCreatedCount = 0;
      let clientsCreatedCount = 0;
      let invoicesCreatedCount = 0;
      let duplicatesSkippedCount = 0;

      for (const item of transactions) {
        const key = this.externalKey(item);
        if (this.isDuplicate(item, key, state)) {
          duplicatesSkippedCount++;
          continue;
        }
        // Guards against a batch that repeats an id within itself.
        state.importedExternalIds.add(key);

        const rate = rates.get(item.currency) ?? 1;
        const amount = round2(Math.abs(item.amount));
        const amountPKR = round2(amount * rate);

        if (item.type === 'income') {
          const clientId = await this.resolveClient(tx, userId, item, state, () => clientsCreatedCount++);
          const invoiceId = clientId
            ? await this.resolveInvoice(tx, userId, item, clientId, amount, amountPKR, rate, state, () =>
                invoicesCreatedCount++,
              )
            : null;

          await tx.insert(income).values({
            userId,
            clientId,
            invoiceId,
            amount: amount.toFixed(2),
            currency: item.currency,
            exchangeRate: rate.toFixed(4),
            amountPKR: amountPKR.toFixed(2),
            platform: toDbPlatform(item.platform),
            description: item.description.slice(0, 500),
            category: item.category?.slice(0, 100) ?? 'freelance_service',
            // Regulatory fields are written only when the source stated them;
            // otherwise the column default stands and the tax engine decides.
            ...(item.sbpPurposeCode ? { sbpPurposeCode: item.sbpPurposeCode.slice(0, 50) } : {}),
            ...(item.prcReferenceNumber ? { prcReferenceNumber: item.prcReferenceNumber.slice(0, 100) } : {}),
            externalId: key,
            receivedAt: item.occurredAt,
          });
          incomeCreatedCount++;
        } else {
          await tx.insert(expenses).values({
            userId,
            amount: amount.toFixed(2),
            currency: item.currency,
            exchangeRate: rate.toFixed(4),
            amountPKR: amountPKR.toFixed(2),
            category: toDbExpenseCategory(item.category),
            description: item.description.slice(0, 500),
            vendor: item.vendor?.slice(0, 255) ?? null,
            externalId: key,
            expenseDate: this.dateOnly(item.occurredAt),
          });
          expensesCreatedCount++;
        }
      }

      return {
        success: true,
        fetchedCount: transactions.length,
        incomeCreatedCount,
        expensesCreatedCount,
        clientsCreatedCount,
        invoicesCreatedCount,
        duplicatesSkippedCount,
        failedCount: 0,
        syncedAt: new Date(),
      };
    });
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  /** `<platform>:<externalId>` — unique per user, and the primary dedup key. */
  private externalKey(tx: NormalizedTransaction): string {
    return `${tx.platform}:${tx.externalId}`.slice(0, 255);
  }

  /**
   * Content signature, used only against hand-entered records.
   *
   * Without this, a user who books a payment manually and then imports the
   * statement containing it ends up with the amount counted twice.
   */
  private contentSignature(date: Date | string, amount: string | number, description: string): string {
    const day = typeof date === 'string' ? date.slice(0, 10) : date.toISOString().slice(0, 10);
    const value = Number.parseFloat(String(amount ?? 0)).toFixed(2);
    return `${day}|${value}|${description.trim().toLowerCase()}`;
  }

  /** True when this row is already in the ledger, by external id or as a manual entry. */
  private isDuplicate(tx: NormalizedTransaction, key: string, state: LedgerState): boolean {
    return (
      state.importedExternalIds.has(key) ||
      state.manualSignatures.has(
        this.contentSignature(tx.occurredAt, Math.abs(tx.amount).toFixed(2), tx.description),
      )
    );
  }

  private invoiceNumberFor(tx: NormalizedTransaction): string {
    return (tx.invoiceRef?.trim() || tx.externalId).slice(0, 50);
  }

  private dateOnly(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  /**
   * Existing clients and invoices are matched case-insensitively, and every
   * already-imported external id is loaded up front so dedup is a set lookup.
   */
  private async loadLedgerState(handle: DbHandle, userId: string): Promise<LedgerState> {
    const [clientRows, invoiceRows, incomeRows, expenseRows] = await Promise.all([
      handle.select({ id: clients.id, name: clients.name }).from(clients).where(eq(clients.userId, userId)),
      handle
        .select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber })
        .from(invoices)
        .where(eq(invoices.userId, userId)),
      handle
        .select({
          externalId: income.externalId,
          amount: income.amount,
          description: income.description,
          occurredAt: income.receivedAt,
        })
        .from(income)
        .where(eq(income.userId, userId)),
      handle
        .select({
          externalId: expenses.externalId,
          amount: expenses.amount,
          description: expenses.description,
          occurredAt: expenses.expenseDate,
        })
        .from(expenses)
        .where(eq(expenses.userId, userId)),
    ]);

    const importedExternalIds = new Set<string>();
    const manualSignatures = new Set<string>();

    for (const row of [...incomeRows, ...expenseRows]) {
      if (row.externalId) {
        importedExternalIds.add(row.externalId);
      } else if (row.occurredAt) {
        manualSignatures.add(this.contentSignature(row.occurredAt, row.amount, row.description));
      }
    }

    return {
      importedExternalIds,
      manualSignatures,
      clientIdsByName: new Map(clientRows.map((c) => [c.name.trim().toLowerCase(), c.id])),
      invoiceIdsByNumber: new Map(invoiceRows.map((i) => [i.invoiceNumber.trim().toLowerCase(), i.id])),
    };
  }

  /** Reuses an existing client by case-insensitive name, or creates one. */
  private async resolveClient(
    tx: DbHandle,
    userId: string,
    item: NormalizedTransaction,
    state: LedgerState,
    onCreated: () => void,
  ): Promise<string | null> {
    const name = item.client?.name?.trim();
    if (!name) return null;

    const normalized = name.toLowerCase();
    const existing = state.clientIdsByName.get(normalized);
    if (existing) return existing;

    const [created] = await tx
      .insert(clients)
      .values({
        userId,
        name: name.slice(0, 255),
        company: item.client?.company?.trim().slice(0, 255) ?? null,
        email: item.client?.email?.trim().slice(0, 255) ?? null,
        phone: item.client?.phone?.trim().slice(0, 50) ?? null,
        platform: toDbPlatform(item.platform),
        currency: item.currency.toUpperCase().slice(0, 3),
        status: 'active',
      })
      .returning({ id: clients.id });

    state.clientIdsByName.set(normalized, created.id);
    onCreated();
    return created.id;
  }

  /** Reuses an invoice with the same number, or creates one with a single line item. */
  private async resolveInvoice(
    tx: DbHandle,
    userId: string,
    item: NormalizedTransaction,
    clientId: string,
    amount: number,
    amountPKR: number,
    rate: number,
    state: LedgerState,
    onCreated: () => void,
  ): Promise<string> {
    const invoiceNumber = this.invoiceNumberFor(item);
    const normalized = invoiceNumber.toLowerCase();

    const existing = state.invoiceIdsByNumber.get(normalized);
    if (existing) return existing;

    const status = toDbInvoiceStatus(item.invoiceStatus);
    const [created] = await tx
      .insert(invoices)
      .values({
        userId,
        clientId,
        invoiceNumber,
        subtotal: amount.toFixed(2),
        taxRate: '0.00',
        taxAmount: '0.00',
        discountAmount: '0.00',
        total: amount.toFixed(2),
        currency: item.currency,
        exchangeRate: rate.toFixed(4),
        totalPKR: amountPKR.toFixed(2),
        status,
        dueDate: this.dateOnly(item.occurredAt),
        paidAt: status === 'paid' ? item.occurredAt : null,
        notes: item.description.slice(0, 500),
        createdAt: item.occurredAt,
        updatedAt: item.occurredAt,
      })
      .returning({ id: invoices.id });

    await tx.insert(invoiceItems).values({
      invoiceId: created.id,
      description: item.description.slice(0, 500),
      quantity: '1.00',
      rate: amount.toFixed(2),
      amount: amount.toFixed(2),
      sortOrder: 0,
    });

    state.invoiceIdsByNumber.set(normalized, created.id);
    onCreated();
    return created.id;
  }

  /** Per-batch memoised FX lookup; PKR is always 1. */
  private rateResolver(override?: number): (currency: string) => Promise<number> {
    const cache = new Map<string, number>();

    return async (currency: string): Promise<number> => {
      if (currency === 'PKR') return 1;
      if (override && override > 0) return round4(override);

      const cached = cache.get(currency);
      if (cached !== undefined) return cached;

      const rate = round4(await this.exchangeRateService.getRate(currency, 'PKR'));
      cache.set(currency, rate);
      return rate;
    };
  }
}
