/**
 * Frontend mirror of the backend's Pakistani tax-year convention
 * (apps/api/src/common/tax-year.ts): tax year N runs 1 July (N-1) -> 30 June N.
 */
export function getCurrentTaxYear(date = new Date()): number {
  const isSecondHalf = date.getMonth() >= 6; // July (index 6) onward rolls into the next tax year
  return isSecondHalf ? date.getFullYear() + 1 : date.getFullYear();
}

export function taxYearOptions(around: number = getCurrentTaxYear()): { value: string; label: string }[] {
  return [around - 2, around - 1, around, around + 1].map((y) => ({
    value: String(y),
    label: `Tax Year ${y}`,
  }));
}

/** 'YYYY-MM-DD' bounds of a tax year, for client-side date-string comparisons. */
export function taxYearBounds(year: number = getCurrentTaxYear()): { start: string; end: string } {
  return { start: `${year - 1}-07-01`, end: `${year}-06-30` };
}

/** "2026-27" style label — matches the format stored in the tax_rules table. */
export function taxYearLabel(year: number = getCurrentTaxYear()): string {
  return `${year - 1}-${String(year).slice(2)}`;
}
