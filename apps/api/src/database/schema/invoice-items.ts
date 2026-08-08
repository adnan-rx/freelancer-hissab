import { pgTable, uuid, varchar, decimal, integer, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { invoices } from './invoices';

export const invoiceItems = pgTable('invoice_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  invoiceId: uuid('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  description: varchar('description', { length: 500 }).notNull(),
  quantity: decimal('quantity', { precision: 10, scale: 2 }).notNull().default('1'),
  rate: decimal('rate', { precision: 12, scale: 2 }).notNull().default('0'),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull().default('0'),
  sortOrder: integer('sort_order').notNull().default(0),
}, (table) => {
  return {
    invoiceIdIdx: index('invoice_item_invoice_id_idx').on(table.invoiceId),
  };
});

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceItems.invoiceId],
    references: [invoices.id],
  }),
}));
