import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import { income, expenses, clients } from '../../database/schema';

export interface CSVImportResult {
  success: boolean;
  totalParsed: number;
  incomeCount: number;
  expenseCount: number;
  clientsCreated: number;
  message: string;
}

@Injectable()
export class CsvService {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  async parseAndImport(userId: string, fileBuffer: Buffer, defaultExchangeRate = 280.50): Promise<CSVImportResult> {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new BadRequestException('CSV file content is empty');
    }

    const content = fileBuffer.toString('utf-8');
    const lines = content.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);

    if (lines.length < 2) {
      throw new BadRequestException('CSV file must contain a header and at least one data row');
    }

    const header = lines[0].toLowerCase();
    const rows = lines.slice(1);

    let totalParsed = 0;
    let incomeCount = 0;
    let expenseCount = 0;
    let clientsCreated = 0;

    // Fetch existing user clients for name matching
    const existingClients = await this.db.select().from(clients).where(eq(clients.userId, userId));
    const clientMap = new Map<string, string>();
    existingClients.forEach((c: any) => clientMap.set(c.name.toLowerCase(), c.id));

    const getOrCreateClient = async (clientName: string, currency = 'USD'): Promise<string | null> => {
      if (!clientName || clientName.trim() === '') return null;
      const normalized = clientName.trim().toLowerCase();
      if (clientMap.has(normalized)) {
        return clientMap.get(normalized)!;
      }

      const [newClient] = await this.db
        .insert(clients)
        .values({
          userId,
          name: clientName.trim(),
          currency,
          platform: 'other',
          status: 'active',
        })
        .returning();

      clientMap.set(normalized, newClient.id);
      clientsCreated++;
      return newClient.id;
    };

    for (const row of rows) {
      const columns = this.parseCSVLine(row);
      if (columns.length === 0) continue;

      // Handle Upwork CSV format (Date, Ref ID, Type, Description, Agency, Amount, Account)
      if (header.includes('ref id') || header.includes('type')) {
        const dateStr = columns[0] || new Date().toISOString();
        const typeStr = (columns[2] || '').toLowerCase();
        const description = columns[3] || 'Upwork Transaction';
        const rawAmount = parseFloat((columns[5] || '0').replace(/[\$,]/g, '')) || 0;

        if (rawAmount === 0) continue;

        totalParsed++;
        const parsedDate = new Date(dateStr);
        const validDate = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
        const formattedDateString = validDate.toISOString().split('T')[0];

        // Try extracting client name from description (e.g. "Invoice for TechFlow Inc")
        let clientName = 'Upwork Client';
        const clientMatch = description.match(/(?:for|from)\s+([A-Za-z0-9\s]+?)(?:-|$|\()/i);
        if (clientMatch && clientMatch[1]) {
          clientName = clientMatch[1].trim();
        }

        if (rawAmount > 0 && !typeStr.includes('fee')) {
          // Income
          const clientId = await getOrCreateClient(clientName, 'USD');
          const amountPKR = Math.round(rawAmount * defaultExchangeRate * 100) / 100;

          await this.db.insert(income).values({
            userId,
            clientId,
            amount: rawAmount.toFixed(2),
            currency: 'USD',
            exchangeRate: defaultExchangeRate.toFixed(4),
            amountPKR: amountPKR.toFixed(2),
            platform: 'upwork',
            description,
            category: 'freelance_service',
            receivedAt: validDate,
          });
          incomeCount++;
        } else {
          // Platform Fee / Expense
          const absAmount = Math.abs(rawAmount);
          await this.db.insert(expenses).values({
            userId,
            amount: absAmount.toFixed(2),
            currency: 'USD',
            category: 'software',
            description: `Upwork Fee: ${description}`,
            vendor: 'Upwork Global Inc.',
            expenseDate: formattedDateString,
          });
          expenseCount++;
        }
      } else {
        // Generic CSV Format (Date, Description, Amount, Category/Type, Currency)
        const dateStr = columns[0] || new Date().toISOString();
        const description = columns[1] || 'CSV Transaction';
        const rawAmount = parseFloat((columns[2] || '0').replace(/[\$,]/g, '')) || 0;
        const typeOrCat = (columns[3] || 'income').toLowerCase();
        const currency = (columns[4] || 'USD').toUpperCase();

        if (rawAmount === 0) continue;

        totalParsed++;
        const parsedDate = new Date(dateStr);
        const validDate = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
        const formattedDateString = validDate.toISOString().split('T')[0];
        const rate = currency === 'PKR' ? 1.0 : defaultExchangeRate;

        if (rawAmount > 0 && !typeOrCat.includes('expense')) {
          const clientId = await getOrCreateClient('Direct Client', currency);
          const amountPKR = Math.round(rawAmount * rate * 100) / 100;

          await this.db.insert(income).values({
            userId,
            clientId,
            amount: rawAmount.toFixed(2),
            currency,
            exchangeRate: rate.toFixed(4),
            amountPKR: amountPKR.toFixed(2),
            platform: 'direct',
            description,
            category: 'service_fee',
            receivedAt: validDate,
          });
          incomeCount++;
        } else {
          const absAmount = Math.abs(rawAmount);
          await this.db.insert(expenses).values({
            userId,
            amount: absAmount.toFixed(2),
            currency,
            category: 'other',
            description,
            vendor: 'CSV Import',
            expenseDate: formattedDateString,
          });
          expenseCount++;
        }
      }
    }

    return {
      success: true,
      totalParsed,
      incomeCount,
      expenseCount,
      clientsCreated,
      message: `Successfully imported ${totalParsed} transactions (${incomeCount} income, ${expenseCount} expenses).`,
    };
  }

  private parseCSVLine(text: string): string[] {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        inQuotes = !inQuotes;
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
