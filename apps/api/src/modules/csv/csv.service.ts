import { BadRequestException, Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { ImportEngineService } from '../integrations/import-engine.service';
import {
  ImportPreview,
  NormalizedTransaction,
  PlatformId,
  PreviewLineItem,
} from '../integrations/interfaces/normalized-transaction.interface';

export const MAX_CSV_BYTES = 5 * 1024 * 1024; // 5MB limit

/** Platforms whose statements this parser recognises. */
export type CsvPlatform = Extract<PlatformId, 'upwork' | 'fiverr' | 'freelancer' | 'toptal' | 'generic'>;

const CSV_PLATFORMS: readonly CsvPlatform[] = ['upwork', 'fiverr', 'freelancer', 'toptal', 'generic'];

/** Rows the parser could not use. Surfaced to the user rather than silently dropped. */
export interface CsvParseStats {
  skippedRows: number;
  invalidDateRows: number;
}

export interface CsvPreviewResult extends CsvParseStats {
  detectedPlatform: CsvPlatform;
  totalRows: number;
  incomeCount: number;
  expenseCount: number;
  duplicateCount: number;
  newInvoiceCount: number;
  newClients: string[];
  existingClients: string[];
  /** Totals per source currency, so a mixed-currency statement is not misreported. */
  currencyTotals: Array<{ currency: string; gross: number; fees: number; net: number }>;
  grossTotalPKR: number;
  feesTotalPKR: number;
  netTotalPKR: number;
  previewItems: PreviewLineItem[];
  warnings: string[];
}

export interface CsvImportResult extends CsvParseStats {
  success: boolean;
  platform: CsvPlatform;
  totalParsed: number;
  incomeCount: number;
  expenseCount: number;
  clientsCreated: number;
  invoicesCreated: number;
  duplicateRows: number;
  message: string;
}

/** Header aliases -> the logical column we need. Lower-cased, punctuation-insensitive. */
const COLUMN_ALIASES: Record<string, string[]> = {
  date: ['date', 'transaction date', 'created date', 'posted date', 'cleared date', 'order date', 'time'],
  description: ['description', 'memo', 'details', 'narrative', 'note', 'item description', 'gig', 'gig title', 'for', 'service'],
  amount: ['amount', 'net amount', 'value', 'total', 'item price', 'gross amount', 'order amount', 'gross'],
  grossAmount: ['gross amount', 'gross', 'order amount', 'total amount', 'gig price'],
  serviceFee: ['service fee', 'fiverr fee', 'upwork fee', 'fee', 'commission', 'platform fee'],
  netAmount: ['net amount', 'net earnings', 'net income', 'net', 'cleared amount', 'paid out'],
  type: ['type', 'transaction type', 'record type'],
  category: ['category', 'expense category', 'income category'],
  currency: ['currency', 'ccy'],
  refId: ['ref id', 'reference id', 'ref', 'reference', 'transaction id', 'txid'],
  orderId: ['order id', 'order #', 'order no', 'order', 'gig id'],
  invoiceNumber: ['invoice number', 'invoice #', 'invoice no', 'invoice id', 'inv #', 'inv no', 'invoice', 'inv num'],
  invoiceStatus: ['invoice status', 'status', 'payment status', 'order status'],
  clientName: ['client name', 'client', 'customer', 'buyer', 'buyer username', 'customer username', 'ordered by'],
  clientCompany: ['client company', 'company'],
  clientEmail: ['client email', 'email', 'buyer email'],
  clientPhone: ['client phone', 'phone'],
  vendor: ['vendor payee', 'vendor', 'payee', 'seller'],
  sbpPurposeCode: ['sbp purpose code', 'sbp purpose', 'purpose code', 'sbp code'],
  prcReferenceNumber: ['prc reference number', 'prc reference', 'prc ref', 'prc #', 'prc number', 'prc'],
};

type ColumnMap = Record<keyof typeof COLUMN_ALIASES, number>;

/** Marketplace label used as the vendor on a platform commission. */
const FEE_VENDORS: Record<CsvPlatform, string> = {
  upwork: 'Upwork',
  fiverr: 'Fiverr',
  freelancer: 'Freelancer.com',
  toptal: 'Toptal',
  generic: 'Platform fee',
};

interface ParsedRow {
  date: Date;
  rawAmount: number;
  grossAmount?: number;
  serviceFee?: number;
  description: string;
  typeValue: string;
  categoryValue: string;
  currency: string;
  refId: string;
  orderId: string;
  invoiceNum: string;
  invoiceStatus: string;
  clientName: string;
  clientCompany: string;
  clientEmail: string;
  clientPhone: string;
  vendor: string;
  sbpPurposeCode: string;
  prcReferenceNumber: string;
}

/**
 * Statement import — the fallback for platforms with no official earnings API,
 * and the only route for Fiverr, Freelancer.com and Toptal.
 *
 * This class parses and normalizes. It deliberately does not write to the
 * ledger: the normalized rows go to the shared import engine, so a CSV-imported
 * invoice is byte-for-byte the same kind of record as an API-synced one.
 */
@Injectable()
export class CsvService {
  constructor(private readonly importEngine: ImportEngineService) {}

  /** Dry run — what this file would add, without writing anything. */
  async previewImport(
    userId: string,
    fileBuffer: Buffer,
    overrideRate?: number,
    platformHint?: string,
  ): Promise<CsvPreviewResult> {
    const { transactions, platform, stats } = this.parse(fileBuffer, platformHint);
    const preview = await this.importEngine.preview(userId, transactions, {
      exchangeRateOverride: overrideRate,
    });

    return this.toPreviewResult(preview, platform, stats);
  }

  /** Parses, normalizes and imports. Re-importing the same file adds nothing. */
  async parseAndImport(
    userId: string,
    fileBuffer: Buffer,
    overrideRate?: number,
    platformHint?: string,
  ): Promise<CsvImportResult> {
    const { transactions, platform, stats } = this.parse(fileBuffer, platformHint);
    const summary = await this.importEngine.apply(userId, transactions, {
      exchangeRateOverride: overrideRate,
    });

    const notes = this.parseNotes(stats, summary.duplicatesSkippedCount);

    return {
      success: true,
      platform,
      totalParsed: summary.incomeCreatedCount + summary.expensesCreatedCount,
      incomeCount: summary.incomeCreatedCount,
      expenseCount: summary.expensesCreatedCount,
      clientsCreated: summary.clientsCreatedCount,
      invoicesCreated: summary.invoicesCreatedCount,
      duplicateRows: summary.duplicatesSkippedCount,
      ...stats,
      message:
        `Imported ${summary.incomeCreatedCount} income and ${summary.expensesCreatedCount} expense record(s) ` +
        `from your ${platform} statement (${summary.invoicesCreatedCount} invoices, ${summary.clientsCreatedCount} new clients).` +
        (notes.length > 0 ? ` ${notes.join('; ')}.` : ''),
    };
  }

  // -------------------------------------------------------------------------
  // Parsing → normalization
  // -------------------------------------------------------------------------

  /**
   * Turns a statement into the internal transaction model. Nothing platform- or
   * CSV-specific escapes this method.
   */
  private parse(
    fileBuffer: Buffer,
    platformHint?: string,
  ): { transactions: NormalizedTransaction[]; platform: CsvPlatform; stats: CsvParseStats } {
    const { rows, columns, headerCells } = this.validateAndExtractCSV(fileBuffer);
    const platform = this.detectPlatform(headerCells, rows, platformHint);

    const transactions: NormalizedTransaction[] = [];
    const stats: CsvParseStats = { skippedRows: 0, invalidDateRows: 0 };
    /** Counts identical content keys so repeated-but-genuine rows stay distinct. */
    const occurrences = new Map<string, number>();

    for (const line of rows) {
      const row = this.extractRow(line, columns);
      if (!row) {
        stats.skippedRows++;
        continue;
      }
      if (Number.isNaN(row.date.getTime())) {
        stats.invalidDateRows++;
        continue;
      }

      const externalId = this.externalIdFor(row, occurrences);
      const client = row.clientName.trim()
        ? {
            name: row.clientName.trim(),
            company: row.clientCompany.trim() || undefined,
            email: row.clientEmail.trim() || undefined,
            phone: row.clientPhone.trim() || undefined,
          }
        : { name: this.extractClientName(row.description, platform) };

      // Statement rows that carry gross and fee in the same line (Fiverr, Toptal)
      // become two records, mirroring how the money actually moved.
      const hasSplitFee =
        row.grossAmount !== undefined && row.grossAmount > 0 && row.serviceFee !== undefined && row.serviceFee !== 0;

      if (hasSplitFee) {
        transactions.push({
          externalId,
          platform,
          type: 'income',
          occurredAt: row.date,
          amount: row.grossAmount as number,
          currency: row.currency,
          description: row.description,
          client,
          invoiceRef: row.invoiceNum.trim() || row.orderId.trim() || externalId,
          invoiceStatus: this.invoiceStatusFor(row),
          category: row.categoryValue.trim() || 'freelance_service',
          sbpPurposeCode: row.sbpPurposeCode.trim() || undefined,
          prcReferenceNumber: row.prcReferenceNumber.trim() || undefined,
        });

        transactions.push({
          externalId: `${externalId}:fee`,
          platform,
          type: 'expense',
          occurredAt: row.date,
          amount: Math.abs(row.serviceFee as number),
          currency: row.currency,
          description: `${FEE_VENDORS[platform]} fee — ${row.description}`,
          vendor: row.vendor.trim() || FEE_VENDORS[platform],
          category: 'other',
        });
        continue;
      }

      if (this.isExpenseRow(row)) {
        transactions.push({
          externalId,
          platform,
          type: 'expense',
          occurredAt: row.date,
          amount: Math.abs(row.rawAmount),
          currency: row.currency,
          description: row.description,
          vendor: row.vendor.trim() || FEE_VENDORS[platform],
          category: row.categoryValue.trim() || 'other',
        });
        continue;
      }

      transactions.push({
        externalId,
        platform,
        type: 'income',
        occurredAt: row.date,
        amount: row.rawAmount,
        currency: row.currency,
        description: row.description,
        client,
        invoiceRef: row.invoiceNum.trim() || row.refId.trim() || row.orderId.trim() || externalId,
        invoiceStatus: this.invoiceStatusFor(row),
        category: row.categoryValue.trim() || 'freelance_service',
        sbpPurposeCode: row.sbpPurposeCode.trim() || undefined,
        prcReferenceNumber: row.prcReferenceNumber.trim() || undefined,
      });
    }

    return { transactions, platform, stats };
  }

  /**
   * A stable id for a statement row.
   *
   * A reference column from the platform is ideal. Without one we hash the row's
   * own content, which makes re-uploading the same statement a no-op while two
   * genuinely identical transactions on one day stay separate via the occurrence
   * counter.
   */
  private externalIdFor(row: ParsedRow, occurrences: Map<string, number>): string {
    const stated = row.refId.trim() || row.orderId.trim() || row.invoiceNum.trim();
    if (stated) return `csv-${stated}`;

    const content = [
      row.date.toISOString().slice(0, 10),
      row.rawAmount.toFixed(2),
      row.grossAmount?.toFixed(2) ?? '',
      row.description.trim().toLowerCase(),
    ].join('|');
    const digest = crypto.createHash('sha1').update(content).digest('hex').slice(0, 16);

    const seen = occurrences.get(digest) ?? 0;
    occurrences.set(digest, seen + 1);
    return seen === 0 ? `csv-${digest}` : `csv-${digest}-${seen}`;
  }

  private isExpenseRow(row: ParsedRow): boolean {
    const description = row.description.toLowerCase();
    return (
      row.rawAmount < 0 ||
      ['fee', 'expense', 'withdrawal', 'commission'].some((t) => row.typeValue.includes(t)) ||
      ['service fee', 'connects', 'membership'].some((t) => description.includes(t))
    );
  }

  private invoiceStatusFor(row: ParsedRow): NormalizedTransaction['invoiceStatus'] {
    const value = row.invoiceStatus.trim().toLowerCase();
    const known = ['draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled'] as const;
    return known.includes(value as (typeof known)[number]) ? (value as NormalizedTransaction['invoiceStatus']) : 'paid';
  }

  private parseNotes(stats: CsvParseStats, duplicates: number): string[] {
    const notes: string[] = [];
    if (stats.skippedRows > 0) notes.push(`${stats.skippedRows} row(s) skipped (no usable amount)`);
    if (stats.invalidDateRows > 0) notes.push(`${stats.invalidDateRows} row(s) skipped (unreadable date)`);
    if (duplicates > 0) notes.push(`${duplicates} row(s) already imported`);
    return notes;
  }

  private toPreviewResult(
    preview: ImportPreview,
    platform: CsvPlatform,
    stats: CsvParseStats,
  ): CsvPreviewResult {
    const warnings = [...preview.warnings, ...this.parseNotes(stats, 0).map((n) => `${n}.`)];

    return {
      detectedPlatform: platform,
      totalRows: preview.transactionCount,
      incomeCount: preview.incomeCount,
      expenseCount: preview.expenseCount,
      duplicateCount: preview.duplicateCount,
      newInvoiceCount: preview.newInvoiceCount,
      newClients: preview.newClients,
      existingClients: preview.existingClients,
      currencyTotals: preview.currencyTotals,
      grossTotalPKR: preview.grossAmountPKR,
      feesTotalPKR: preview.feesAmountPKR,
      netTotalPKR: preview.netAmountPKR,
      previewItems: preview.items,
      warnings,
      ...stats,
    };
  }

  // -------------------------------------------------------------------------
  // CSV mechanics
  // -------------------------------------------------------------------------

  private validateAndExtractCSV(fileBuffer: Buffer): {
    rows: string[];
    columns: ColumnMap;
    headerCells: string[];
  } {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new BadRequestException('CSV file content is empty');
    }
    if (fileBuffer.length > MAX_CSV_BYTES) {
      throw new BadRequestException(
        `File is ${(fileBuffer.length / 1024 / 1024).toFixed(1)}MB. The maximum supported size is 5MB.`,
      );
    }

    const lines = fileBuffer
      .toString('utf-8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length < 2) {
      throw new BadRequestException('CSV file must contain a header and at least one data row');
    }

    const headerCells = this.parseCSVLine(lines[0]).map((h) => this.normalizeHeader(h));
    const columns = this.mapColumns(headerCells);

    if (columns.date === -1 || (columns.amount === -1 && columns.grossAmount === -1 && columns.netAmount === -1)) {
      throw new BadRequestException(
        'Could not find the required "Date" and "Amount" columns in the CSV header. ' +
          `Found: ${headerCells.filter(Boolean).join(', ')}`,
      );
    }

    return { rows: lines.slice(1), columns, headerCells };
  }

  private detectPlatform(headerCells: string[], rows: string[], platformHint?: string): CsvPlatform {
    const hint = platformHint?.trim().toLowerCase();
    if (hint && (CSV_PLATFORMS as readonly string[]).includes(hint)) {
      return hint as CsvPlatform;
    }

    const headerStr = headerCells.join(' ').toLowerCase();
    const sample = rows.slice(0, 10).join(' ').toLowerCase();

    if (
      headerStr.includes('ref id') ||
      headerStr.includes('agency') ||
      sample.includes('upwork') ||
      sample.includes('milestone payment from') ||
      sample.includes('fixed price')
    ) {
      return 'upwork';
    }

    if (
      headerStr.includes('buyer') ||
      headerStr.includes('order id') ||
      headerStr.includes('gig') ||
      sample.includes('fiverr')
    ) {
      return 'fiverr';
    }

    if (sample.includes('freelancer.com')) return 'freelancer';
    if (sample.includes('toptal')) return 'toptal';

    return 'generic';
  }

  private extractRow(line: string, columns: ColumnMap): ParsedRow | null {
    const cells = this.parseCSVLine(line);
    if (cells.length === 0) return null;

    const cell = (index: number): string => (index !== -1 ? (cells[index] ?? '') : '');

    const rawAmountValue =
      columns.amount !== -1
        ? cell(columns.amount)
        : columns.grossAmount !== -1
          ? cell(columns.grossAmount)
          : cell(columns.netAmount);

    let grossAmount: number | undefined;
    if (columns.grossAmount !== -1 && cell(columns.grossAmount)) {
      const parsed = Math.abs(this.parseAmount(cell(columns.grossAmount)));
      if (parsed > 0) grossAmount = parsed;
    }

    let serviceFee: number | undefined;
    if (columns.serviceFee !== -1 && cell(columns.serviceFee)) {
      serviceFee = this.parseAmount(cell(columns.serviceFee));
    }

    const netAmount = columns.netAmount !== -1 ? this.parseAmount(cell(columns.netAmount)) : 0;
    const rawAmount = this.parseAmount(rawAmountValue);
    if (!rawAmount && !grossAmount && !netAmount) return null;

    return {
      date: new Date(cell(columns.date)),
      rawAmount,
      grossAmount,
      serviceFee,
      description: cell(columns.description) || 'Imported freelance transaction',
      typeValue: cell(columns.type).toLowerCase(),
      categoryValue: cell(columns.category),
      currency: (cell(columns.currency) || 'USD').toUpperCase().slice(0, 3),
      refId: cell(columns.refId),
      orderId: cell(columns.orderId),
      invoiceNum: cell(columns.invoiceNumber),
      invoiceStatus: cell(columns.invoiceStatus),
      clientName: cell(columns.clientName),
      clientCompany: cell(columns.clientCompany),
      clientEmail: cell(columns.clientEmail),
      clientPhone: cell(columns.clientPhone),
      vendor: cell(columns.vendor),
      sbpPurposeCode: cell(columns.sbpPurposeCode),
      prcReferenceNumber: cell(columns.prcReferenceNumber),
    };
  }

  private normalizeHeader(value: string): string {
    return value.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  }

  private mapColumns(headerCells: string[]): ColumnMap {
    const columns = {} as ColumnMap;
    for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
      columns[key] = headerCells.findIndex((cell) => aliases.includes(cell));
    }
    return columns;
  }

  private parseAmount(raw?: string): number {
    if (!raw) return 0;
    const trimmed = raw.trim();
    // Accounting notation puts negatives in parentheses: (1,234.56)
    const isAccountingNegative = /^\(.*\)$/.test(trimmed);
    const value = parseFloat(trimmed.replace(/[^0-9.-]/g, ''));
    if (!Number.isFinite(value)) return 0;
    return isAccountingNegative ? -Math.abs(value) : value;
  }

  /** Best-effort counterparty from a free-text statement description. */
  private extractClientName(description: string, platform: CsvPlatform): string {
    const fromPreposition = description.match(/(?:for|from)\s+([A-Za-z0-9&.,'_\s]+?)(?:\s+-\s+|$|\()/i);
    if (fromPreposition?.[1] && fromPreposition[1].trim().length > 1) {
      const candidate = fromPreposition[1].trim();
      if (!['upwork', 'fiverr', 'direct', 'hourly', 'fixed price'].includes(candidate.toLowerCase())) {
        return candidate;
      }
    }

    const handle = description.match(/@([A-Za-z0-9_]+)/) ?? description.match(/buyer\s+([A-Za-z0-9_]+)/i);
    if (handle?.[1]) return `@${handle[1].trim()}`;

    const labelled = description.match(/(?:client|customer|buyer)[:\s]+([A-Za-z0-9&.,'_\s]+?)(?:;|,|$)/i);
    if (labelled?.[1]) return labelled[1].trim();

    return platform === 'generic' ? 'Direct Client' : `${FEE_VENDORS[platform]} Client`;
  }

  /** RFC 4180-ish splitter: honours quoted fields and doubled quotes. */
  private parseCSVLine(text: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        if (inQuotes && text[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }
}
