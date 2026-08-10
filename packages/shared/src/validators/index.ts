import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  name: z.string().min(2, 'Name must be at least 2 characters long'),
  businessName: z.string().optional(),
});

export const createClientSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters long'),
  email: z.string().email('Invalid email address').optional().nullable(),
  phone: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  platform: z.enum(['upwork', 'fiverr', 'freelancer', 'direct', 'other']),
  currency: z.enum(['PKR', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'CAD', 'AUD']),
  notes: z.string().optional().nullable(),
  status: z.enum(['active', 'archived']).default('active'),
});

export const invoiceItemSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().min(0.01, 'Quantity must be greater than 0'),
  rate: z.number().min(0, 'Rate cannot be negative'),
  sortOrder: z.number().int().default(0),
});

export const createInvoiceSchema = z.object({
  clientId: z.string().min(1, 'Client ID is required'),
  invoiceNumber: z.string().min(1, 'Invoice number is required'),
  dueDate: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date format'),
  currency: z.enum(['PKR', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'CAD', 'AUD']),
  taxRate: z.number().min(0).default(0),
  discountAmount: z.number().min(0).default(0),
  notes: z.string().optional().nullable(),
  items: z.array(invoiceItemSchema).min(1, 'At least one item is required'),
});

export const updateInvoiceSchema = z.object({
  clientId: z.string().optional(),
  clientName: z.string().optional(),
  clientEmail: z.string().email().optional().nullable(),
  invoiceNumber: z.string().optional(),
  dueDate: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date format').optional().nullable(),
  currency: z.enum(['PKR', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'CAD', 'AUD']).optional(),
  exchangeRate: z.number().min(0).optional(),
  taxRate: z.number().min(0).optional(),
  discountAmount: z.number().min(0).optional(),
  status: z.enum(['draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled']).optional(),
  notes: z.string().optional().nullable(),
  items: z.array(invoiceItemSchema).min(1, 'At least one item is required').optional(),
});

export const createIncomeSchema = z.object({
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  currency: z.enum(['PKR', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'CAD', 'AUD']),
  platform: z.enum(['upwork', 'fiverr', 'freelancer', 'direct', 'other']),
  receivedAt: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date format'),
  clientId: z.string().optional().nullable(),
  invoiceId: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
});

export const createExpenseSchema = z.object({
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  currency: z.enum(['PKR', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'CAD', 'AUD']),
  category: z.enum(['software', 'hardware', 'internet', 'office', 'travel', 'food', 'marketing', 'education', 'tax', 'other']),
  expenseDate: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date format'),
  description: z.string().optional().nullable(),
  vendor: z.string().optional().nullable(),
  receiptUrl: z.string().url('Invalid receipt URL').optional().nullable(),
});
