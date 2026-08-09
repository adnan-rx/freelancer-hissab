import { Test, TestingModule } from '@nestjs/testing';
import { FilingService } from './filing.service';
import { WealthService } from '../wealth/wealth.service';
import { DRIZZLE } from '../../database/database.module';
import { users, income, expenses, invoices, evidenceDocuments } from '../../database/schema';
import { createMockDb } from '../../common/testing/mock-db';

const USER = 'user1';
const IN_YEAR = new Date('2026-01-15');

interface Fixture {
  psebId?: string | null;
  income?: any[];
  expenses?: any[];
  invoices?: any[];
  evidence?: any[];
  reconciled?: boolean;
}

async function buildService(fixture: Fixture = {}) {
  const rows = new Map<any, any[]>([
    [users, [{ id: USER, userId: USER, psebId: 'psebId' in fixture ? fixture.psebId : 'PSEB-1' }]],
    [income, fixture.income ?? []],
    [expenses, fixture.expenses ?? []],
    [invoices, fixture.invoices ?? []],
    [evidenceDocuments, fixture.evidence ?? []],
  ]);

  const wealthService = {
    getReconciliation: jest.fn(async () => ({
      reconciled: fixture.reconciled ?? true,
      differencePKR: fixture.reconciled === false ? 250000 : 0,
    })),
  };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      FilingService,
      { provide: DRIZZLE, useValue: createMockDb(rows) },
      { provide: WealthService, useValue: wealthService },
    ],
  }).compile();

  return module.get<FilingService>(FilingService);
}

/** A ledger that passes every check, so each test can break exactly one thing. */
const cleanFixture = (): Fixture => ({
  psebId: 'PSEB-2026-1',
  income: [
    {
      id: 'inc-1',
      userId: USER,
      currency: 'USD',
      platform: 'upwork',
      exchangeRate: '280',
      sbpPurposeCode: '9100',
      prcReferenceNumber: 'PRC-1',
      receivedAt: IN_YEAR,
    },
  ],
  expenses: [{ id: 'exp-1', userId: USER, category: 'software', expenseDate: '2026-01-10' }],
  invoices: [],
  evidence: [{ id: 'doc-1', userId: USER, incomeId: 'inc-1' }],
  reconciled: true,
});

