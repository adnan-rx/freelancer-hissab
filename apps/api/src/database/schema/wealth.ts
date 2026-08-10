import { pgTable, uuid, varchar, numeric, text, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';

export const wealthStatements = pgTable('wealth_statements', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  taxYear: varchar('tax_year', { length: 9 }).notNull(), // e.g. "2026"
  openingWealthPKR: numeric('opening_wealth_pkr', { precision: 14, scale: 2 }).notNull().default('0'),
  otherAdjustmentsPKR: numeric('other_adjustments_pkr', { precision: 14, scale: 2 }).default('0'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const assets = pgTable('assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  taxYear: varchar('tax_year', { length: 9 }).notNull(),
  name: varchar('name', { length: 255 }).default('Unnamed Asset').notNull(),
  type: varchar('type', { length: 50 }).notNull(), // 'CASH' | 'PROPERTY' | 'VEHICLE' | 'INVESTMENT' | 'OTHER'
  description: text('description').notNull(),
  currency: varchar('currency', { length: 10 }).default('PKR').notNull(),
  balance: numeric('balance', { precision: 14, scale: 2 }).default('0').notNull(),
  valuePKR: numeric('value_pkr', { precision: 14, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const liabilities = pgTable('liabilities', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  taxYear: varchar('tax_year', { length: 9 }).notNull(),
  description: text('description').notNull(),
  amountPKR: numeric('amount_pkr', { precision: 14, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const wealthStatementsRelations = relations(wealthStatements, ({ one }) => ({
  user: one(users, { fields: [wealthStatements.userId], references: [users.id] }),
}));

export const assetsRelations = relations(assets, ({ one }) => ({
  user: one(users, { fields: [assets.userId], references: [users.id] }),
}));

export const liabilitiesRelations = relations(liabilities, ({ one }) => ({
  user: one(users, { fields: [liabilities.userId], references: [users.id] }),
}));
