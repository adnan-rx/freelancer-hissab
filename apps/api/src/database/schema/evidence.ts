import { pgTable, uuid, varchar, text, timestamp, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { income } from './income';
import { expenses } from './expenses';

export const evidenceDocuments = pgTable('evidence_documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  incomeId: uuid('income_id').references(() => income.id, { onDelete: 'set null' }),
  expenseId: uuid('expense_id').references(() => expenses.id, { onDelete: 'set null' }),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  fileType: varchar('file_type', { length: 100 }).notNull(), // e.g., 'application/pdf', 'image/jpeg'
  fileSize: integer('file_size').notNull(),
  blobUrl: varchar('blob_url', { length: 1000 }).notNull(), // Vercel Blob URL
  documentType: varchar('document_type', { length: 100 }).notNull(), // 'PRC', 'INVOICE', 'RECEIPT', 'OTHER'
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const evidenceDocumentsRelations = relations(evidenceDocuments, ({ one }) => ({
  user: one(users, { fields: [evidenceDocuments.userId], references: [users.id] }),
  income: one(income, { fields: [evidenceDocuments.incomeId], references: [income.id] }),
  expense: one(expenses, { fields: [evidenceDocuments.expenseId], references: [expenses.id] }),
}));

export type EvidenceDocument = typeof evidenceDocuments.$inferSelect;
export type NewEvidenceDocument = typeof evidenceDocuments.$inferInsert;
