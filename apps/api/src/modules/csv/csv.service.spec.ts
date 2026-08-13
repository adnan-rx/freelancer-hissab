import { Test, TestingModule } from '@nestjs/testing';
import { CsvService } from './csv.service';
import { ImportEngineService } from '../integrations/import-engine.service';
import { DRIZZLE } from '../../database/database.module';
import { ExchangeRateService } from '../exchange-rate/exchange-rate.service';
import { clients, expenses, income, invoiceItems, invoices } from '../../database/schema';
import { createMockDb, mockExchangeRateService } from '../../common/testing/mock-db';

const USER = 'user1';

async function buildService(seed: Array<[unknown, unknown[]]> = []) {
  const rows = new Map<unknown, unknown[]>([
    [clients, []],
    [income, []],
    [expenses, []],
    [invoices, []],
    [invoiceItems, []],
    ...seed,
  ]);
  const db = createMockDb(rows);

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      CsvService,
      ImportEngineService,
      { provide: DRIZZLE, useValue: db },
      { provide: ExchangeRateService, useValue: mockExchangeRateService },
    ],
  }).compile();

  return { service: module.get(CsvService), db };
}

const rowsOf = (db: ReturnType<typeof createMockDb>, table: unknown) =>
  db._inserted.filter((i: { table: unknown }) => i.table === table).map((i: { values: never }) => i.values);

