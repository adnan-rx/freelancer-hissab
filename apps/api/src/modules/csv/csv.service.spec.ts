import { Test, TestingModule } from '@nestjs/testing';
import { CsvService } from './csv.service';
import { DRIZZLE } from '../../database/database.module';
import { ExchangeRateService } from '../exchange-rate/exchange-rate.service';
import { clients, income, expenses } from '../../database/schema';
import { createMockDb, mockExchangeRateService } from '../../common/testing/mock-db';

async function buildService() {
  const rows = new Map<any, any[]>([[clients, []], [income, []], [expenses, []]]);
  const db = createMockDb(rows);

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      CsvService,
      { provide: DRIZZLE, useValue: db },
      { provide: ExchangeRateService, useValue: mockExchangeRateService },
    ],
  }).compile();

  return { service: module.get<CsvService>(CsvService), db };
}

describe('CsvService', () => {
  it('rejects an empty file', async () => {
    const { service } = await buildService();
    await expect(service.parseAndImport('user1', Buffer.from(''))).rejects.toThrow();
  });

  it('rejects a file with only a header row', async () => {
    const { service } = await buildService();
    await expect(service.parseAndImport('user1', Buffer.from('Date,Description,Amount'))).rejects.toThrow();
  });

  it('rejects a file with no recognisable Date/Amount columns', async () => {
    const { service } = await buildService();
    const csv = 'Foo,Bar\n1,2';
    await expect(service.parseAndImport('user1', Buffer.from(csv))).rejects.toThrow(/Date.*Amount/i);
  });

  it('splits Upwork earnings from platform fees', async () => {
    const { service } = await buildService();
    const csv = `Date,Ref ID,Type,Description,Agency,Amount,Balance
01/15/2026,98123741,Hourly,"Invoice for TechFlow Inc. - Fullstack Development",,1000.00,1000.00
01/15/2026,98123742,Service Fee,"Service Fee for TechFlow Inc.",,-100.00,900.00`;

    const result = await service.parseAndImport('user1', Buffer.from(csv), 280);

    expect(result.totalParsed).toBe(2);
    expect(result.incomeCount).toBe(1);
    expect(result.expenseCount).toBe(1);
  });

  // Regression: the old parser detected format by looking for the word "type" in the
  // header, so this generic file was parsed with Upwork's column layout and imported
  // nothing. Column mapping is now header-driven.
  it('imports a generic Date/Description/Amount/Type/Currency file', async () => {
    const { service } = await buildService();
    const csv = `Date,Description,Amount,Type,Currency
2026-08-02,"Wise Inward Wire - SaaS Consulting",2200.00,income,USD
2026-08-03,"PTCL Fiber Monthly Bill",6500.00,expense,PKR`;

    const result = await service.parseAndImport('user1', Buffer.from(csv));

    expect(result.totalParsed).toBe(2);
    expect(result.incomeCount).toBe(1);
    expect(result.expenseCount).toBe(1);
  });

  it('converts each currency at its own rate instead of one flat fallback', async () => {
    const { service, db } = await buildService();
    const csv = `Date,Description,Amount,Type,Currency
2026-08-02,"USD payment",100.00,income,USD
2026-08-03,"EUR payment",100.00,income,EUR
2026-08-04,"Local payment",100.00,income,PKR`;

    await service.parseAndImport('user1', Buffer.from(csv));

    const inserted = db._inserted.filter((i: any) => i.table === income).map((i: any) => i.values);
    expect(inserted.map((v: any) => v.amountPKR)).toEqual(['28000.00', '30000.00', '100.00']);
  });

  it('treats a negative amount as an expense even when the type says otherwise', async () => {
    const { service } = await buildService();
    const csv = `Date,Description,Amount,Type,Currency
2026-08-02,"Refund issued",-500.00,income,USD`;

    const result = await service.parseAndImport('user1', Buffer.from(csv));
    expect(result.expenseCount).toBe(1);
    expect(result.incomeCount).toBe(0);
  });

  it('skips rows with no usable amount and reports the count', async () => {
    const { service } = await buildService();
    const csv = `Date,Description,Amount,Type,Currency
2026-08-02,"Valid row",100.00,income,USD
2026-08-03,"Bad amount",abc,income,USD
2026-08-04,"Zero row",0.00,income,USD`;

    const result = await service.parseAndImport('user1', Buffer.from(csv));
    expect(result.totalParsed).toBe(1);
    expect(result.skippedRows).toBe(2);
  });

  it('keeps quoted commas inside a single field', async () => {
    const { service, db } = await buildService();
    const csv = `Date,Description,Amount,Type,Currency
2026-08-02,"Invoice for Acme, Inc. - Phase 2",100.00,income,USD`;

    await service.parseAndImport('user1', Buffer.from(csv));

    const inserted = db._inserted.filter((i: any) => i.table === income).map((i: any) => i.values);
    expect(inserted[0].description).toBe('Invoice for Acme, Inc. - Phase 2');
  });

  it('falls back to today when the date cannot be parsed', async () => {
    const { service } = await buildService();
    const csv = `Date,Description,Amount,Type,Currency
not-a-date,"Some payment",100.00,income,USD`;

    const result = await service.parseAndImport('user1', Buffer.from(csv));
    expect(result.totalParsed).toBe(1);
  });
});
