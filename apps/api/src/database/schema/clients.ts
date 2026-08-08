import { pgTable, uuid, varchar, text, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { clientPlatformEnum, clientStatusEnum } from './enums';
import { users } from './users';
import { invoices } from './invoices';
import { income } from './income';

export const clients = pgTable('clients', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  company: varchar('company', { length: 255 }),
  platform: clientPlatformEnum('platform').default('direct').notNull(),
  currency: varchar('currency', { length: 3 }).default('USD').notNull(),
  notes: text('notes'),
  status: clientStatusEnum('status').default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return {
    userIdIdx: index('client_user_id_idx').on(table.userId),
  };
});

export const clientsRelations = relations(clients, ({ one, many }) => ({
  user: one(users, {
    fields: [clients.userId],
    references: [users.id],
  }),
  invoices: many(invoices),
  income: many(income),
}));
