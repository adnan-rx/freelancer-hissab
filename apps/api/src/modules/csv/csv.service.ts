import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import { income, expenses, clients, invoices, invoiceItems } from '../../database/schema';
import { ExchangeRateService } from '../exchange-rate/exchange-rate.service';
import { round2, round4 } from '../../common/money';

export const MAX_CSV_BYTES = 5 * 1024 * 1024; // 5MB — used to be enforced only in the browser.

export interface CSVImportResult {
  success: boolean;
  totalParsed: number;
  incomeCount: number;
  expenseCount: number;
  clientsCreated: number;
  invoicesCreated: number;
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
  type: ['type', 'transaction type'],
  category: ['category', 'expense category', 'income category'],
  currency: ['currency', 'ccy'],
  refId: ['ref id', 'reference id', 'ref', 'reference'],
  invoiceNumber: ['invoice number', 'invoice #', 'invoice no', 'invoice id', 'inv #', 'inv no', 'invoice', 'inv num'],
  invoiceStatus: ['invoice status', 'status', 'payment status'],
  dueDate: ['invoice due date', 'due date'],
  clientName: ['client name', 'client', 'customer'],
  clientCompany: ['client company', 'company'],
  clientEmail: ['client email', 'email'],
  clientPhone: ['client phone', 'phone'],
  clientPlatform: ['client platform', 'platform'],
  vendor: ['vendor payee', 'vendor', 'payee'],
  sbpPurposeCode: ['sbp purpose code', 'sbp purpose', 'purpose code', 'sbp code'],
  prcReferenceNumber: ['prc reference number', 'prc reference', 'prc ref', 'prc #', 'prc number', 'prc'],
};

