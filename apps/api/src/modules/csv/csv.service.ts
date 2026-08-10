import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import { income, expenses, clients } from '../../database/schema';
import { ExchangeRateService } from '../exchange-rate/exchange-rate.service';
import { round2, round4 } from '../../common/money';

export const MAX_CSV_BYTES = 5 * 1024 * 1024; // 5MB — used to be enforced only in the browser.

export interface CSVImportResult {
  success: boolean;
  totalParsed: number;
  incomeCount: number;
  expenseCount: number;
  clientsCreated: number;
  skippedRows: number;
  duplicateRows: number;
  invalidDateRows: number;
  message: string;
}

/** Header aliases -> the logical column we need. Lower-cased, punctuation-insensitive. */
const COLUMN_ALIASES: Record<string, string[]> = {
  date: ['date', 'transaction date', 'created date', 'posted date'],
  description: ['description', 'memo', 'details', 'narrative', 'note'],
  amount: ['amount', 'net amount', 'value', 'total'],
  type: ['type', 'transaction type', 'category'],
  currency: ['currency', 'ccy'],
  refId: ['ref id', 'reference id', 'ref', 'reference'],
};

@Injectable()
export class CsvService {
  constructor(
    @Inject(DRIZZLE) private readonly db: any,
    private readonly exchangeRateService: ExchangeRateService,
  ) {}

  async parseAndImport(userId: string, fileBuffer: Buffer, overrideRate?: number): Promise<CSVImportResult> {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new BadRequestException('CSV file content is empty');
    }
    if (fileBuffer.length > MAX_CSV_BYTES) {
      throw new BadRequestException(
        `File is ${(fileBuffer.length / 1024 / 1024).toFixed(1)}MB. The maximum supported size is 5MB.`,
      );
    }

