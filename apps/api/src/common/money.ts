/**
 * Money helpers.
 *
 * Every monetary column is `decimal(_, 2)`, so a value must be rounded to 2dp
 * *before* it is used to derive another value. Deriving `totalPKR` from an
 * unrounded `total` used to leave `total * rate !== totalPKR` in the database.
 */

/** Round to 2 decimal places (currency amounts). */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Round to 4 decimal places (exchange rates — `decimal(10, 4)`). */
export function round4(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}
