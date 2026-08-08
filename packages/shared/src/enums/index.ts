export const AuthProvider = {
  CREDENTIALS: 'credentials',
  GOOGLE: 'google',
} as const;
export type AuthProvider = typeof AuthProvider[keyof typeof AuthProvider];

export const ClientPlatform = {
  UPWORK: 'upwork',
  FIVERR: 'fiverr',
  FREELANCER: 'freelancer',
  DIRECT: 'direct',
  OTHER: 'other',
} as const;
export type ClientPlatform = typeof ClientPlatform[keyof typeof ClientPlatform];

export const ClientStatus = {
  ACTIVE: 'active',
  ARCHIVED: 'archived',
} as const;
export type ClientStatus = typeof ClientStatus[keyof typeof ClientStatus];

export const InvoiceStatus = {
  DRAFT: 'draft',
  SENT: 'sent',
  VIEWED: 'viewed',
  PAID: 'paid',
  OVERDUE: 'overdue',
  CANCELLED: 'cancelled',
} as const;
export type InvoiceStatus = typeof InvoiceStatus[keyof typeof InvoiceStatus];

export const ExpenseCategory = {
  SOFTWARE: 'software',
  HARDWARE: 'hardware',
  INTERNET: 'internet',
  OFFICE: 'office',
  TRAVEL: 'travel',
  FOOD: 'food',
  MARKETING: 'marketing',
  EDUCATION: 'education',
  TAX: 'tax',
  OTHER: 'other',
} as const;
export type ExpenseCategory = typeof ExpenseCategory[keyof typeof ExpenseCategory];

export const CategoryType = {
  INCOME: 'income',
  EXPENSE: 'expense',
} as const;
export type CategoryType = typeof CategoryType[keyof typeof CategoryType];

export const Currency = {
  PKR: 'PKR',
  USD: 'USD',
  EUR: 'EUR',
  GBP: 'GBP',
  AED: 'AED',
  SAR: 'SAR',
  CAD: 'CAD',
  AUD: 'AUD',
} as const;
export type Currency = typeof Currency[keyof typeof Currency];