    const content = fileBuffer.toString('utf-8');
    const lines = content.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);

    if (lines.length < 2) {
      throw new BadRequestException('CSV file must contain a header and at least one data row');
    }

    const headerCells = this.parseCSVLine(lines[0]).map((h) => this.normalizeHeader(h));
    const columns = this.mapColumns(headerCells);

    if (columns.date === -1 || columns.amount === -1) {
      throw new BadRequestException(
        'Could not find the required "Date" and "Amount" columns in the CSV header. ' +
          `Found: ${headerCells.filter(Boolean).join(', ')}`,
      );
    }

    const rows = lines.slice(1);
    const isUpworkStatement = columns.refId !== -1;

    // Every insert for this import happens in one transaction: a failure partway
    // through used to leave a partial import with no rollback and no indication
    // of where it stopped.
    return this.db.transaction(async (tx: any) => {
      let totalParsed = 0;
      let incomeCount = 0;
      let expenseCount = 0;
      let clientsCreated = 0;
      let skippedRows = 0;
      let duplicateRows = 0;
      let invalidDateRows = 0;

      const existingClients = await tx.select().from(clients).where(eq(clients.userId, userId));
      const clientMap = new Map<string, string>();
      existingClients.forEach((c: any) => clientMap.set(c.name.toLowerCase(), c.id));

      // Signatures of everything already in the ledger, so re-uploading the same
      // statement (a common double-click) does not double the user's income.
      const seenSignatures = new Set<string>();
      const existingIncome = await tx.select().from(income).where(eq(income.userId, userId));
      const existingExpenses = await tx.select().from(expenses).where(eq(expenses.userId, userId));
      existingIncome.forEach((r: any) =>
        seenSignatures.add(this.signature(r.receivedAt, r.amount, r.description)),
      );
      existingExpenses.forEach((r: any) =>
        seenSignatures.add(this.signature(r.expenseDate, r.amount, r.description)),
      );

      const getOrCreateClient = async (clientName: string, currency = 'USD'): Promise<string | null> => {
        if (!clientName || clientName.trim() === '') return null;
        const normalized = clientName.trim().toLowerCase();
        if (clientMap.has(normalized)) return clientMap.get(normalized)!;

        const [newClient] = await tx
          .insert(clients)
          .values({
            userId,
            name: clientName.trim().slice(0, 255),
            currency,
            platform: 'other',
            status: 'active',
          })
          .returning();

        clientMap.set(normalized, newClient.id);
        clientsCreated++;
        return newClient.id;
      };

      // Cache rates per currency so a 1000-row import does not re-resolve on every line.
      const rateCache = new Map<string, number>();
      const rateFor = async (currency: string): Promise<number> => {
        if (overrideRate && overrideRate > 0 && currency !== 'PKR') return round4(overrideRate);
        if (currency === 'PKR') return 1;
        if (!rateCache.has(currency)) {
          rateCache.set(currency, round4(await this.exchangeRateService.getRate(currency, 'PKR')));
        }
        return rateCache.get(currency)!;
      };

      for (const row of rows) {
        const cells = this.parseCSVLine(row);
        if (cells.length === 0) continue;

        const rawAmount = this.parseAmount(cells[columns.amount]);
        if (!rawAmount) {
          skippedRows++;
          continue;
        }

        const dateStr = cells[columns.date] || '';
        const parsedDate = new Date(dateStr);
        if (isNaN(parsedDate.getTime())) {
          // A malformed date used to silently become "today", pushing a
          // historical transaction into the current tax year with no warning.
          // Skip and report instead — the user can fix the row and re-import.
          invalidDateRows++;
          continue;
        }
        const validDate = parsedDate;

        const description = (columns.description !== -1 ? cells[columns.description] : '') || 'Imported transaction';
        const typeValue = (columns.type !== -1 ? cells[columns.type] : '').toLowerCase();
        const currency = ((columns.currency !== -1 ? cells[columns.currency] : '') || 'USD').toUpperCase();

        const signature = this.signature(validDate, Math.abs(rawAmount).toFixed(2), description);
        if (seenSignatures.has(signature)) {
          duplicateRows++;
          continue;
        }
        seenSignatures.add(signature);

        // A row is an expense when its type says so, or when the amount is negative.
        const isExpense =
          rawAmount < 0 || typeValue.includes('fee') || typeValue.includes('expense') || typeValue.includes('withdrawal');

        totalParsed++;

        if (isExpense) {
          const absAmount = round2(Math.abs(rawAmount));
          const rate = await rateFor(currency);
          const amountPKR = round2(absAmount * rate);

          await tx.insert(expenses).values({
            userId,
            amount: absAmount.toFixed(2),
            currency,
            exchangeRate: rate.toFixed(4),
            amountPKR: amountPKR.toFixed(2),
            category: 'other',
            description: (isUpworkStatement ? `Platform fee: ${description}` : description).slice(0, 500),
            vendor: isUpworkStatement ? 'Upwork Global Inc.' : 'CSV Import',
            expenseDate: validDate.toISOString().split('T')[0],
          });
          expenseCount++;
        } else {
          const clientName = this.extractClientName(description, isUpworkStatement);
          const clientId = await getOrCreateClient(clientName, currency);
          const rate = await rateFor(currency);
          const amount = round2(rawAmount);
          const amountPKR = round2(amount * rate);

          await tx.insert(income).values({
            userId,
            clientId,
            amount: amount.toFixed(2),
            currency,
            exchangeRate: rate.toFixed(4),
            amountPKR: amountPKR.toFixed(2),
            platform: isUpworkStatement ? 'upwork' : 'direct',
            description: description.slice(0, 500),
            category: 'freelance_service',
            receivedAt: validDate,
          });
          incomeCount++;
        }
      }

      const notes: string[] = [];
      if (skippedRows > 0) notes.push(`${skippedRows} row(s) skipped (no usable amount)`);
      if (invalidDateRows > 0) notes.push(`${invalidDateRows} row(s) skipped (unreadable date)`);
      if (duplicateRows > 0) notes.push(`${duplicateRows} row(s) skipped (already imported)`);
      const note = notes.length > 0 ? ` ${notes.join('; ')}.` : '';

      return {
        success: true,
        totalParsed,
        incomeCount,
        expenseCount,
        clientsCreated,
        skippedRows,
        duplicateRows,
        invalidDateRows,
        message: `Successfully imported ${totalParsed} transactions (${incomeCount} income, ${expenseCount} expenses).${note}`,
      };
    });
  }

  /** Identifies a transaction well enough to detect a re-imported statement. */
  private signature(date: any, amount: any, description: string): string {
    const dateKey = typeof date === 'string' ? date.slice(0, 10) : new Date(date).toISOString().slice(0, 10);
    return `${dateKey}|${amount}|${(description || '').trim().toLowerCase()}`;
  }

  private normalizeHeader(value: string): string {
    return value.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  }

  private mapColumns(headerCells: string[]) {
    const find = (aliases: string[]) => headerCells.findIndex((cell) => aliases.includes(cell));
    return {
      date: find(COLUMN_ALIASES.date),
      description: find(COLUMN_ALIASES.description),
      amount: find(COLUMN_ALIASES.amount),
      type: find(COLUMN_ALIASES.type),
      currency: find(COLUMN_ALIASES.currency),
      refId: find(COLUMN_ALIASES.refId),
    };
  }

  private parseAmount(raw?: string): number {
    if (!raw) return 0;
    const trimmed = raw.trim();
    // Accounting notation: (500) means -500. Strip the parens and negate,
    // otherwise a fee shown this way used to parse as positive income.
    const isAccountingNegative = /^\(.*\)$/.test(trimmed);
    // Strip currency symbols/separators; keep the sign and decimal point.
    const cleaned = trimmed.replace(/[^0-9.-]/g, '');
    const value = parseFloat(cleaned);
    if (!Number.isFinite(value)) return 0;
    return isAccountingNegative ? -Math.abs(value) : value;
  }

  private extractClientName(description: string, isUpworkStatement: boolean): string {
    const match = description.match(/(?:for|from)\s+([A-Za-z0-9&.,'\s]+?)(?:\s+-|$|\()/i);
    if (match && match[1] && match[1].trim().length > 1) {
      return match[1].trim();
    }
    return isUpworkStatement ? 'Upwork Client' : 'Direct Client';
  }

  private parseCSVLine(text: string): string[] {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        // A doubled quote inside a quoted field is a literal quote.
        if (inQuotes && text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur.trim());
    return result;
  }
}
