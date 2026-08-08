import { AuthProvider, ClientPlatform, ClientStatus, InvoiceStatus, ExpenseCategory, CategoryType, Currency } from '../enums';

export interface User {
  id: string;
  email: string;
  name: string;
  businessName?: string | null;
  phone?: string | null;
  defaultCurrency: Currency;
  timezone?: string | null;
  avatarUrl?: string | null;
  authProvider: AuthProvider;
  createdAt: string;
  updatedAt: string;
}

export interface Client {
  id: string;
  userId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  platform: ClientPlatform;
  currency: Currency;
  notes?: string | null;
  status: ClientStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  userId: string;
  clientId: string;
  invoiceNumber: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  currency: Currency;
  exchangeRate: number;
  totalPKR: number;
  status: InvoiceStatus;
  dueDate: string;
  paidAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  sortOrder: number;
}

export interface InvoiceWithItems extends Invoice {
  items: InvoiceItem[];
  client?: Client;
}

export interface Income {
  id: string;
  userId: string;
  clientId?: string | null;
  invoiceId?: string | null;
  amount: number;
  currency: Currency;
  exchangeRate: number;
  amountPKR: number;
  platform: ClientPlatform;
  description?: string | null;
  category?: string | null;
  receivedAt: string;
  createdAt: string;
}

export interface Expense {
  id: string;
  userId: string;
  amount: number;
  currency: Currency;
  category: ExpenseCategory;
  description?: string | null;
  vendor?: string | null;
  receiptUrl?: string | null;
  expenseDate: string;
  createdAt: string;
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  type: CategoryType;
  color?: string | null;
  icon?: string | null;
  isDefault: boolean;
}
