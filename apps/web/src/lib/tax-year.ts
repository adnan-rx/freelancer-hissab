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