describe('FilingService.getReadinessScore', () => {
  it('reports 100% when every check passes', async () => {
    const service = await buildService(cleanFixture());
    const result = await service.getReadinessScore(USER);

    expect(result.score).toBe(100);
    expect(result.status).toBe('READY');
    expect(result.issues).toHaveLength(0);
  });

  it('flags a missing PSEB id and points at settings', async () => {
    const service = await buildService({ ...cleanFixture(), psebId: null });
    const result = await service.getReadinessScore(USER);

    const issue = result.issues.find((i) => i.code === 'MISSING_PROFILE_INFO');
    expect(issue).toBeDefined();
    expect(issue!.fixPath).toBe('/settings');
    expect(result.profileComplete).toBe(false);
  });

  // Regression: the old check flagged any rate of exactly 280, which was also the
  // hardcoded fallback the UI produced — so the score could never reach 100%.
  it('does not flag a legitimate 280 exchange rate', async () => {
    const service = await buildService(cleanFixture());
    const result = await service.getReadinessScore(USER);

    expect(result.issues.some((i) => i.code === 'MISSING_EXCHANGE_RATE')).toBe(false);
  });

  it('flags foreign income left at an unconverted rate of 1', async () => {
    const fixture = cleanFixture();
    fixture.income![0].exchangeRate = '1';
    const service = await buildService(fixture);
    const result = await service.getReadinessScore(USER);

    expect(result.issues.some((i) => i.code === 'MISSING_EXCHANGE_RATE')).toBe(true);
  });

  it('flags export income missing a PRC reference and lists the record id', async () => {
    const fixture = cleanFixture();
    fixture.income![0].prcReferenceNumber = null;
    const service = await buildService(fixture);
    const result = await service.getReadinessScore(USER);

    const issue = result.issues.find((i) => i.code === 'MISSING_PRC_SBP');
    expect(issue).toBeDefined();
    expect(issue!.recordIds).toEqual(['inc-1']);
    expect(issue!.fixPath).toBe('/income');
  });

  it('flags a paid invoice with no linked income record', async () => {
    const fixture = cleanFixture();
    fixture.invoices = [{ id: 'inv-1', userId: USER, status: 'paid', createdAt: IN_YEAR }];
    const service = await buildService(fixture);
    const result = await service.getReadinessScore(USER);

    expect(result.issues.some((i) => i.code === 'ORPHANED_PAID_INVOICE')).toBe(true);
  });

  it('does not flag a paid invoice that has a linked income record', async () => {
    const fixture = cleanFixture();
    fixture.invoices = [{ id: 'inv-1', userId: USER, status: 'paid', createdAt: IN_YEAR }];
    fixture.income![0].invoiceId = 'inv-1';
    const service = await buildService(fixture);
    const result = await service.getReadinessScore(USER);

    expect(result.issues.some((i) => i.code === 'ORPHANED_PAID_INVOICE')).toBe(false);
  });

  it('flags expenses left in the catch-all category', async () => {
    const fixture = cleanFixture();
    fixture.expenses = [{ id: 'exp-1', userId: USER, category: 'other', expenseDate: '2026-01-10' }];
    const service = await buildService(fixture);
    const result = await service.getReadinessScore(USER);

    expect(result.issues.some((i) => i.code === 'EXPENSE_MISSING_CATEGORY')).toBe(true);
  });

  it('incorporates wealth reconciliation, which used to be ignored by the score', async () => {
    const service = await buildService({ ...cleanFixture(), reconciled: false });
    const result = await service.getReadinessScore(USER);

    expect(result.issues.some((i) => i.code === 'WEALTH_NOT_RECONCILED')).toBe(true);
    expect(result.wealthReconciled).toBe(false);
    expect(result.score).toBeLessThan(100);
  });

  it('reports evidence coverage and flags undocumented income', async () => {
    const fixture = cleanFixture();
    fixture.evidence = [];
    const service = await buildService(fixture);
    const result = await service.getReadinessScore(USER);

    expect(result.evidenceCoveragePercent).toBe(0);
    expect(result.issues.some((i) => i.code === 'MISSING_EVIDENCE')).toBe(true);
  });

  it('ignores transactions outside the requested tax year', async () => {
    const fixture = cleanFixture();
    // A bad record in a different tax year must not drag this year's score down.
    fixture.income!.push({
      id: 'inc-old',
      userId: USER,
      currency: 'USD',
      platform: 'upwork',
      exchangeRate: '1',
      sbpPurposeCode: null,
      prcReferenceNumber: null,
      receivedAt: new Date('2023-01-15'),
    });

    const service = await buildService(fixture);
    const result = await service.getReadinessScore(USER);

    expect(result.score).toBe(100);
  });
});

describe('FilingService.getChecklist', () => {
  // Regression: the checklist hardcoded wealth and evidence items as permanently
  // blocked, long after both features shipped.
  it('marks wealth and evidence complete when those features report success', async () => {
    const service = await buildService(cleanFixture());
    const checklist = await service.getChecklist(USER);

    const items = checklist.stages.flatMap((s: any) => s.items);
    const byLabel = (fragment: string) => items.find((i: any) => i.label.includes(fragment));

    expect(byLabel('Wealth reconciled')!.complete).toBe(true);
    expect(byLabel('Supporting documents')!.complete).toBe(true);
    expect(checklist.overallPercent).toBe(100);
    // No item may still claim to be blocked by an unbuilt feature.
    expect(items.some((i: any) => 'blockedByFeature' in i)).toBe(false);
  });

  it('reflects a wealth mismatch in the checklist', async () => {
    const service = await buildService({ ...cleanFixture(), reconciled: false });
    const checklist = await service.getChecklist(USER);

    const items = checklist.stages.flatMap((s: any) => s.items);
    expect(items.find((i: any) => i.label.includes('Wealth reconciled'))!.complete).toBe(false);
  });
});
