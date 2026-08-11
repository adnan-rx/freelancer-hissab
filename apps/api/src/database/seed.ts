import { db } from './db';
import {
  users, clients, invoices, invoiceItems, income, expenses,
  assets, liabilities, wealthStatements, evidenceDocuments, taxRules,
} from './schema';
import { eq, inArray } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { getCurrentTaxYear, taxYearRange, incomeInTaxYear, expensesInTaxYear } from '../common/tax-year';

/**
 * Demo fixtures for local development only.
 *
 * Touches exactly one account (SEED_EMAIL) and refuses to run in production.
 * Dates are derived from the clock, not hardcoded, so the data always lands in
 * the tax year the app defaults to.
 */
const DEMO_EMAIL = process.env.SEED_EMAIL || 'admin@gmail.com';
const DEMO_PASSWORD = process.env.SEED_PASSWORD || 'Admin@123456';

const today = new Date();
const TAX_YEAR = getCurrentTaxYear(today);
const RANGE = taxYearRange(TAX_YEAR);
const PREV_YEAR = String(TAX_YEAR - 1);

/** Start of the month `n` months back from today, on `day`. */
const monthsAgo = (n: number, day = 5) =>
  new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - n, day));
const iso = (d: Date) => d.toISOString().split('T')[0];

/** Months we spread transactions over: this month back through 13 months ago. */
const MONTHS = Array.from({ length: 14 }, (_, i) => i);