describe('CsvService', () => {
  describe('File validation', () => {
    it('rejects an empty file', async () => {
      const { service } = await buildService();
      await expect(service.parseAndImport(USER, Buffer.from(''))).rejects.toThrow();
    });

    it('rejects a file with only a header row', async () => {
      const { service } = await buildService();
      await expect(service.parseAndImport(USER, Buffer.from('Date,Description,Amount'))).rejects.toThrow();
    });

    it('rejects a file with no recognisable Date/Amount columns', async () => {
      const { service } = await buildService();
      await expect(service.parseAndImport(USER, Buffer.from('Foo,Bar\n1,2'))).rejects.toThrow(/Date.*Amount/i);
    });

    it('rejects a file over the size cap', async () => {
      const { service } = await buildService();
      const oversized = Buffer.alloc(6 * 1024 * 1024, 'a');
      await expect(service.parseAndImport(USER, oversized)).rejects.toThrow(/maximum supported size/i);
    });
  });

  describe('Platform statements', () => {
    it('splits Upwork earnings from platform fees', async () => {
      const { service } = await buildService();
      const csv = `Date,Ref ID,Type,Description,Agency,Amount,Balance
01/15/2026,98123741,Hourly,"Invoice for TechFlow Inc. - Fullstack Development",,1000.00,1000.00
01/15/2026,98123742,Service Fee,"Service Fee for TechFlow Inc.",,-100.00,900.00`;

      const result = await service.parseAndImport(USER, Buffer.from(csv), 280);

      expect(result.platform).toBe('upwork');
      expect(result).toMatchObject({ totalParsed: 2, incomeCount: 1, expenseCount: 1 });
    });

    it('imports a Fiverr statement with gross and service fee on one line', async () => {
      const { service, db } = await buildService();
      const csv = `Date,Order ID,Item Description,Buyer,Gross Amount,Service Fee,Net Amount,Status
08/02/2026,FO18293741,"Fullstack Next.js Web App Development",design_studio,1000.00,-200.00,800.00,Cleared
08/05/2026,FO18293742,"Custom Logo & Branding Package",marketing_pro,350.00,-70.00,280.00,Cleared`;

      const result = await service.parseAndImport(USER, Buffer.from(csv), 280);

      expect(result.platform).toBe('fiverr');
      expect(result).toMatchObject({ incomeCount: 2, expenseCount: 2, clientsCreated: 2, invoicesCreated: 2 });

      const invoiceRows = rowsOf(db, invoices);
      expect(invoiceRows).toHaveLength(2);
      expect(invoiceRows[0].invoiceNumber).toBe('FO18293741');

      const expenseRows = rowsOf(db, expenses);
      expect(expenseRows[0]).toMatchObject({ vendor: 'Fiverr', amount: '200.00', category: 'other' });

      const clientRows = rowsOf(db, clients);
      expect(clientRows[0]).toMatchObject({ name: 'design_studio', platform: 'fiverr' });
    });

    it('imports a generic Date/Description/Amount/Type/Currency file', async () => {
      const { service } = await buildService();
      const csv = `Date,Description,Amount,Type,Currency
2026-08-02,"Wise Inward Wire - SaaS Consulting",2200.00,income,USD
2026-08-03,"PTCL Fiber Monthly Bill",6500.00,expense,PKR`;

      const result = await service.parseAndImport(USER, Buffer.from(csv));

      expect(result).toMatchObject({ platform: 'generic', totalParsed: 2, incomeCount: 1, expenseCount: 1 });
    });
  });

  describe('Amounts and currency', () => {
    it('converts each currency at its own rate instead of one flat fallback', async () => {
      const { service, db } = await buildService();
      const csv = `Date,Description,Amount,Type,Currency
2026-08-02,"USD payment",100.00,income,USD
2026-08-03,"EUR payment",100.00,income,EUR
2026-08-04,"Local payment",100.00,income,PKR`;

      await service.parseAndImport(USER, Buffer.from(csv));

      expect(rowsOf(db, income).map((v: { amountPKR: string }) => v.amountPKR)).toEqual([
        '28000.00',
        '30000.00',
        '100.00',
      ]);
    });

    it('applies an explicit rate override to non-PKR rows only', async () => {
      const { service, db } = await buildService();
      const csv = `Date,Description,Amount,Type,Currency
2026-08-02,"USD payment",100.00,income,USD
2026-08-03,"Local payment",100.00,income,PKR`;

      await service.parseAndImport(USER, Buffer.from(csv), 300);

      expect(rowsOf(db, income).map((v: { amountPKR: string }) => v.amountPKR)).toEqual(['30000.00', '100.00']);
    });

    it('treats accounting-style parentheses as a negative amount', async () => {
      const { service, db } = await buildService();
      const csv = `Date,Description,Amount
2026-08-02,"Platform fee",(45.00)`;

      const result = await service.parseAndImport(USER, Buffer.from(csv));

      expect(result.expenseCount).toBe(1);
      expect(rowsOf(db, expenses)[0].amount).toBe('45.00');
    });

    it('treats a negative amount as an expense even when the type says otherwise', async () => {
      const { service } = await buildService();
      const csv = `Date,Description,Amount,Type,Currency
2026-08-02,"Refund issued",-500.00,income,USD`;

      const result = await service.parseAndImport(USER, Buffer.from(csv));

      expect(result).toMatchObject({ expenseCount: 1, incomeCount: 0 });
    });
  });

  describe('Malformed rows', () => {
    it('skips rows with no usable amount and reports the count', async () => {
      const { service } = await buildService();
      const csv = `Date,Description,Amount,Type,Currency
2026-08-02,"Valid row",100.00,income,USD
2026-08-03,"Bad amount",abc,income,USD
2026-08-04,"Zero row",0.00,income,USD`;

      const result = await service.parseAndImport(USER, Buffer.from(csv));

      expect(result).toMatchObject({ totalParsed: 1, skippedRows: 2 });
    });

    it('skips rows whose date cannot be parsed and reports them', async () => {
      const { service } = await buildService();
      const csv = `Date,Description,Amount,Type,Currency
not-a-date,"Some payment",100.00,income,USD
2026-08-02,"A valid one",50.00,income,USD`;

      const result = await service.parseAndImport(USER, Buffer.from(csv));

      expect(result).toMatchObject({ totalParsed: 1, invalidDateRows: 1, incomeCount: 1 });
    });

    it('keeps quoted commas inside a single field', async () => {
      const { service, db } = await buildService();
      const csv = `Date,Description,Amount,Type,Currency
2026-08-02,"Invoice for Acme, Inc. - Phase 2",100.00,income,USD`;

      await service.parseAndImport(USER, Buffer.from(csv));

      expect(rowsOf(db, income)[0].description).toBe('Invoice for Acme, Inc. - Phase 2');
    });
  });

  describe('Invoices and clients', () => {
    it('creates an invoice and line item when an invoice number is present', async () => {
      const { service, db } = await buildService();
      const csv = `Date,Invoice Number,Client Name,Description,Amount,Type,Currency
2026-08-02,INV-2026-001,Acme Corp,"Invoice INV-2026-001 for Acme Corp",1500.00,income,USD`;

      const result = await service.parseAndImport(USER, Buffer.from(csv));

      expect(result).toMatchObject({ incomeCount: 1, invoicesCreated: 1 });
      expect(rowsOf(db, invoices)[0]).toMatchObject({
        invoiceNumber: 'INV-2026-001',
        total: '1500.00',
        status: 'paid',
      });
      expect(rowsOf(db, invoiceItems)[0].amount).toBe('1500.00');
      expect(rowsOf(db, income)[0].invoiceId).toBeDefined();
    });

    it('reuses an existing client instead of creating a near-duplicate', async () => {
      const { service, db } = await buildService([
        [clients, [{ id: 'client-1', userId: USER, name: 'acme corp' }]],
      ]);
      const csv = `Date,Client Name,Description,Amount,Type,Currency
2026-08-02,ACME Corp,"Phase 2 delivery",1500.00,income,USD`;

      const result = await service.parseAndImport(USER, Buffer.from(csv));

      expect(result.clientsCreated).toBe(0);
      expect(rowsOf(db, income)[0].clientId).toBe('client-1');
    });
  });

  describe('Idempotency', () => {
    it('imports the same statement twice without duplicating anything', async () => {
      const { service, db } = await buildService();
      const csv = `Date,Order ID,Item Description,Buyer,Gross Amount,Service Fee,Net Amount,Status
08/02/2026,FO18293741,"Next.js E-Commerce Portal",alpha_client,1000.00,-200.00,800.00,Cleared`;

      const first = await service.parseAndImport(USER, Buffer.from(csv), 280);
      const second = await service.parseAndImport(USER, Buffer.from(csv), 280);

      expect(first).toMatchObject({ incomeCount: 1, expenseCount: 1 });
      expect(second).toMatchObject({ incomeCount: 0, expenseCount: 0, duplicateRows: 2 });
      expect(rowsOf(db, income)).toHaveLength(1);
      expect(rowsOf(db, expenses)).toHaveLength(1);
      expect(rowsOf(db, clients)).toHaveLength(1);
    });

    it('deduplicates a file without reference columns by row content', async () => {
      const { service, db } = await buildService();
      const csv = `Date,Description,Amount,Type,Currency
2026-08-02,"Consulting retainer",900.00,income,USD`;

      await service.parseAndImport(USER, Buffer.from(csv));
      const second = await service.parseAndImport(USER, Buffer.from(csv));

      expect(second.duplicateRows).toBe(1);
      expect(rowsOf(db, income)).toHaveLength(1);
    });

    it('keeps two genuinely identical transactions from the same file', async () => {
      const { service, db } = await buildService();
      const csv = `Date,Description,Amount,Type,Currency
2026-08-02,"Hourly block",250.00,income,USD
2026-08-02,"Hourly block",250.00,income,USD`;

      const result = await service.parseAndImport(USER, Buffer.from(csv));

      expect(result.incomeCount).toBe(2);
      expect(rowsOf(db, income)).toHaveLength(2);
    });

    it('skips a row that duplicates a manually entered record', async () => {
      const { service } = await buildService([
        [
          income,
          [
            {
              id: 'manual-1',
              userId: USER,
              amount: '100.00',
              description: 'Some payment',
              receivedAt: new Date('2026-08-02'),
              externalId: null,
            },
          ],
        ],
      ]);
      const csv = `Date,Description,Amount,Type,Currency
2026-08-02,"Some payment",100.00,income,USD`;

      const result = await service.parseAndImport(USER, Buffer.from(csv));

      expect(result).toMatchObject({ totalParsed: 0, duplicateRows: 1 });
    });
  });

  describe('Preview', () => {
    it('reports totals per currency and writes nothing', async () => {
      const { service, db } = await buildService();
      const csv = `Date,Order ID,Item Description,Buyer,Gross Amount,Service Fee,Net Amount,Status
08/02/2026,FO18293741,"Next.js E-Commerce Portal",alpha_client,1000.00,-200.00,800.00,Cleared`;

      const preview = await service.previewImport(USER, Buffer.from(csv), 280);

      expect(db._inserted).toHaveLength(0);
      expect(preview).toMatchObject({
        detectedPlatform: 'fiverr',
        incomeCount: 1,
        expenseCount: 1,
        grossTotalPKR: 280000,
        feesTotalPKR: 56000,
        netTotalPKR: 224000,
        newInvoiceCount: 1,
      });
      expect(preview.newClients).toContain('alpha_client');
      expect(preview.currencyTotals).toEqual([{ currency: 'USD', gross: 1000, fees: 200, net: 800 }]);
      expect(preview.previewItems).toHaveLength(2);
    });

    it('warns about rows the parser could not use', async () => {
      const { service } = await buildService();
      const csv = `Date,Description,Amount,Type,Currency
2026-08-02,"Valid row",100.00,income,USD
2026-08-03,"Bad amount",abc,income,USD
not-a-date,"Bad date",50.00,income,USD`;

      const preview = await service.previewImport(USER, Buffer.from(csv));

      expect(preview.skippedRows).toBe(1);
      expect(preview.invalidDateRows).toBe(1);
      expect(preview.warnings.join(' ')).toMatch(/no usable amount/i);
      expect(preview.warnings.join(' ')).toMatch(/unreadable date/i);
    });

    it('marks rows already in the ledger as duplicates', async () => {
      const { service } = await buildService();
      const csv = `Date,Description,Amount,Type,Currency
2026-08-02,"Consulting retainer",900.00,income,USD`;
      await service.parseAndImport(USER, Buffer.from(csv));

      const preview = await service.previewImport(USER, Buffer.from(csv));

      expect(preview.duplicateCount).toBe(1);
      expect(preview.incomeCount).toBe(0);
      expect(preview.previewItems[0].isDuplicate).toBe(true);
    });
  });

  describe('Tax neutrality', () => {
    it('writes no SBP code of its own, but passes one through when stated', async () => {
      const { service, db } = await buildService();
      const plain = `Date,Description,Amount,Type,Currency
2026-08-02,"Consulting",900.00,income,USD`;
      const stated = `Date,Description,Amount,Type,Currency,SBP Purpose Code,PRC Reference
2026-08-03,"Consulting two",900.00,income,USD,9186,PRC-77`;

      await service.parseAndImport(USER, Buffer.from(plain));
      await service.parseAndImport(USER, Buffer.from(stated));

      const [derived, passedThrough] = rowsOf(db, income);
      expect(derived).not.toHaveProperty('sbpPurposeCode');
      expect(passedThrough).toMatchObject({ sbpPurposeCode: '9186', prcReferenceNumber: 'PRC-77' });
    });
  });
});
