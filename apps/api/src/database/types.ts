import type { db } from './db';

/** The Drizzle client handle provided under the `DRIZZLE` token. */
export type Database = typeof db;

/** The handle passed to a `db.transaction(async (tx) => …)` callback. */
export type DbTransaction = Parameters<Parameters<Database['transaction']>[0]>[0];

/** Either handle — most repository code works against both. */
export type DbHandle = Database | DbTransaction;
