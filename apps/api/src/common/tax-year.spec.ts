import {
  parseTaxYear,
  taxYearRange,
  isWithinTaxYear,
  incomeInTaxYear,
  expensesInTaxYear,
  getCurrentTaxYear,
} from './tax-year';

describe('tax-year helpers', () => {
  it('parses every accepted tax year format to the same year', () => {
    expect(parseTaxYear(2026)).toBe(2026);
    expect(parseTaxYear('2026')).toBe(2026);
    expect(parseTaxYear('2025-26')).toBe(2026);
    expect(parseTaxYear('2025-2026')).toBe(2026);
  });

  it('rolls into the next tax year on 1 July', () => {
    expect(getCurrentTaxYear(new Date('2026-06-30T00:00:00Z'))).toBe(2026);
    expect(getCurrentTaxYear(new Date('2026-07-01T00:00:00Z'))).toBe(2027);
    expect(getCurrentTaxYear(new Date('2026-12-31T00:00:00Z'))).toBe(2027);
    expect(getCurrentTaxYear(new Date('2027-01-01T00:00:00Z'))).toBe(2027);
  });

  it('falls back to the CURRENT tax year for junk input, never a fixed year', () => {
    const current = getCurrentTaxYear();
    expect(parseTaxYear(undefined)).toBe(current);
    expect(parseTaxYear('')).toBe(current);
    expect(parseTaxYear('not-a-year')).toBe(current);
  });

  it('spans 1 July to 30 June and labels the rule year', () => {
    const range = taxYearRange(2026);
    expect(range.label).toBe('2025-26');
    expect(range.start.toISOString()).toBe('2025-07-01T00:00:00.000Z');
    expect(range.end.toISOString()).toBe('2026-07-01T00:00:00.000Z');
  });

  it('includes the first day and excludes the day after the last', () => {
    const range = taxYearRange(2026);
    expect(isWithinTaxYear('2025-07-01', range)).toBe(true);
    expect(isWithinTaxYear('2026-06-30', range)).toBe(true);
    expect(isWithinTaxYear('2025-06-30', range)).toBe(false);
    expect(isWithinTaxYear('2026-07-01', range)).toBe(false);
  });

  it('rejects empty and unparseable dates rather than counting them', () => {
    const range = taxYearRange(2026);
    expect(isWithinTaxYear(null, range)).toBe(false);
    expect(isWithinTaxYear(undefined, range)).toBe(false);
    expect(isWithinTaxYear('gibberish', range)).toBe(false);
  });

  it('filters income by receivedAt and expenses by expenseDate', () => {
    const range = taxYearRange(2026);

    const income = [
      { id: 'in-range', receivedAt: new Date('2026-01-15') },
      { id: 'previous-year', receivedAt: new Date('2025-03-01') },
      { id: 'next-year', receivedAt: new Date('2026-08-01') },
      { id: 'created-fallback', createdAt: new Date('2025-09-09') },
    ];
    expect(incomeInTaxYear(income, range).map((r) => r.id)).toEqual(['in-range', 'created-fallback']);

    const expenses = [
      { id: 'in-range', expenseDate: '2025-12-31' },
      { id: 'out-of-range', expenseDate: '2024-12-31' },
    ];
    expect(expensesInTaxYear(expenses, range).map((r) => r.id)).toEqual(['in-range']);
  });
});