const VALID_PLATFORMS = new Set(['upwork', 'fiverr', 'freelancer', 'direct', 'other']);
const VALID_EXPENSE_CATEGORIES = new Set([
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
]);

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

    return this.db.transaction(async (tx: any) => {
      let totalParsed = 0;
      let incomeCount = 0;
      let expenseCount = 0;
      let clientsCreated = 0;
      let invoicesCreated = 0;
      let skippedRows = 0;
      let duplicateRows = 0;
      let invalidDateRows = 0;

      const existingClients = await tx.select().from(clients).where(eq(clients.userId, userId));
      const clientMap = new Map<string, string>();
      existingClients.forEach((c: any) => clientMap.set(c.name.toLowerCase(), c.id));

      const existingInvoices = await tx.select().from(invoices).where(eq(invoices.userId, userId));
      const invoiceMap = new Map<string, string>();
      existingInvoices.forEach((inv: any) => invoiceMap.set(inv.invoiceNumber.toLowerCase(), inv.id));

      const seenSignatures = new Set<string>();
      const existingIncome = await tx.select().from(income).where(eq(income.userId, userId));
      const existingExpenses = await tx.select().from(expenses).where(eq(expenses.userId, userId));
      existingIncome.forEach((r: any) =>
        seenSignatures.add(this.signature(r.receivedAt, r.amount, r.description)),
      );
      existingExpenses.forEach((r: any) =>
        seenSignatures.add(this.signature(r.expenseDate, r.amount, r.description)),
      );

      const getOrCreateClient = async (
        clientName: string,
        currency = 'USD',
        company?: string,
        email?: string,
        phone?: string,
        platform?: string,
      ): Promise<string | null> => {
        if (!clientName || clientName.trim() === '') return null;
        const normalized = clientName.trim().toLowerCase();
        if (clientMap.has(normalized)) return clientMap.get(normalized)!;

        const normalizedPlatform =
          platform && VALID_PLATFORMS.has(platform.toLowerCase())
            ? (platform.toLowerCase() as any)
            : isUpworkStatement
              ? 'upwork'
              : 'direct';

        const [newClient] = await tx
          .insert(clients)
          .values({
            userId,
            name: clientName.trim().slice(0, 255),
            company: company ? company.trim().slice(0, 255) : null,
            email: email ? email.trim().slice(0, 255) : null,
            phone: phone ? phone.trim().slice(0, 50) : null,
            platform: normalizedPlatform,
            currency: currency.toUpperCase().slice(0, 3),
            status: 'active',
          })
          .returning();

        clientMap.set(normalized, newClient.id);
        clientsCreated++;
        return newClient.id;
      };

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
          invalidDateRows++;
          continue;
        }
        const validDate = parsedDate;

        const description = (columns.description !== -1 ? cells[columns.description] : '') || 'Imported transaction';
        const typeValue = (columns.type !== -1 ? cells[columns.type] : '').toLowerCase();
        const rawCategory = columns.category !== -1 ? cells[columns.category] : '';
        const currency = ((columns.currency !== -1 ? cells[columns.currency] : '') || 'USD').toUpperCase();
        const clientNameVal = columns.clientName !== -1 ? cells[columns.clientName] : '';
        const clientCompanyVal = columns.clientCompany !== -1 ? cells[columns.clientCompany] : '';
        const clientEmailVal = columns.clientEmail !== -1 ? cells[columns.clientEmail] : '';
        const clientPhoneVal = columns.clientPhone !== -1 ? cells[columns.clientPhone] : '';
        const clientPlatformVal = columns.clientPlatform !== -1 ? cells[columns.clientPlatform] : '';
        const vendorVal = columns.vendor !== -1 ? cells[columns.vendor] : '';
        const rawInvoiceNum = columns.invoiceNumber !== -1 ? cells[columns.invoiceNumber] : '';
        const rawInvoiceStatus = columns.invoiceStatus !== -1 ? cells[columns.invoiceStatus] : '';
        const dueDateVal = columns.dueDate !== -1 ? cells[columns.dueDate] : '';
        const sbpPurposeVal = columns.sbpPurposeCode !== -1 ? cells[columns.sbpPurposeCode] : '';
        const prcRefVal = columns.prcReferenceNumber !== -1 ? cells[columns.prcReferenceNumber] : '';

        const signature = this.signature(validDate, Math.abs(rawAmount).toFixed(2), description);
        if (seenSignatures.has(signature)) {
          duplicateRows++;
          continue;
        }
        seenSignatures.add(signature);

        const isExpense =
          rawAmount < 0 || typeValue.includes('fee') || typeValue.includes('expense') || typeValue.includes('withdrawal');

        totalParsed++;

        if (isExpense) {
          const absAmount = round2(Math.abs(rawAmount));
          const rate = await rateFor(currency);
          const amountPKR = round2(absAmount * rate);

          let expenseCategory = 'other';
          if (rawCategory && VALID_EXPENSE_CATEGORIES.has(rawCategory.toLowerCase())) {
            expenseCategory = rawCategory.toLowerCase();
          }

          const vendorName =
            vendorVal.trim() || (isUpworkStatement ? 'Upwork Global Inc.' : 'CSV Import');

          await tx.insert(expenses).values({
            userId,
            amount: absAmount.toFixed(2),
            currency,
            exchangeRate: rate.toFixed(4),
            amountPKR: amountPKR.toFixed(2),
            category: expenseCategory as any,
            description: (isUpworkStatement ? `Platform fee: ${description}` : description).slice(0, 500),
            vendor: vendorName.slice(0, 255),
            expenseDate: validDate.toISOString().split('T')[0],
          });
          expenseCount++;
        } else {
          const clientName = clientNameVal.trim() || this.extractClientName(description, isUpworkStatement);
          const platform =
            clientPlatformVal.trim().toLowerCase() || (isUpworkStatement ? 'upwork' : 'direct');
          const clientId = await getOrCreateClient(
            clientName,
            currency,
            clientCompanyVal,
            clientEmailVal,
            clientPhoneVal,
            platform,
          );
          const rate = await rateFor(currency);
          const amount = round2(rawAmount);
          const amountPKR = round2(amount * rate);

          let invoiceNumber = rawInvoiceNum.trim();
          if (!invoiceNumber) {
            const invoiceMatch = description.match(/(?:invoice|inv)[:#\s]+([A-Za-z0-9-_]+)/i);
            if (invoiceMatch && invoiceMatch[1]) {
              invoiceNumber = invoiceMatch[1].trim();
            }
          }

          let invoiceId: string | null = null;
          if (invoiceNumber && clientId) {
            const normalizedInvKey = invoiceNumber.toLowerCase();
            if (invoiceMap.has(normalizedInvKey)) {
              invoiceId = invoiceMap.get(normalizedInvKey)!;
            } else {
              const invStatus = ['draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled'].includes(
                rawInvoiceStatus.toLowerCase(),
              )
                ? (rawInvoiceStatus.toLowerCase() as any)
                : 'paid';

              const [newInvoice] = await tx
                .insert(invoices)
                .values({
                  userId,
                  clientId,
                  invoiceNumber: invoiceNumber.slice(0, 50),
                  subtotal: amount.toFixed(2),
                  taxRate: '0.00',
                  taxAmount: '0.00',
                  discountAmount: '0.00',
                  total: amount.toFixed(2),
                  currency,
                  exchangeRate: rate.toFixed(4),
                  totalPKR: amountPKR.toFixed(2),
                  status: invStatus,
                  dueDate: dueDateVal || validDate.toISOString().split('T')[0],
                  paidAt: invStatus === 'paid' ? validDate : null,
                  notes: description.slice(0, 500),
                  createdAt: validDate,
                  updatedAt: validDate,
                })
                .returning();

              invoiceId = newInvoice.id;
              invoiceMap.set(normalizedInvKey, newInvoice.id);
              invoicesCreated++;

              await tx.insert(invoiceItems).values({
                invoiceId: newInvoice.id,
                description: description.slice(0, 500),
                quantity: '1.00',
                rate: amount.toFixed(2),
                amount: amount.toFixed(2),
                sortOrder: 0,
              });
            }
          }

          const isExport =
            currency !== 'PKR' || ['upwork', 'fiverr', 'freelancer'].includes(platform.toLowerCase());
          const finalSbpCode = sbpPurposeVal.trim() || (isExport ? '9100' : null);
          const finalPrcRef = prcRefVal.trim() || null;

          await tx.insert(income).values({
            userId,
            clientId,
            invoiceId,
            amount: amount.toFixed(2),
            currency,
            exchangeRate: rate.toFixed(4),
            amountPKR: amountPKR.toFixed(2),
            platform: VALID_PLATFORMS.has(platform) ? (platform as any) : 'direct',
            description: description.slice(0, 500),
            category: rawCategory.trim() || 'freelance_service',
            sbpPurposeCode: finalSbpCode,
            prcReferenceNumber: finalPrcRef,
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
        invoicesCreated,
        skippedRows,
        duplicateRows,
        invalidDateRows,
        message: `Successfully imported ${totalParsed} transactions (${incomeCount} income, ${expenseCount} expenses, ${invoicesCreated} invoices).${note}`,
      };
    });
  }

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
      category: find(COLUMN_ALIASES.category),
      currency: find(COLUMN_ALIASES.currency),
      refId: find(COLUMN_ALIASES.refId),
      invoiceNumber: find(COLUMN_ALIASES.invoiceNumber),
      invoiceStatus: find(COLUMN_ALIASES.invoiceStatus),
      dueDate: find(COLUMN_ALIASES.dueDate),
      clientName: find(COLUMN_ALIASES.clientName),
      clientCompany: find(COLUMN_ALIASES.clientCompany),
      clientEmail: find(COLUMN_ALIASES.clientEmail),
      clientPhone: find(COLUMN_ALIASES.clientPhone),
      clientPlatform: find(COLUMN_ALIASES.clientPlatform),
      vendor: find(COLUMN_ALIASES.vendor),
      sbpPurposeCode: find(COLUMN_ALIASES.sbpPurposeCode),
      prcReferenceNumber: find(COLUMN_ALIASES.prcReferenceNumber),
    };
  }

  private parseAmount(raw?: string): number {
    if (!raw) return 0;
    const trimmed = raw.trim();
    const isAccountingNegative = /^\(.*\)$/.test(trimmed);
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