async function seed() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run the demo seed with NODE_ENV=production.');
  }

  console.log(`Seeding demo data for ${DEMO_EMAIL} (tax year ${RANGE.label}, development only)...`);

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // 1. Get or create ONLY the demo user — never every user in the database.
  let [user] = await db.select().from(users).where(eq(users.email, DEMO_EMAIL)).limit(1);

  if (!user) {
    [user] = await db.insert(users).values({
      email: DEMO_EMAIL,
      passwordHash,
      name: 'Super Admin',
      businessName: 'Apex Tech Solutions',
      phone: '+92 300 1234567',
      bankName: 'Meezan Bank Limited',
      accountTitle: 'Super Admin',
      iban: 'PK36MEZN0001020304050607',
      psebId: 'PSEB-2026-98765',
      isFiler: true,
      isAdmin: true,
      invoicePrefix: `FH-${TAX_YEAR}-`,
      paymentTerms: 'Due on Receipt',
      invoiceNotes: 'Payment instructions: Wire foreign remittance directly to Meezan Bank IBAN under SBP Purpose Code 9100 for tax exemption.',
      defaultCurrency: 'PKR',
      timezone: 'Asia/Karachi',
    }).returning();
    console.log(`Created user ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  } else {
    [user] = await db.update(users).set({
      passwordHash,
      isAdmin: true,
      isFiler: true,
      name: user.name || 'Super Admin',
      businessName: user.businessName || 'Apex Tech Solutions',
      phone: user.phone || '+92 300 1234567',
      bankName: user.bankName || 'Meezan Bank Limited',
      accountTitle: user.accountTitle || user.name || 'Super Admin',
      iban: user.iban || 'PK36MEZN0001020304050607',
      psebId: user.psebId || 'PSEB-2026-98765',
    }).where(eq(users.id, user.id)).returning();
    console.log(`Reset password for existing user ${DEMO_EMAIL} to ${DEMO_PASSWORD}`);
  }

  // 2. Clean this user's records only. Invoice items are scoped through the
  // user's own invoices rather than truncated table-wide.
  const ownInvoices = await db.select({ id: invoices.id }).from(invoices).where(eq(invoices.userId, user.id));

  await db.delete(evidenceDocuments).where(eq(evidenceDocuments.userId, user.id));
  await db.delete(income).where(eq(income.userId, user.id));
  if (ownInvoices.length > 0) {
    await db.delete(invoiceItems).where(inArray(invoiceItems.invoiceId, ownInvoices.map((i) => i.id)));
  }
  await db.delete(invoices).where(eq(invoices.userId, user.id));
  await db.delete(expenses).where(eq(expenses.userId, user.id));
  await db.delete(clients).where(eq(clients.userId, user.id));
  await db.delete(assets).where(eq(assets.userId, user.id));
  await db.delete(liabilities).where(eq(liabilities.userId, user.id));
  await db.delete(wealthStatements).where(eq(wealthStatements.userId, user.id));

  // 3. Clients
  const clientRows = await db.insert(clients).values([
    { userId: user.id, name: 'TechFlow Inc.', company: 'TechFlow Labs LLC', email: 'billing@techflow.com', phone: '+1 415 555 0199', platform: 'upwork' as const, currency: 'USD', notes: 'Upwork hourly contract. Weekly escrow release.' },
    { userId: user.id, name: 'Jane Smith', company: 'Smith Studio Design', email: 'jane@smithstudio.io', phone: '+44 20 7946 0912', platform: 'fiverr' as const, currency: 'USD', notes: 'Fiverr Pro orders for Next.js work.' },
    { userId: user.id, name: 'Global Soft LLC', company: 'Global Soft Enterprise', email: 'accounts@globalsoft.com', phone: '+971 4 321 4567', platform: 'direct' as const, currency: 'USD', notes: 'Direct client, Wise remittance to Meezan Bank.' },
    { userId: user.id, name: 'Khadim & Sons Pvt Ltd', company: 'Khadim Logistics', email: 'finance@khadim.pk', phone: '+92 42 35781234', platform: 'other' as const, currency: 'PKR', notes: 'Local corporate contract (taxed under local slabs).' },
    { userId: user.id, name: 'Nordic Apps AS', company: 'Nordic Apps', email: 'pay@nordicapps.no', phone: '+47 21 08 99 12', platform: 'freelancer' as const, currency: 'USD', notes: 'Retainer via Freelancer.com milestones.' },
    { userId: user.id, name: 'Bright Retail (archived)', company: 'Bright Retail Pvt Ltd', email: 'ap@brightretail.pk', phone: '+92 21 34567890', platform: 'other' as const, currency: 'PKR', status: 'archived' as const, notes: 'Contract ended; kept for history.' },
  ]).returning();

  const [techflow, smith, globalsoft, khadim, nordic] = clientRows;

  // 4. Invoices (+ items). One per recent month, mixed statuses.
  const invoiceSpecs = [
    { client: techflow, n: 5, status: 'paid' as const, currency: 'USD', rate: 281.5, items: [['Full Stack Web Development — Sprint 1 & 2', 1, 800], ['NestJS API & PostgreSQL setup', 1, 400]] },
    { client: globalsoft, n: 4, status: 'paid' as const, currency: 'USD', rate: 279.5, items: [['Enterprise SaaS microservices architecture', 1, 2500]] },
    { client: smith, n: 3, status: 'paid' as const, currency: 'USD', rate: 280.0, items: [['UI/UX redesign & Tailwind optimisation', 1, 650]] },
    { client: nordic, n: 2, status: 'overdue' as const, currency: 'USD', rate: 282.25, items: [['Monthly retainer — React Native app', 1, 1500]] },
    { client: khadim, n: 1, status: 'sent' as const, currency: 'PKR', rate: 1, items: [['Inventory portal development', 1, 250000], ['On-site training (2 days)', 2, 25000]] },
    { client: techflow, n: 0, status: 'draft' as const, currency: 'USD', rate: 283.0, items: [['Q3 platform maintenance retainer', 1, 950]] },
  ];

  const invoiceRows: any[] = [];
  for (const [idx, spec] of invoiceSpecs.entries()) {
    const issued = monthsAgo(spec.n, 3);
    const subtotal = spec.items.reduce((sum, [, qty, rate]) => sum + Number(qty) * Number(rate), 0);
    const [inv] = await db.insert(invoices).values({
      userId: user.id,
      clientId: spec.client.id,
      invoiceNumber: `FH-${TAX_YEAR}-${String(idx + 1).padStart(4, '0')}`,
      currency: spec.currency,
      exchangeRate: String(spec.rate),
      subtotal: subtotal.toFixed(2),
      taxRate: '0.00',
      taxAmount: '0.00',
      discountAmount: '0.00',
      total: subtotal.toFixed(2),
      totalPKR: (subtotal * spec.rate).toFixed(2),
      status: spec.status,
      dueDate: iso(new Date(issued.getTime() + 14 * 86400000)),
      paidAt: spec.status === 'paid' ? new Date(issued.getTime() + 9 * 86400000) : null,
      notes: spec.currency === 'USD'
        ? 'SBP Purpose Code 9100. Wire to Meezan Bank IBAN: PK36MEZN0001020304050607.'
        : 'Local invoice. Payment via bank transfer within 14 days.',
      createdAt: issued,
      updatedAt: issued,
    }).returning();

    await db.insert(invoiceItems).values(
      spec.items.map(([description, quantity, rate], sortOrder) => ({
        invoiceId: inv.id,
        description: String(description),
        quantity: String(quantity),
        rate: Number(rate).toFixed(2),
        amount: (Number(quantity) * Number(rate)).toFixed(2),
        sortOrder,
      })),
    );
    invoiceRows.push({ inv, spec });
  }

  // 5. Income — one platform payout per month, plus the payouts that settle the paid invoices.
  const payoutClients = [techflow, smith, globalsoft, nordic];
  const incomeValues: any[] = MONTHS.map((n) => {
    const client = payoutClients[n % payoutClients.length];
    const amount = 700 + ((n * 137) % 900); // deterministic variation
    const rate = 276 + ((n * 7) % 12) + 0.25;
    return {
      userId: user.id,
      clientId: client.id,
      amount: amount.toFixed(2),
      currency: 'USD',
      exchangeRate: rate.toFixed(4),
      amountPKR: (amount * rate).toFixed(2),
      platform: client.platform,
      description: `${client.name} — remittance credited to Meezan Bank`,
      sbpPurposeCode: '9100',
      prcReferenceNumber: `PRC-${TAX_YEAR}-MZ${String(n + 10).padStart(3, '0')}`,
      receivedAt: monthsAgo(n, 12),
    };
  });

  // Local (non-export) income so the tax simulator shows both slabs and export rate.
  incomeValues.push({
    userId: user.id,
    clientId: khadim.id,
    amount: '300000.00',
    currency: 'PKR',
    exchangeRate: '1.0000',
    amountPKR: '300000.00',
    platform: 'other' as const,
    description: 'Khadim Logistics — local development milestone (domestic income)',
    sbpPurposeCode: null,
    prcReferenceNumber: null,
    receivedAt: monthsAgo(1, 20),
  });

  for (const { inv, spec } of invoiceRows.filter((r) => r.spec.status === 'paid')) {
    incomeValues.push({
      userId: user.id,
      clientId: spec.client.id,
      invoiceId: inv.id,
      amount: inv.total,
      currency: inv.currency,
      exchangeRate: inv.exchangeRate,
      amountPKR: inv.totalPKR,
      platform: spec.client.platform,
      description: `Payment received for invoice ${inv.invoiceNumber}`,
      sbpPurposeCode: '9100',
      prcReferenceNumber: `PRC-${TAX_YEAR}-INV${inv.invoiceNumber.slice(-4)}`,
      receivedAt: inv.paidAt,
    });
  }

  const incomeRows = await db.insert(income).values(incomeValues).returning();

  // 6. Expenses — recurring monthly costs plus a few one-offs.
  const recurring = [
    { amount: 5500, category: 'internet' as const, description: 'Nayatel fiber broadband monthly bill', vendor: 'Nayatel', paymentMethod: 'bank_transfer' },
    { amount: 18500, category: 'software' as const, description: 'Adobe Creative Cloud All Apps subscription', vendor: 'Adobe Systems', paymentMethod: 'card' },
    { amount: 25000, category: 'office' as const, description: 'Kickstart co-working dedicated desk rent', vendor: 'Kickstart Co-working', paymentMethod: 'bank_transfer' },
  ];

  const expenseValues: any[] = MONTHS.flatMap((n) =>
    recurring.map((e, i) => ({
      userId: user.id,
      amount: e.amount.toFixed(2),
      currency: 'PKR',
      exchangeRate: '1.0000',
      amountPKR: e.amount.toFixed(2),
      category: e.category,
      paymentMethod: e.paymentMethod,
      description: e.description,
      vendor: e.vendor,
      expenseDate: iso(monthsAgo(n, 2 + i)),
    })),
  );

  const oneOffs = [
    { n: 0, amount: 8200, category: 'software' as const, description: 'GitHub Copilot & Vercel Pro workspace plan', vendor: 'GitHub Inc.', paymentMethod: 'card' },
    { n: 1, amount: 145000, category: 'hardware' as const, description: 'MacBook Air M3 (business use)', vendor: 'Apple Reseller PK', paymentMethod: 'card' },
    { n: 2, amount: 32000, category: 'marketing' as const, description: 'LinkedIn Sales Navigator annual plan', vendor: 'LinkedIn', paymentMethod: 'card' },
    { n: 3, amount: 21000, category: 'education' as const, description: 'Advanced PostgreSQL performance course', vendor: 'Udemy', paymentMethod: 'card' },
    { n: 4, amount: 46000, category: 'travel' as const, description: 'Client meeting travel — Lahore to Dubai (economy)', vendor: 'Emirates', paymentMethod: 'card' },
    { n: 5, amount: 12500, category: 'tax' as const, description: 'Withholding tax on bank transactions', vendor: 'FBR', paymentMethod: 'bank_transfer' },
    { n: 6, amount: 9000, category: 'food' as const, description: 'Client lunch meetings (quarterly)', vendor: 'Various', paymentMethod: 'cash' },
    { n: 7, amount: 15000, category: 'other' as const, description: 'Miscellaneous office supplies', vendor: 'Various', paymentMethod: 'cash' },
  ];

  expenseValues.push(...oneOffs.map((e) => ({
    userId: user.id,
    amount: e.amount.toFixed(2),
    currency: 'PKR',
    exchangeRate: '1.0000',
    amountPKR: e.amount.toFixed(2),
    category: e.category,
    paymentMethod: e.paymentMethod,
    description: e.description,
    vendor: e.vendor,
    expenseDate: iso(monthsAgo(e.n, 18)),
  })));

  const expenseRows = await db.insert(expenses).values(expenseValues).returning();

  // 7. Assets, liabilities and the wealth statement — current and previous tax year.
  const assetSpecs = [
    { name: 'Meezan Bank Current Account', type: 'CASH', description: 'Primary business account (PKR)', currency: 'PKR', balance: '1850000.00', valuePKR: '1850000.00' },
    { name: 'Payoneer USD Balance', type: 'CASH', description: 'Platform payout balance held in USD', currency: 'USD', balance: '3200.00', valuePKR: '896000.00' },
    { name: 'DHA Phase 6 Plot (5 marla)', type: 'PROPERTY', description: 'Residential plot, purchased 2023', currency: 'PKR', balance: '0.00', valuePKR: '9500000.00' },
    { name: 'Toyota Corolla Altis 2022', type: 'VEHICLE', description: 'Registered in own name', currency: 'PKR', balance: '0.00', valuePKR: '6200000.00' },
    { name: 'Meezan Islamic Income Fund', type: 'INVESTMENT', description: 'Mutual fund units', currency: 'PKR', balance: '0.00', valuePKR: '1250000.00' },
    { name: 'Gold (tola x 12)', type: 'OTHER', description: 'Held as savings', currency: 'PKR', balance: '0.00', valuePKR: '3600000.00' },
  ];

  const assetValues = [
    ...assetSpecs.map((a) => ({ userId: user.id, taxYear: String(TAX_YEAR), ...a })),
    // Previous year snapshot: same holdings, lower valuations.
    ...assetSpecs.slice(0, 4).map((a) => ({
      userId: user.id,
      taxYear: PREV_YEAR,
      ...a,
      valuePKR: (Number(a.valuePKR) * 0.85).toFixed(2),
    })),
  ];

  await db.insert(assets).values(assetValues);

  const liabilitySpecs = [
    { taxYear: String(TAX_YEAR), description: 'Car loan — Meezan Bank (remaining principal)', amountPKR: '1850000.00' },
    { taxYear: String(TAX_YEAR), description: 'Credit card outstanding balance', amountPKR: '145000.00' },
    { taxYear: PREV_YEAR, description: 'Car loan — Meezan Bank (remaining principal)', amountPKR: '2600000.00' },
  ];

  await db.insert(liabilities).values(liabilitySpecs.map((l) => ({ userId: user.id, ...l })));

  /**
   * Opening wealth is derived, never hardcoded.
   *
   * The reconciliation checks `opening + income - expenses + adjustments` against
   * `assets - liabilities` for the SAME tax year. Assets are lifetime holdings
   * (property, car, gold) while income is only the months elapsed in this tax
   * year, so any fixed opening figure shows a red "doesn't reconcile" banner that
   * drifts further every month. Solving for opening keeps the demo green on any
   * run date. Mirrors WealthService.getReconciliation.
   */
  const openingFor = (year: number, declaredNetPKR: number, adjustmentsPKR: number) => {
    const range = taxYearRange(year);
    const inc = incomeInTaxYear(incomeRows, range).reduce((s, r: any) => s + Number(r.amountPKR || 0), 0);
    const exp = expensesInTaxYear(expenseRows, range).reduce((s, r: any) => s + Number(r.amountPKR || 0), 0);
    return declaredNetPKR - inc + exp - adjustmentsPKR;
  };

  const netFor = (year: string) =>
    assetValues.filter((a) => a.taxYear === year).reduce((s, a) => s + Number(a.valuePKR), 0) -
    liabilitySpecs.filter((l) => l.taxYear === year).reduce((s, l) => s + Number(l.amountPKR), 0);

  const CURRENT_ADJUSTMENTS = -120000; // e.g. personal draws not booked as an expense
  await db.insert(wealthStatements).values([
    {
      userId: user.id,
      taxYear: String(TAX_YEAR),
      openingWealthPKR: openingFor(TAX_YEAR, netFor(String(TAX_YEAR)), CURRENT_ADJUSTMENTS).toFixed(2),
      otherAdjustmentsPKR: CURRENT_ADJUSTMENTS.toFixed(2),
    },
    {
      userId: user.id,
      taxYear: PREV_YEAR,
      openingWealthPKR: openingFor(TAX_YEAR - 1, netFor(PREV_YEAR), 0).toFixed(2),
      otherAdjustmentsPKR: '0.00',
    },
  ]);

  // Re-derive the reconciliation the way the API does and fail loudly if the
  // fixtures would land the user on a red "wealth doesn't reconcile" banner.
  const TOLERANCE = Number(process.env.WEALTH_RECONCILE_TOLERANCE_PKR || 50000);
  for (const [year, adjustments] of [[TAX_YEAR, CURRENT_ADJUSTMENTS], [TAX_YEAR - 1, 0]] as const) {
    const range = taxYearRange(year);
    const declared = netFor(String(year));
    const opening = openingFor(year, declared, adjustments);
    const inc = incomeInTaxYear(incomeRows, range).reduce((s, r: any) => s + Number(r.amountPKR || 0), 0);
    const exp = expensesInTaxYear(expenseRows, range).reduce((s, r: any) => s + Number(r.amountPKR || 0), 0);
    const difference = declared - (opening + inc - exp + adjustments);
    if (Math.abs(difference) > TOLERANCE) {
      throw new Error(`Wealth for ${range.label} is out by ${difference.toFixed(2)} PKR (tolerance ${TOLERANCE}).`);
    }
    console.log(`  wealth ${range.label}: opening ${opening.toFixed(2)}, declared ${declared.toFixed(2)}, out by ${difference.toFixed(2)} — reconciles`);
  }

  // 8. Evidence vault — PRCs against income, receipts against expenses.
  // ponytail: blobUrl points at a placeholder host; upload real files through the
  // evidence module if you need the download link to resolve.
  const BLOB = 'https://demo.blob.vercel-storage.com/freelancerhisab-seed';
  const evidenceValues = [
    ...incomeRows.slice(0, 6).map((inc: any, i: number) => ({
      userId: user.id,
      incomeId: inc.id,
      fileName: `PRC-${inc.prcReferenceNumber || i}.pdf`,
      fileType: 'application/pdf',
      fileSize: 128000 + i * 4096,
      blobUrl: `${BLOB}/prc-${i + 1}.pdf`,
      documentType: 'PRC',
      notes: 'Proceeds Realization Certificate issued by Meezan Bank.',
    })),
    ...expenseRows.slice(0, 4).map((exp: any, i: number) => ({
      userId: user.id,
      expenseId: exp.id,
      fileName: `receipt-${exp.vendor?.toLowerCase().replace(/\s+/g, '-') || 'expense'}-${i + 1}.jpg`,
      fileType: 'image/jpeg',
      fileSize: 240000 + i * 8192,
      blobUrl: `${BLOB}/receipt-${i + 1}.jpg`,
      documentType: 'RECEIPT',
      notes: 'Vendor receipt.',
    })),
    ...invoiceRows.slice(0, 2).map(({ inv }: any, i: number) => ({
      userId: user.id,
      fileName: `${inv.invoiceNumber}.pdf`,
      fileType: 'application/pdf',
      fileSize: 96000 + i * 2048,
      blobUrl: `${BLOB}/${inv.invoiceNumber}.pdf`,
      documentType: 'INVOICE',
      notes: 'Signed invoice copy sent to the client.',
    })),
  ];
  await db.insert(evidenceDocuments).values(evidenceValues);

  // 9. Tax rules are global config, not user data — only seed a year that has none.
  const existingRules = await db.select().from(taxRules).where(eq(taxRules.taxYear, RANGE.label));
  if (existingRules.length === 0) {
    const from = iso(RANGE.start);
    const to = iso(new Date(RANGE.end.getTime() - 86400000));
    await db.insert(taxRules).values([
      { taxYear: RANGE.label, incomeType: 'IT_EXPORT_PSEB', rate: '0.0025', effectiveFrom: from, effectiveTo: to, notes: 'PSEB-registered IT export services — 0.25% final tax.' },
      { taxYear: RANGE.label, incomeType: 'IT_EXPORT_STANDARD', rate: '0.0100', effectiveFrom: from, effectiveTo: to, notes: 'Non-PSEB IT export services — 1% final tax.' },
      ...[
        { threshold: '0', rate: '0.0000' },
        { threshold: '600000', rate: '0.0250' },
        { threshold: '1200000', rate: '0.1250' },
        { threshold: '2400000', rate: '0.2250' },
        { threshold: '3600000', rate: '0.3500' },
      ].map((s) => ({
        taxYear: RANGE.label,
        incomeType: 'LOCAL_SLAB',
        rate: s.rate,
        threshold: s.threshold,
        effectiveFrom: from,
        effectiveTo: to,
        notes: 'Local income marginal slab (lower bound).',
      })),
    ]);
    console.log(`  tax rules: seeded 7 rows for ${RANGE.label}`);
  } else {
    console.log(`  tax rules: ${existingRules.length} rows already exist for ${RANGE.label}, left untouched`);
  }

  console.log([
    'Seeding completed:',
    `  login:      ${DEMO_EMAIL} / ${DEMO_PASSWORD}`,
    `  tax year:   ${RANGE.label} (${iso(RANGE.start)} → ${iso(new Date(RANGE.end.getTime() - 86400000))})`,
    `  clients:    ${clientRows.length}`,
    `  invoices:   ${invoiceRows.length} (+ items)`,
    `  income:     ${incomeRows.length}`,
    `  expenses:   ${expenseRows.length}`,
    `  wealth:     ${assetSpecs.length + 4} assets, 3 liabilities, 2 statements`,
    `  evidence:   ${evidenceValues.length} documents`,
  ].join('\n'));
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
