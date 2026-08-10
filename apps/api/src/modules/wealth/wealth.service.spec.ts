import { Test, TestingModule } from '@nestjs/testing';
import { WealthService } from './wealth.service';
import { DRIZZLE } from '../../database/database.module';
import { assets, liabilities, wealthStatements, income, expenses } from '../../database/schema';
import { createMockDb } from '../../common/testing/mock-db';

async function buildService(rows: Map<any, any[]>) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [WealthService, { provide: DRIZZLE, useValue: createMockDb(rows) }],
  }).compile();
  return module.get<WealthService>(WealthService);
}

const statement = (opening: string, adjustments = '0') => [
  { id: 'stmt-1', userId: 'user1', taxYear: '2026', openingWealthPKR: opening, otherAdjustmentsPKR: adjustments },
];

describe('WealthService.getReconciliation', () => {
  it('computes expected closing wealth from opening + income - expenses', async () => {
    const service = await buildService(
      new Map<any, any[]>([
        [wealthStatements, statement('500000')],
        [assets, [{ userId: 'user1', valuePKR: '3600000', taxYear: '2026' }]],
        [liabilities, [{ userId: 'user1', amountPKR: '900000', taxYear: '2026' }]],
        [income, [{ userId: 'user1', amountPKR: '884800', receivedAt: new Date('2026-01-10') }]],
        [expenses, [{ userId: 'user1', amountPKR: '30700', expenseDate: '2026-01-11' }]],
      ]),
    );

    const result = await service.getReconciliation('user1', '2026');

    expect(result.expectedClosingWealthPKR).toBe(1354100);
    expect(result.netDeclaredWealthPKR).toBe(2700000);
    expect(result.differencePKR).toBe(1345900);
    expect(result.reconciled).toBe(false);
  });

  it('reconciles when the gap is within the tolerance', async () => {
    const service = await buildService(
      new Map<any, any[]>([
        [wealthStatements, statement('1845900')],
        [assets, [{ userId: 'user1', valuePKR: '3600000', taxYear: '2026' }]],
        [liabilities, [{ userId: 'user1', amountPKR: '900000', taxYear: '2026' }]],
        [income, [{ userId: 'user1', amountPKR: '884800', receivedAt: new Date('2026-01-10') }]],
        [expenses, [{ userId: 'user1', amountPKR: '30700', expenseDate: '2026-01-11' }]],
      ]),
    );

    const result = await service.getReconciliation('user1', '2026');
    expect(result.differencePKR).toBe(0);
    expect(result.reconciled).toBe(true);
  });

  it('treats a gap exactly on the tolerance as reconciled', async () => {
    const service = await buildService(
      new Map<any, any[]>([
        [wealthStatements, statement('1795900')],
        [assets, [{ userId: 'user1', valuePKR: '3600000', taxYear: '2026' }]],
        [liabilities, [{ userId: 'user1', amountPKR: '900000', taxYear: '2026' }]],
        [income, [{ userId: 'user1', amountPKR: '884800', receivedAt: new Date('2026-01-10') }]],
        [expenses, [{ userId: 'user1', amountPKR: '30700', expenseDate: '2026-01-11' }]],
      ]),
    );

    const result = await service.getReconciliation('user1', '2026');
    expect(Math.abs(result.differencePKR)).toBe(result.toleranceThresholdPKR);
    expect(result.reconciled).toBe(true);
  });

  // Regression: reconciliation used to sum all-time income and expenses against
  // year-scoped assets, so any past tax year reconciled against the wrong period.
  it('only counts income and expenses inside the selected tax year', async () => {
    const service = await buildService(
      new Map<any, any[]>([
        [wealthStatements, statement('0')],
        [assets, []],
        [liabilities, []],
        [
          income,
          [
            { userId: 'user1', amountPKR: '100000', receivedAt: new Date('2026-01-10') },
            { userId: 'user1', amountPKR: '999999', receivedAt: new Date('2023-01-10') },
          ],
        ],
        [expenses, [{ userId: 'user1', amountPKR: '25000', expenseDate: '2026-02-01' }]],
      ]),
    );

    const result = await service.getReconciliation('user1', '2026');

    expect(result.totalIncomePKR).toBe(100000);
    expect(result.totalExpensesPKR).toBe(25000);
    expect(result.expectedClosingWealthPKR).toBe(75000);
    expect(result.taxYearLabel).toBe('2025-26');
  });

  it('includes other adjustments in the expected closing figure', async () => {
    const service = await buildService(
      new Map<any, any[]>([
        [wealthStatements, statement('0', '100000')],
        [assets, []],
        [liabilities, []],
        [income, []],
        [expenses, []],
      ]),
    );

    const result = await service.getReconciliation('user1', '2026');
    expect(result.expectedClosingWealthPKR).toBe(100000);
  });
});
