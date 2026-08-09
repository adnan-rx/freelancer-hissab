import { Test, TestingModule } from '@nestjs/testing';
import { TaxService } from './tax.service';
import { DRIZZLE } from '../../database/database.module';
import { income, expenses, taxRules } from '../../database/schema';
import { createMockDb } from '../../common/testing/mock-db';

/** A date safely inside tax year 2026 (1 Jul 2025 – 30 Jun 2026). */
const IN_TY2026 = new Date('2026-01-15');
const IN_TY2025 = new Date('2025-01-15');

async function buildService(rows: Map<any, any[]>) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [TaxService, { provide: DRIZZLE, useValue: createMockDb(rows) }],
  }).compile();
  return module.get<TaxService>(TaxService);
}

const seededRules = () => [
  { id: 'r1', taxYear: '2025-26', incomeType: 'IT_EXPORT_PSEB', rate: '0.0025' },
  { id: 'r2', taxYear: '2025-26', incomeType: 'IT_EXPORT_STANDARD', rate: '0.01' },
];

describe('TaxService', () => {
  it('applies the 0.25% PSEB rate to export proceeds', async () => {
    const service = await buildService(
      new Map<any, any[]>([
        [income, [{ userId: 'user1', amountPKR: '1000000', currency: 'USD', platform: 'upwork', receivedAt: IN_TY2026 }]],
        [expenses, []],
        [taxRules, seededRules()],
      ]),
    );

    const result = await service.calculateTaxEstimate('user1', true, 2026);

    expect(result.totalGrossIncomePKR).toBe(1000000);
    expect(result.exportTaxRatePercentage).toBe(0.25);
    expect(result.exportTaxLiabilityPKR).toBe(2500);
    // Saving is the gap to the standard 1% rate, read from the rules table.
    expect(result.psebSavingsPKR).toBe(7500);
  });

  it('applies the 1% standard rate when not PSEB registered', async () => {
    const service = await buildService(
      new Map<any, any[]>([
        [income, [{ userId: 'user1', amountPKR: '1000000', currency: 'USD', platform: 'upwork', receivedAt: IN_TY2026 }]],
        [expenses, []],
        [taxRules, seededRules()],
      ]),
    );

    const result = await service.calculateTaxEstimate('user1', false, 2026);

    expect(result.exportTaxRatePercentage).toBe(1.0);
    expect(result.exportTaxLiabilityPKR).toBe(10000);
    expect(result.psebSavingsPKR).toBe(0);
  });

  it('excludes transactions outside the requested tax year', async () => {
    const service = await buildService(
      new Map<any, any[]>([
        [
          income,
          [
            { userId: 'user1', amountPKR: '1000000', currency: 'USD', platform: 'upwork', receivedAt: IN_TY2026 },
            { userId: 'user1', amountPKR: '9999999', currency: 'USD', platform: 'upwork', receivedAt: IN_TY2025 },
          ],
        ],
        [expenses, [{ userId: 'user1', amountPKR: '50000', expenseDate: '2025-01-10' }]],
        [taxRules, seededRules()],
      ]),
    );

    const result = await service.calculateTaxEstimate('user1', true, 2026);

    expect(result.totalGrossIncomePKR).toBe(1000000);
    expect(result.totalExpensesPKR).toBe(0);
    expect(result.taxYearLabel).toBe('2025-26');
  });

  it('classifies PKR non-platform income as local and taxes it on the slabs', async () => {
    const service = await buildService(
      new Map<any, any[]>([
        [income, [{ userId: 'user1', amountPKR: '2000000', currency: 'PKR', platform: 'other', receivedAt: IN_TY2026 }]],
        [expenses, []],
        [taxRules, seededRules()],
      ]),
    );

    const result = await service.calculateTaxEstimate('user1', true, 2026);

    expect(result.exportIncomePKR).toBe(0);
    expect(result.localIncomePKR).toBe(2000000);
    // 15,000 + 12.5% of (2,000,000 - 1,200,000)
    expect(result.localTaxLiabilityPKR).toBe(115000);
  });

  it('deducts expenses from local income only, never from gross export proceeds', async () => {
    const service = await buildService(
      new Map<any, any[]>([
        [
          income,
          [
            { userId: 'user1', amountPKR: '2000000', currency: 'PKR', platform: 'other', receivedAt: IN_TY2026 },
            { userId: 'user1', amountPKR: '1000000', currency: 'USD', platform: 'upwork', receivedAt: IN_TY2026 },
          ],
        ],
        [expenses, [{ userId: 'user1', amountPKR: '800000', expenseDate: '2026-01-10' }]],
        [taxRules, seededRules()],
      ]),
    );

    const result = await service.calculateTaxEstimate('user1', true, 2026);

    // Local: 2,000,000 - 800,000 = 1,200,000 -> 2.5% of 600,000 = 15,000
    expect(result.localTaxLiabilityPKR).toBe(15000);
    // Export is unchanged by expenses: 0.25% of 1,000,000
    expect(result.exportTaxLiabilityPKR).toBe(2500);
    expect(result.totalTaxLiabilityPKR).toBe(17500);
  });

  it('charges no local tax below the 600,000 exemption threshold', async () => {
    const service = await buildService(
      new Map<any, any[]>([
        [income, [{ userId: 'user1', amountPKR: '600000', currency: 'PKR', platform: 'other', receivedAt: IN_TY2026 }]],
        [expenses, []],
        [taxRules, seededRules()],
      ]),
    );

    const result = await service.calculateTaxEstimate('user1', true, 2026);
    expect(result.localTaxLiabilityPKR).toBe(0);
  });

  it('reports zero rather than dividing by zero on an empty ledger', async () => {
    const service = await buildService(
      new Map<any, any[]>([[income, []], [expenses, []], [taxRules, seededRules()]]),
    );

    const result = await service.calculateTaxEstimate('user1', true, 2026);
    expect(result.totalTaxLiabilityPKR).toBe(0);
    expect(result.effectiveTaxRatePercentage).toBe(0);
  });

  describe('simulateTaxScenario', () => {
    it('taxes hypothetical export income at the export rate and ignores expenses there', async () => {
      const service = await buildService(
        new Map<any, any[]>([[income, []], [expenses, []], [taxRules, seededRules()]]),
      );

      const result = await service.simulateTaxScenario('user1', 15000000, 500000, 2026, true);

      expect(result.scenario.exportTaxPKR).toBe(37500);
      expect(result.scenario.localTaxPKR).toBe(0);
      expect(result.scenario.taxPKR).toBe(37500);
      expect(result.differencePKR).toBe(37500);
    });

    it('deducts hypothetical expenses from hypothetical local income', async () => {
      const service = await buildService(
        new Map<any, any[]>([[income, []], [expenses, []], [taxRules, seededRules()]]),
      );

      const noExpenses = await service.simulateTaxScenario('user1', 0, 0, 2026, true, 2000000);
      const withExpenses = await service.simulateTaxScenario('user1', 0, 800000, 2026, true, 2000000);

      expect(noExpenses.scenario.localTaxPKR).toBe(115000);
      expect(withExpenses.scenario.localTaxPKR).toBe(15000);
    });

    it('clamps negative inputs to zero instead of producing negative tax', async () => {
      const service = await buildService(
        new Map<any, any[]>([[income, []], [expenses, []], [taxRules, seededRules()]]),
      );

      const result = await service.simulateTaxScenario('user1', -5000000, 0, 2026, true);
      expect(result.scenario.taxPKR).toBe(0);
    });
  });
});
