import { pgTable, uuid, varchar, timestamp, decimal, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { clientPlatformEnum } from './enums';
import { users } from './users';
import { clients } from './clients';
import { invoices } from './invoices';

export const income = pgTable('income', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'set null' }),
  invoiceId: uuid('invoice_id').references(() => invoices.id, { onDelete: 'set null' }),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).default('USD').notNull(),
  exchangeRate: decimal('exchange_rate', { precision: 10, scale: 4 }).default('1').notNull(),
  amountPKR: decimal('amount_pkr', { precision: 12, scale: 2 }).notNull(),
  platform: clientPlatformEnum('platform').default('direct').notNull(),
  description: varchar('description', { length: 500 }).notNull(),
  category: varchar('category', { length: 100 }),
  sbpPurposeCode: varchar('sbp_purpose_code', { length: 50 }).default('9100'),
  prcReferenceNumber: varchar('prc_reference_number', { length: 100 }),
  receivedAt: timestamp('received_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    userIdIdx: index('income_user_id_idx').on(table.userId),
    clientIdIdx: index('income_client_id_idx').on(table.clientId),
    invoiceIdIdx: index('income_invoice_id_idx').on(table.invoiceId),
  };
});

export const incomeRelations = relations(income, ({ one }) => ({
  user: one(users, { fields: [income.userId], references: [users.id] }),
  client: one(clients, { fields: [income.clientId], references: [clients.id] }),
  invoice: one(invoices, { fields: [income.invoiceId], references: [invoices.id] }),
}));
