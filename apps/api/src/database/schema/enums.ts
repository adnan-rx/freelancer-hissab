import { pgEnum } from 'drizzle-orm/pg-core';

export const authProviderEnum = pgEnum('auth_provider', ['credentials', 'google']);
export const clientPlatformEnum = pgEnum('client_platform', ['upwork', 'fiverr', 'freelancer', 'direct', 'other']);
export const clientStatusEnum = pgEnum('client_status', ['active', 'archived']);
export const invoiceStatusEnum = pgEnum('invoice_status', ['draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled']);
export const categoryTypeEnum = pgEnum('category_type', ['income', 'expense']);
export const expenseCategoryEnum = pgEnum('expense_category', ['software', 'hardware', 'internet', 'office', 'travel', 'food', 'marketing', 'education', 'tax', 'other']);
