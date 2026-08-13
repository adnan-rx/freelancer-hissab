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

  /**
   * `select({ occurredAt: income.receivedAt })` renames columns, so a projected
   * result is keyed by the alias, not the table's own field. Drizzle columns carry
   * the snake_case DB name; fixtures are written in camelCase, so map between them.
   */
  const camelCase = (dbName: string): string => dbName.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

  const project = (rows: any[], projection?: Record<string, any>): any[] => {
    if (!projection || typeof projection !== 'object') return rows;

    return rows.map((row) => {
      const projected: Record<string, unknown> = {};
      for (const [alias, column] of Object.entries(projection)) {
        const field = typeof column?.name === 'string' ? camelCase(column.name) : alias;
        projected[alias] = row[field] ?? row[alias] ?? null;
      }
      return projected;
    });
  };

  const db: any = {
    select: (projection?: Record<string, any>) => ({
      from: (table: any) => {
        const chain: any = {
          where: (condition: any) => resultSet(project(applyCondition(rowsFor(table), condition), projection)),
          leftJoin: () => chain,
          orderBy: () => resultSet(project(rowsFor(table), projection)),
          limit: (n: number) => resultSet(project(rowsFor(table).slice(0, n), projection)),
        };
        return chain;
      },
    }),
    insert: (table: any) => ({
      values: (values: any) => {
        inserted.push({ table, values });
        const rows = Array.isArray(values) ? values : [values];
        // Postgres fills `defaultRandom()` ids and `defaultNow()` timestamps, so a
        // row read back after an insert always has them. Mirror that here.
        const now = new Date();
        const withIds = rows.map((row, i) => ({
          id: `mock-id-${inserted.length}-${i}`,
          createdAt: now,
          updatedAt: now,
          ...row,
        }));
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
    /**
     * Services now wrap multi-table writes in `db.transaction(async (tx) => …)`.
     * The mock has no rollback semantics — it just runs the callback against the
     * same handle, which is enough for specs that assert what was written.
     */
    transaction: async (fn: (tx: any) => Promise<any>) => fn(db),
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
