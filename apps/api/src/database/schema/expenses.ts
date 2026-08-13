import { pgTable, uuid, varchar, timestamp, decimal, date, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { expenseCategoryEnum } from './enums';
import { users } from './users';

export const expenses = pgTable('expenses', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).default('PKR').notNull(),
  exchangeRate: decimal('exchange_rate', { precision: 10, scale: 4 }).default('1').notNull(),
  amountPKR: decimal('amount_pkr', { precision: 12, scale: 2 }).notNull().default('0'),
  category: expenseCategoryEnum('category').default('other').notNull(),
  paymentMethod: varchar('payment_method', { length: 50 }).default('bank_transfer').notNull(),
  description: varchar('description', { length: 500 }).notNull(),
  vendor: varchar('vendor', { length: 255 }),
  receiptUrl: varchar('receipt_url', { length: 1000 }),
  /** See `income.externalId` — same idempotency key, for imported platform fees. */
  externalId: varchar('external_id', { length: 255 }),
  expenseDate: date('expense_date').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    userIdIdx: index('expense_user_id_idx').on(table.userId),
    externalIdIdx: uniqueIndex('expense_user_external_id_idx').on(table.userId, table.externalId),
  };
});

export const expensesRelations = relations(expenses, ({ one }) => ({
  user: one(users, { fields: [expenses.userId], references: [users.id] }),
}));
