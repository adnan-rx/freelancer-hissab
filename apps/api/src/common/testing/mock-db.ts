/**
 * Minimal stand-in for the Drizzle client used by the service specs.
 *
 * Services call `db.select().from(table).where(cond)` and sometimes `.limit(n)`,
 * plus `db.insert(table).values(v).returning()` and the update/delete equivalents.
 * Rows are keyed by the schema table object, so a spec just declares the data it wants.
 */
export function createMockDb(rowsByTable: Map<any, any[]> = new Map()) {
  const inserted: Array<{ table: any; values: any }> = [];
  const updated: Array<{ table: any; values: any }> = [];
  const deleted: Array<{ table: any }> = [];

  const rowsFor = (table: any): any[] => rowsByTable.get(table) ?? [];

  /**
   * Drizzle conditions are opaque SQL objects, but the values bound into them
   * (`eq(col, 'IT_EXPORT_PSEB')`) show up as `Param.value`. Collecting those lets the
   * mock filter rows well enough for specs that rely on a specific row being matched.
   */
  const boundValues = (condition: any, seen = new Set<any>()): any[] => {
    if (condition === null || typeof condition !== 'object' || seen.has(condition)) return [];
    seen.add(condition);

    const values: any[] = [];
    for (const [key, child] of Object.entries(condition)) {
      if (key === 'value' && (typeof child === 'string' || typeof child === 'number' || typeof child === 'boolean')) {
        values.push(child);
      } else if (child && typeof child === 'object') {
        values.push(...boundValues(child, seen));
      }
    }
    return values;
  };

  /**
   * Keeps rows whose own values contain every string bound into the condition.
   * Matching is strict so specs genuinely verify per-user scoping — a fixture that
   * omits `userId` will come back empty rather than silently passing.
   */
  const applyCondition = (rows: any[], condition: any): any[] => {
    const wanted = boundValues(condition).filter((v) => typeof v === 'string' && v.length > 0);
    if (wanted.length === 0) return rows;

    return rows.filter((row) => {
      const rowValues = Object.values(row).map((v) => (v instanceof Date ? v.toISOString() : String(v)));
      return wanted.every((want) => rowValues.includes(want));
    });
  };

  /** Array of results that also answers `.limit()` and `.orderBy()` like a query builder. */
  const resultSet = (rows: any[]): any => {
    const result: any = [...rows];
    result.limit = (n: number) => resultSet(rows.slice(0, n));
    result.orderBy = () => resultSet(rows);
    result.leftJoin = () => result;
    return result;
  };

  const db: any = {
    select: () => ({
      from: (table: any) => {
        const chain: any = {
          where: (condition: any) => resultSet(applyCondition(rowsFor(table), condition)),
          leftJoin: () => chain,
          orderBy: () => resultSet(rowsFor(table)),
          limit: (n: number) => resultSet(rowsFor(table).slice(0, n)),
        };
        return chain;
      },
    }),
    insert: (table: any) => ({
      values: (values: any) => {
        inserted.push({ table, values });
        const rows = Array.isArray(values) ? values : [values];
        const withIds = rows.map((row, i) => ({ id: `mock-id-${inserted.length}-${i}`, ...row }));
        rowsByTable.set(table, [...rowsFor(table), ...withIds]);
        return { returning: async () => withIds };
      },
    }),
    update: (table: any) => ({
      set: (values: any) => {
        updated.push({ table, values });
        return { where: () => ({ returning: async () => [{ id: 'mock-id', ...values }] }) };
      },
    }),
    delete: (table: any) => {
      deleted.push({ table });
      return { where: () => ({ returning: async () => rowsFor(table).slice(0, 1) }) };
    },
    _inserted: inserted,
    _updated: updated,
    _deleted: deleted,
  };

  return db;
}

/** Exchange-rate stub with fixed, assertion-friendly rates. */
const FIXED_RATES: Record<string, number> = { USD: 280, EUR: 300, GBP: 350, PKR: 1 };

export const mockExchangeRateService = {
  async getRate(from: string) {
    return FIXED_RATES[(from || 'USD').toUpperCase()] ?? 280;
  },
  async convertToPKR(amount: number, from: string) {
    const rate = FIXED_RATES[(from || 'USD').toUpperCase()] ?? 280;
    return { amountPKR: amount * rate, exchangeRate: rate };
  },
};
