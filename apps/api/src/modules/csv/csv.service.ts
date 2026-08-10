import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import { income, expenses, clients } from '../../database/schema';
import { ExchangeRateService } from '../exchange-rate/exchange-rate.service';

export interface CSVImportResult {
  success: boolean;
  totalParsed: number;
  incomeCount: number;
  expenseCount: number;
  clientsCreated: number;
  skippedRows: number;
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

    let totalParsed = 0;
    let incomeCount = 0;
    let expenseCount = 0;
    let clientsCreated = 0;
    let skippedRows = 0;

    const existingClients = await this.db.select().from(clients).where(eq(clients.userId, userId));
    const clientMap = new Map<string, string>();
    existingClients.forEach((c: any) => clientMap.set(c.name.toLowerCase(), c.id));

    const getOrCreateClient = async (clientName: string, currency = 'USD'): Promise<string | null> => {
      if (!clientName || clientName.trim() === '') return null;
      const normalized = clientName.trim().toLowerCase();
      if (clientMap.has(normalized)) return clientMap.get(normalized)!;

      const [newClient] = await this.db
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
      if (overrideRate && overrideRate > 0 && currency !== 'PKR') return overrideRate;
      if (currency === 'PKR') return 1;
      if (!rateCache.has(currency)) {
        rateCache.set(currency, await this.exchangeRateService.getRate(currency, 'PKR'));
      }
      return rateCache.get(currency)!;
    };

    const isUpworkStatement = columns.refId !== -1;

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
      const validDate = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

      const description = (columns.description !== -1 ? cells[columns.description] : '') || 'Imported transaction';
      const typeValue = (columns.type !== -1 ? cells[columns.type] : '').toLowerCase();
      const currency = ((columns.currency !== -1 ? cells[columns.currency] : '') || 'USD').toUpperCase();

      // A row is an expense when its type says so, or when the amount is negative.
      const isExpense =
        rawAmount < 0 || typeValue.includes('fee') || typeValue.includes('expense') || typeValue.includes('withdrawal');

      totalParsed++;

      if (isExpense) {
        const absAmount = Math.abs(rawAmount);
        const rate = await rateFor(currency);
        const amountPKR = Math.round(absAmount * rate * 100) / 100;

        await this.db.insert(expenses).values({
          userId,
          amount: absAmount.toFixed(2),
          currency,
          exchangeRate: rate.toFixed(4),
          amountPKR: amountPKR.toFixed(2),
          category: isUpworkStatement ? 'other' : 'other',
          description: (isUpworkStatement ? `Platform fee: ${description}` : description).slice(0, 500),
          vendor: isUpworkStatement ? 'Upwork Global Inc.' : 'CSV Import',
          expenseDate: validDate.toISOString().split('T')[0],
        });
        expenseCount++;
      } else {
        const clientName = this.extractClientName(description, isUpworkStatement);
        const clientId = await getOrCreateClient(clientName, currency);
        const rate = await rateFor(currency);
        const amountPKR = Math.round(rawAmount * rate * 100) / 100;

        await this.db.insert(income).values({
          userId,
          clientId,
          amount: rawAmount.toFixed(2),
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

    const skippedNote = skippedRows > 0 ? ` ${skippedRows} row(s) were skipped (no usable amount).` : '';

    return {
      success: true,
      totalParsed,
      incomeCount,
      expenseCount,
      clientsCreated,
      skippedRows,
      message: `Successfully imported ${totalParsed} transactions (${incomeCount} income, ${expenseCount} expenses).${skippedNote}`,
    };
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
    // Strip currency symbols/separators; keep the sign and decimal point.
    const cleaned = raw.replace(/[^0-9.-]/g, '');
    const value = parseFloat(cleaned);
    return Number.isFinite(value) ? value : 0;
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
