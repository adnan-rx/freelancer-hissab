import { pgTable, uuid, varchar, text, timestamp, decimal, date, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { invoiceStatusEnum } from './enums';
import { users } from './users';
import { clients } from './clients';
import { invoiceItems } from './invoice-items';
import { income } from './income';

export const invoices = pgTable('invoices', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  invoiceNumber: varchar('invoice_number', { length: 50 }).notNull(),
  subtotal: decimal('subtotal', { precision: 12, scale: 2 }).notNull().default('0'),
  taxRate: decimal('tax_rate', { precision: 5, scale: 2 }).notNull().default('0'),
  taxAmount: decimal('tax_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  discountAmount: decimal('discount_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  total: decimal('total', { precision: 12, scale: 2 }).notNull().default('0'),
  currency: varchar('currency', { length: 3 }).default('USD').notNull(),
  exchangeRate: decimal('exchange_rate', { precision: 10, scale: 4 }).default('1').notNull(),
  totalPKR: decimal('total_pkr', { precision: 12, scale: 2 }).notNull().default('0'),
  status: invoiceStatusEnum('status').default('draft').notNull(),
  dueDate: date('due_date'),
  paidAt: timestamp('paid_at'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return {
    userIdIdx: index('invoice_user_id_idx').on(table.userId),
    clientIdIdx: index('invoice_client_id_idx').on(table.clientId),
    invoiceNumberUserIdIdx: uniqueIndex('invoice_num_user_idx').on(table.invoiceNumber, table.userId),
  };
});

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  user: one(users, { fields: [invoices.userId], references: [users.id] }),
  client: one(clients, { fields: [invoices.clientId], references: [clients.id] }),
  items: many(invoiceItems),
  income: many(income),
}));
