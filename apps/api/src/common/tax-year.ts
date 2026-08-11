/**
 * Pakistani tax year helpers.
 *
 * Tax year N runs 1 July (N-1) → 30 June (N). e.g. tax year 2026 = 2025-07-01 .. 2026-06-30.
 * Accepts "2026", 2026, or "2025-26" — all resolve to the same window.
 */

/**
 * The tax year we are currently inside, derived from the clock.
 *
 * This was a hardcoded `DEFAULT_TAX_YEAR = 2026`, which silently went stale on
 * 1 July 2026: every default-scoped estimate, wealth reconciliation and filing
 * check kept reporting the *previous* year, so income entered "today" was
 * invisible until the user manually changed the year.
 *
 * Mirrors `apps/web/src/lib/tax-year.ts` — keep the two in step.
 */
export function getCurrentTaxYear(date = new Date()): number {
  // July (month index 6) starts the next tax year.
  return date.getUTCMonth() >= 6 ? date.getUTCFullYear() + 1 : date.getUTCFullYear();
}

export interface TaxYearRange {
  taxYear: number;
  /** "2025-26" — the label used by the tax_rules table */
  label: string;
  start: Date;
  /** exclusive upper bound */
  end: Date;
}

export function parseTaxYear(input?: string | number | null): number {
  if (input === undefined || input === null || input === '') return getCurrentTaxYear();

  const raw = String(input).trim();

  // "2025-26" / "2025-2026" -> the later year is the tax year
  const hyphen = raw.match(/^(\d{4})-(\d{2,4})$/);
  if (hyphen) {
    const start = parseInt(hyphen[1], 10);
    return start + 1;
  }

  const year = parseInt(raw, 10);
  return Number.isFinite(year) && year > 1900 && year < 3000 ? year : getCurrentTaxYear();
}

export function taxYearRange(input?: string | number | null): TaxYearRange {
  const taxYear = parseTaxYear(input);
  return {
    taxYear,
    label: `${taxYear - 1}-${String(taxYear).slice(2)}`,
    start: new Date(Date.UTC(taxYear - 1, 6, 1, 0, 0, 0, 0)),
    end: new Date(Date.UTC(taxYear, 6, 1, 0, 0, 0, 0)),
  };
}

/** True when `value` falls inside the range. Tolerates Date, ISO string, or 'YYYY-MM-DD'. */
export function isWithinTaxYear(value: Date | string | null | undefined, range: TaxYearRange): boolean {
  if (!value) return false;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date >= range.start && date < range.end;
}

/** Filter helper for income rows (uses receivedAt, falling back to createdAt). */
export function incomeInTaxYear<T extends { receivedAt?: any; createdAt?: any }>(rows: T[], range: TaxYearRange): T[] {
  return rows.filter((row) => isWithinTaxYear(row.receivedAt || row.createdAt, range));
}

/** Filter helper for expense rows (uses expenseDate, falling back to createdAt). */
export function expensesInTaxYear<T extends { expenseDate?: any; createdAt?: any }>(rows: T[], range: TaxYearRange): T[] {
  return rows.filter((row) => isWithinTaxYear(row.expenseDate || row.createdAt, range));
}
