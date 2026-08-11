import { db } from './db';
import { users, clients, invoices, invoiceItems, income, expenses } from './schema';
import { eq, inArray } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';

/**
 * Demo fixtures for local development only.
 *
 * This script used to select EVERY user in the database, wipe their financial
 * records (including an unscoped `delete(invoiceItems)` that truncated the whole
 * table), and stamp demo bank/PSEB details onto real accounts. It now touches
 * exactly one account and refuses to run outside development.
 */
const DEMO_EMAIL = process.env.SEED_EMAIL || 'admin@gmail.com';
const DEMO_PASSWORD = process.env.SEED_PASSWORD || 'Admin@123456';

async function seed() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run the demo seed with NODE_ENV=production.');
  }

  console.log(`Seeding demo data for Super Admin ${DEMO_EMAIL} (development only)...`);

  const defaultPasswordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // 1. Get or create ONLY the demo user — never every user in the database.
  let [demoUser] = await db.select().from(users).where(eq(users.email, DEMO_EMAIL)).limit(1);

  if (!demoUser) {
    [demoUser] = await db.insert(users).values({
      email: DEMO_EMAIL,
      passwordHash: defaultPasswordHash,
      name: 'Super Admin',
      businessName: 'Apex Tech Solutions',
      phone: '+92 300 1234567',
      bankName: 'Meezan Bank Limited',
      accountTitle: 'Super Admin',
      iban: 'PK36MEZN0001020304050607',
      psebId: 'PSEB-2026-98765',
      isFiler: true,
      isAdmin: true,
      paymentTerms: 'Due on Receipt',
      invoiceNotes: 'Payment instructions: Wire foreign remittance directly to Meezan Bank IBAN under SBP Purpose Code 9100 for tax exemption.',
      defaultCurrency: 'PKR',
      timezone: 'Asia/Karachi',
    }).returning();
  } else {
    [demoUser] = await db.update(users).set({
      passwordHash: defaultPasswordHash,
      isAdmin: true,
      name: demoUser.name || 'Super Admin',
      accountTitle: demoUser.accountTitle || 'Super Admin',
    }).where(eq(users.id, demoUser.id)).returning();
  }

  const targetUsers = [demoUser];

  for (const user of targetUsers) {
    console.log(`Seeding data for user: ${user.email} (${user.id})`);

    // Clean this user's records only. Invoice items are scoped through the
    // user's own invoices rather than truncated table-wide.
    const ownInvoices = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(eq(invoices.userId, user.id));

    await db.delete(income).where(eq(income.userId, user.id));
    if (ownInvoices.length > 0) {
      await db.delete(invoiceItems).where(
        inArray(invoiceItems.invoiceId, ownInvoices.map((inv) => inv.id)),
      );
    }
    await db.delete(invoices).where(eq(invoices.userId, user.id));
    await db.delete(expenses).where(eq(expenses.userId, user.id));
    await db.delete(clients).where(eq(clients.userId, user.id));

    // Fill in demo bank details only where the account has none, and ensure super admin flag is set.
    await db.update(users).set({
      bankName: user.bankName || 'Meezan Bank Limited',
      accountTitle: user.accountTitle || user.name || 'Super Admin',
      iban: user.iban || 'PK36MEZN0001020304050607',
      psebId: user.psebId || 'PSEB-2026-98765',
      isAdmin: true,
    }).where(eq(users.id, user.id));

    // 2. Create Clients
    const [c1] = await db.insert(clients).values({
      userId: user.id,
      name: 'TechFlow Inc.',
      company: 'TechFlow Labs LLC',
      email: 'billing@techflow.com',
      phone: '+1 415 555 0199',
      platform: 'upwork',
      currency: 'USD',
      notes: 'Upwork hourly contract client. Pays via automatic weekly escrow release.',
    }).returning();

    const [c2] = await db.insert(clients).values({
      userId: user.id,
      name: 'Jane Smith',
      company: 'Smith Studio Design',
      email: 'jane@smithstudio.io',
      phone: '+44 20 7946 0912',
      platform: 'fiverr',
      currency: 'USD',
      notes: 'Fiverr Pro order client for Next.js full-stack applications.',
    }).returning();

    const [c3] = await db.insert(clients).values({
      userId: user.id,
      name: 'Global Soft LLC',
      company: 'Global Soft Enterprise',
      email: 'accounts@globalsoft.com',
      phone: '+971 4 321 4567',
      platform: 'direct',
      currency: 'USD',
      notes: 'Direct client paying foreign remittance via Wise to Meezan Bank.',
    }).returning();

    const [c4] = await db.insert(clients).values({
      userId: user.id,
      name: 'Khadim & Sons Pvt Ltd',
      company: 'Khadim Logistics',
      email: 'finance@khadim.pk',
      phone: '+92 42 35781234',
      platform: 'other',
      currency: 'PKR',
      notes: 'Local corporate software development contract.',
    }).returning();

    // 3. Create Invoices
    const [inv1] = await db.insert(invoices).values({
      userId: user.id,
      clientId: c1.id,
      invoiceNumber: 'FH-2026-0001',
      dueDate: '2026-08-15',
      currency: 'USD',
      exchangeRate: '280.50',
      subtotal: '1200.00',
      taxRate: '0.00',
      taxAmount: '0.00',
      discountAmount: '0.00',
      total: '1200.00',
      totalPKR: '336600.00',
      status: 'paid',
      notes: 'SBP Purpose Code 9100. Wire to Meezan Bank IBAN: PK36MEZN0001020304050607.',
    }).returning();

    await db.insert(invoiceItems).values([
      { invoiceId: inv1.id, description: 'Full Stack Web Development - Sprint 1 & 2', quantity: '1', rate: '800.00', amount: '800.00' },
      { invoiceId: inv1.id, description: 'NestJS API & PostgreSQL Database Setup', quantity: '1', rate: '400.00', amount: '400.00' },
    ]);

    const [inv2] = await db.insert(invoices).values({
      userId: user.id,
      clientId: c2.id,
      invoiceNumber: 'FH-2026-0002',
      dueDate: '2026-08-25',
      currency: 'USD',
      exchangeRate: '280.00',
      subtotal: '650.00',
      taxRate: '0.00',
      taxAmount: '0.00',
      discountAmount: '0.00',
      total: '650.00',
      totalPKR: '182000.00',
      status: 'sent',
      notes: 'Fiverr Pro order clearing to Meezan Bank.',
    }).returning();

    await db.insert(invoiceItems).values([
      { invoiceId: inv2.id, description: 'UI/UX Redesign & Tailwind CSS Optimization', quantity: '1', rate: '650.00', amount: '650.00' },
    ]);

    const [inv3] = await db.insert(invoices).values({
      userId: user.id,
      clientId: c3.id,
      invoiceNumber: 'FH-2026-0003',
      dueDate: '2026-08-01',
      currency: 'USD',
      exchangeRate: '279.50',
      subtotal: '2500.00',
      taxRate: '0.00',
      taxAmount: '0.00',
      discountAmount: '0.00',
      total: '2500.00',
      totalPKR: '698750.00',
      status: 'paid',
      notes: 'Direct Wise transfer under SBP Code 9100 for 0.25% export tax exemption.',
    }).returning();

    await db.insert(invoiceItems).values([
      { invoiceId: inv3.id, description: 'Enterprise SaaS Microservices Architecture', quantity: '1', rate: '2500.00', amount: '2500.00' },
    ]);

    // 4. Create Income Records
    await db.insert(income).values([
      {
        userId: user.id,
        clientId: c1.id,
        invoiceId: inv1.id,
        amount: '1200.00',
        currency: 'USD',
        exchangeRate: '280.50',
        amountPKR: '336600.00',
        platform: 'upwork',
        description: 'Upwork Remittance Withdrawal to Meezan Bank',
        sbpPurposeCode: '9100',
        prcReferenceNumber: 'PRC-2026-MZ01',
        receivedAt: new Date('2026-08-02'),
      },
      {
        userId: user.id,
        clientId: c2.id,
        invoiceId: inv2.id,
        amount: '650.00',
        currency: 'USD',
        exchangeRate: '280.00',
        amountPKR: '182000.00',
        platform: 'fiverr',
        description: 'Fiverr Direct Remittance Clearing',
        sbpPurposeCode: '9100',
        prcReferenceNumber: 'PRC-2026-MZ02',
        receivedAt: new Date('2026-08-05'),
      },
      {
        userId: user.id,
        clientId: c3.id,
        invoiceId: inv3.id,
        amount: '2500.00',
        currency: 'USD',
        exchangeRate: '279.50',
        amountPKR: '698750.00',
        platform: 'direct',
        description: 'Wise Inward Wire Remittance from Global Soft LLC',
        sbpPurposeCode: '9100',
        prcReferenceNumber: 'PRC-2026-MZ03',
        receivedAt: new Date('2026-08-07'),
      },
    ]);

    // 5. Create Expenses
    await db.insert(expenses).values([
      {
        userId: user.id,
        amount: '5500.00',
        currency: 'PKR',
        exchangeRate: '1.00',
        amountPKR: '5500.00',
        category: 'internet',
        description: 'Nayatel Fiber Broadband Monthly Bill',
        vendor: 'Nayatel',
        expenseDate: '2026-08-01',
      },
      {
        userId: user.id,
        amount: '18500.00',
        currency: 'PKR',
        exchangeRate: '1.00',
        amountPKR: '18500.00',
        category: 'software',
        description: 'Adobe Creative Cloud All Apps Subscription',
        vendor: 'Adobe Systems',
        expenseDate: '2026-08-03',
      },
      {
        userId: user.id,
        amount: '8200.00',
        currency: 'PKR',
        exchangeRate: '1.00',
        amountPKR: '8200.00',
        category: 'software',
        description: 'GitHub Copilot & Vercel Pro Workspace Plan',
        vendor: 'GitHub Inc.',
        expenseDate: '2026-08-04',
      },
      {
        userId: user.id,
        amount: '25000.00',
        currency: 'PKR',
        exchangeRate: '1.00',
        amountPKR: '25000.00',
        category: 'office',
        description: 'Kickstart Co-Working Dedicated Desk Monthly Rent',
        vendor: 'Kickstart Co-working',
        expenseDate: '2026-08-05',
      },
    ]);
  }

  console.log('Seeding completed successfully!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
