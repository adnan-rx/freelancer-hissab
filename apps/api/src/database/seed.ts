import { db } from './db';
import { users, clients, invoices, income, expenses } from './schema';

async function seed() {
  console.log('Seeding database with Pakistani context data...');

  // 1. Create User
  const [user] = await db.insert(users).values({
    email: 'ahmed.dev@example.com',
    passwordHash: '$2b$10$Ep9...', // bcrypt hash for 'password123'
    name: 'Ahmed Ali',
    businessName: 'Ahmed Web Solutions',
    phone: '+923001234567',
    defaultCurrency: 'PKR',
    timezone: 'Asia/Karachi',
  }).returning();

  // 2. Create Clients
  const [client] = await db.insert(clients).values({
    userId: user.id,
    name: 'TechFlow Inc.',
    email: 'billing@techflow.com',
    platform: 'upwork',
    currency: 'USD',
  }).returning();

  // 3. Create Invoice
  const [invoice] = await db.insert(invoices).values({
    userId: user.id,
    clientId: client.id,
    invoiceNumber: 'FH-2024-0001',
    subtotal: '1000.00',
    total: '1000.00',
    currency: 'USD',
    exchangeRate: '280.50',
    totalPKR: '280500.00',
    status: 'paid',
    dueDate: '2024-02-15',
  }).returning();

  // 4. Create Income (Bank Transfer/Payoneer/JazzCash)
  await db.insert(income).values({
    userId: user.id,
    clientId: client.id,
    invoiceId: invoice.id,
    amount: '1000.00',
    currency: 'USD',
    exchangeRate: '280.50',
    amountPKR: '280500.00',
    platform: 'upwork',
    description: 'Upwork Withdrawal to Meezan Bank',
  });

  // 5. Create Expenses (PTCL, Nayatel, Co-working space)
  await db.insert(expenses).values({
    userId: user.id,
    amount: '4500.00',
    currency: 'PKR',
    category: 'internet',
    description: 'Nayatel Monthly Bill',
    vendor: 'Nayatel',
    expenseDate: '2024-02-10',
  });

  console.log('Seed completed successfully!');
  process.exit(0);
}

seed().catch(console.error);
