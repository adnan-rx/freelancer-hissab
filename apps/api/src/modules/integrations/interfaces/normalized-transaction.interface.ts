/**
 * The single internal transaction model.
 *
 * Everything downstream of a connector — dedup, the import engine, clients,
 * invoices, income, expenses — speaks only this shape. Platform-specific JSON
 * and CSV columns stop at the connector/parser boundary and never reach the
 * core application.
 */

/** Platforms the app has a connector for. Not the same as the DB `client_platform` enum. */
export type PlatformId = 'upwork' | 'fiverr' | 'freelancer' | 'toptal' | 'generic';

/**
 * How a platform's financial data can be reached.
 * - `oauth2`      — official OAuth API exposing a financial ledger; automatic sync.
 * - `csv_only`    — no official API for a freelancer's own earnings; statement import only.
 */
export type AuthMechanism = 'oauth2' | 'csv_only';

export type ConnectionStatus = 'connected' | 'expired' | 'error' | 'disconnected';
export type SyncStatus = 'idle' | 'syncing' | 'success' | 'failed';
export type SyncType = 'manual' | 'scheduled' | 'initial';
export type SyncLogStatus = 'success' | 'failed' | 'partial';

/** Income raises revenue; expense covers platform commissions and any other outgoing. */
export type NormalizedTransactionType = 'income' | 'expense';

export interface NormalizedClient {
  /** Display name. Matching against existing clients is case-insensitive. */
  name: string;
  company?: string;
  email?: string;
  phone?: string;
}

export type TransactionMetadata = Record<string, string | number | boolean | null>;

export interface NormalizedTransaction {
  /**
   * Platform-native identifier, unique within the platform. The engine namespaces
   * it as `<platform>:<externalId>` before storing, so this need only be unique
   * per platform. This is the sole idempotency key.
   */
  externalId: string;
  platform: PlatformId;
  type: NormalizedTransactionType;
  /** When the money moved. */
  occurredAt: Date;
  /** Always positive and denominated in `currency`; direction is carried by `type`. */
  amount: number;
  currency: string;
  description: string;
  /** Present on income; the party that paid. */
  client?: NormalizedClient;
  /** Present on expenses; the party that was paid (e.g. the marketplace). */
  vendor?: string;
  /** Platform reference used as the invoice number. Falls back to `externalId`. */
  invoiceRef?: string;
  invoiceStatus?: 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'cancelled';
  /** Income category, or one of the `expense_category` enum values for expenses. */
  category?: string;
  /**
   * Regulatory fields are *passed through* from the source when the user's own
   * statement carries them. The integration layer never derives them — the tax
   * engine and the schema defaults own that decision.
   */
  sbpPurposeCode?: string;
  prcReferenceNumber?: string;
  /** Retained platform detail, for audit only. Never read by core features. */
  metadata?: TransactionMetadata;
}

// ---------------------------------------------------------------------------
// Import engine results
// ---------------------------------------------------------------------------

export interface ImportCounts {
  fetchedCount: number;
  incomeCreatedCount: number;
  expensesCreatedCount: number;
  clientsCreatedCount: number;
  invoicesCreatedCount: number;
  duplicatesSkippedCount: number;
  failedCount: number;
}

export interface ImportSummary extends ImportCounts {
  success: boolean;
  errorMessage?: string;
  syncedAt: Date;
}

export interface PreviewLineItem {
  externalId: string;
  date: string;
  type: NormalizedTransactionType;
  description: string;
  counterparty: string;
  currency: string;
  amount: number;
  amountPKR: number;
  isDuplicate: boolean;
}

/** Everything shown to the user before a single row is written. */
export interface ImportPreview {
  platform: PlatformId;
  transactionCount: number;
  incomeCount: number;
  expenseCount: number;
  duplicateCount: number;
  /** Totals cover only the rows that would actually be imported. */
  grossAmountPKR: number;
  feesAmountPKR: number;
  netAmountPKR: number;
  currencyTotals: Array<{ currency: string; gross: number; fees: number; net: number }>;
  newClients: string[];
  existingClients: string[];
  newInvoiceCount: number;
  items: PreviewLineItem[];
  warnings: string[];
}
