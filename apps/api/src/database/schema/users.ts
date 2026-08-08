import { pgTable, uuid, varchar, timestamp, uniqueIndex, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { authProviderEnum } from './enums';
import { clients } from './clients';
import { invoices } from './invoices';
import { income } from './income';
import { expenses } from './expenses';
import { categories } from './categories';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }),
  name: varchar('name', { length: 255 }).notNull(),
  businessName: varchar('business_name', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  bankName: varchar('bank_name', { length: 255 }),
  accountTitle: varchar('account_title', { length: 255 }),
  iban: varchar('iban', { length: 100 }),
  psebId: varchar('pseb_id', { length: 100 }),
  isFiler: boolean('is_filer').default(true),
  invoicePrefix: varchar('invoice_prefix', { length: 50 }).default('FH-2026-'),
  paymentTerms: varchar('payment_terms', { length: 100 }).default('Due on Receipt'),
  invoiceNotes: varchar('invoice_notes', { length: 1000 }),
  defaultCurrency: varchar('default_currency', { length: 3 }).default('PKR').notNull(),
  timezone: varchar('timezone', { length: 100 }).default('Asia/Karachi').notNull(),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  authProvider: authProviderEnum('auth_provider').default('credentials').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return {
    emailIdx: uniqueIndex('user_email_idx').on(table.email),
  };
});

export const usersRelations = relations(users, ({ many }) => ({
  clients: many(clients),
  invoices: many(invoices),
  income: many(income),
  expenses: many(expenses),
  categories: many(categories),
}));
