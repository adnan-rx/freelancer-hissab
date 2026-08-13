import { pgTable, uuid, varchar, text, timestamp, integer, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';

export const platformConnections = pgTable(
  'platform_connections',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    platform: varchar('platform', { length: 50 }).notNull(),
    accountIdentifier: varchar('account_identifier', { length: 255 }).notNull(),
    accountName: varchar('account_name', { length: 255 }).notNull(),
    encryptedAccessToken: text('encrypted_access_token'),
    encryptedRefreshToken: text('encrypted_refresh_token'),
    tokenExpiresAt: timestamp('token_expires_at'),
    status: varchar('status', { length: 50 }).default('connected').notNull(),
    lastSyncAt: timestamp('last_sync_at'),
    lastSuccessfulSyncAt: timestamp('last_successful_sync_at'),
    syncStatus: varchar('sync_status', { length: 50 }).default('idle').notNull(),
    lastSyncError: text('last_sync_error'),
    syncedTransactionsCount: integer('synced_transactions_count').default(0).notNull(),
    failedTransactionsCount: integer('failed_transactions_count').default(0).notNull(),
    metadata: text('metadata'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('platform_conn_user_id_idx').on(table.userId),
    platformUserIdx: index('platform_conn_platform_user_idx').on(table.platform, table.userId),
  }),
);

export const platformSyncLogs = pgTable(
  'platform_sync_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    connectionId: uuid('connection_id')
      .notNull()
      .references(() => platformConnections.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    platform: varchar('platform', { length: 50 }).notNull(),
    syncType: varchar('sync_type', { length: 50 }).default('manual').notNull(),
    status: varchar('status', { length: 50 }).notNull(),
    sinceTimestamp: timestamp('since_timestamp'),
    fetchedCount: integer('fetched_count').default(0).notNull(),
    incomeCreatedCount: integer('income_created_count').default(0).notNull(),
    expensesCreatedCount: integer('expenses_created_count').default(0).notNull(),
    clientsCreatedCount: integer('clients_created_count').default(0).notNull(),
    invoicesCreatedCount: integer('invoices_created_count').default(0).notNull(),
    duplicatesSkippedCount: integer('duplicates_skipped_count').default(0).notNull(),
    failedCount: integer('failed_count').default(0).notNull(),
    errorMessage: text('error_message'),
    startedAt: timestamp('started_at').defaultNow().notNull(),
    completedAt: timestamp('completed_at'),
  },
  (table) => ({
    connIdIdx: index('platform_sync_log_conn_id_idx').on(table.connectionId),
    userIdIdx: index('platform_sync_log_user_id_idx').on(table.userId),
  }),
);

export const platformConnectionsRelations = relations(platformConnections, ({ one, many }) => ({
  user: one(users, {
    fields: [platformConnections.userId],
    references: [users.id],
  }),
  syncLogs: many(platformSyncLogs),
}));

export const platformSyncLogsRelations = relations(platformSyncLogs, ({ one }) => ({
  connection: one(platformConnections, {
    fields: [platformSyncLogs.connectionId],
    references: [platformConnections.id],
  }),
  user: one(users, {
    fields: [platformSyncLogs.userId],
    references: [users.id],
  }),
}));
