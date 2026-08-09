import { pgTable, uuid, varchar, numeric, date, text, timestamp } from 'drizzle-orm/pg-core';

export const taxRules = pgTable('tax_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  taxYear: varchar('tax_year', { length: 9 }).notNull(),        // e.g. "2025-26"
  incomeType: varchar('income_type', { length: 50 }).notNull(), // 'IT_EXPORT_PSEB' | 'IT_EXPORT_STANDARD'
  rate: numeric('rate', { precision: 5, scale: 4 }).notNull(),  // e.g. 0.0025
  threshold: numeric('threshold', { precision: 14, scale: 2 }), // optional income floor/ceiling
  effectiveFrom: date('effective_from').notNull(),
  effectiveTo: date('effective_to'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type TaxRule = typeof taxRules.$inferSelect;
export type NewTaxRule = typeof taxRules.$inferInsert;
