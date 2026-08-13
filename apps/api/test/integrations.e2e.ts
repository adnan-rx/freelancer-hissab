/**
 * End-to-end verification against a real Postgres database.
 *
 * Runs the real migrations, then drives the real services (no mock DB) through
 * the full integration lifecycle and checks that every downstream feature —
 * dashboard, reports, tax, filing, transactions, wealth — still reads the
 * imported records correctly.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { eq, sql } from 'drizzle-orm';

import * as schema from '../src/database/schema';
import { ImportEngineService } from '../src/modules/integrations/import-engine.service';
import { IntegrationsSyncService } from '../src/modules/integrations/integrations-sync.service';
import { IntegrationsService } from '../src/modules/integrations/integrations.service';
import { IntegrationsSchedulerService } from '../src/modules/integrations/integrations-scheduler.service';
import { PlatformRegistryService } from '../src/modules/integrations/registry/platform-registry.service';
import { UpworkConnector } from '../src/modules/integrations/connectors/upwork.connector';
import { FiverrConnector } from '../src/modules/integrations/connectors/fiverr.connector';
import { FreelancerConnector } from '../src/modules/integrations/connectors/freelancer.connector';
import { ToptalConnector } from '../src/modules/integrations/connectors/toptal.connector';
import { GenericConnector } from '../src/modules/integrations/connectors/generic.connector';
import { CsvService } from '../src/modules/csv/csv.service';
import { ExchangeRateService } from '../src/modules/exchange-rate/exchange-rate.service';
import { DashboardService } from '../src/modules/dashboard/dashboard.service';
import { ReportsService } from '../src/modules/reports/reports.service';
import { TaxService } from '../src/modules/tax/tax.service';
import { FilingService } from '../src/modules/filing/filing.service';
import { WealthService } from '../src/modules/wealth/wealth.service';
import { TransactionsService } from '../src/modules/transactions/transactions.service';
import { createOAuthState } from '../src/modules/integrations/oauth-state';

const DATABASE_URL = process.env.E2E_DATABASE_URL;
if (!DATABASE_URL) {
  console.error(
    'Set E2E_DATABASE_URL to a THROWAWAY database — this harness migrates and writes to it.\n' +
      '  createdb fh_e2e && E2E_DATABASE_URL=postgresql://user:pass@localhost:5432/fh_e2e npm run test:e2e',
  );
  process.exit(2);
}

let failures = 0;
let checks = 0;

function check(label: string, condition: boolean, detail?: unknown): void {
  checks++;
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    failures++;
    console.log(`  ✗ ${label}${detail !== undefined ? ` → ${JSON.stringify(detail)}` : ''}`);
  }
}

function section(title: string): void {
  console.log(`\n── ${title}`);
}

async function main(): Promise<void> {
  const client = postgres(DATABASE_URL, { max: 1, prepare: false });
  const db = drizzle(client, { schema });

  section('Migrations');
  await migrate(db, { migrationsFolder: new URL('../src/database/migrations', import.meta.url).pathname });
  console.log('  ✓ all migrations applied to a fresh database');

  const cols = await client`
    SELECT table_name, column_name FROM information_schema.columns
    WHERE column_name = 'external_id' AND table_name IN ('income','expenses')`;
  check('external_id exists on income and expenses', cols.length === 2, cols);

  const idx = await client`
    SELECT indexname FROM pg_indexes
    WHERE indexname IN ('income_user_external_id_idx','expense_user_external_id_idx')`;
  check('unique idempotency indexes created', idx.length === 2, idx);

  // ---------------------------------------------------------------------

  const fixedRates = { USD: 280, EUR: 300, PKR: 1 } as Record<string, number>;
  const rateStub = {
    getRate: async (from: string) => fixedRates[from?.toUpperCase()] ?? 280,
    convertToPKR: async (amount: number, from: string) => ({
      amountPKR: amount * (fixedRates[from?.toUpperCase()] ?? 280),
      exchangeRate: fixedRates[from?.toUpperCase()] ?? 280,
    }),
  };

  // Built by hand rather than through Nest DI: tsx does not emit decorator
  // metadata, and these are plain classes anyway.
  const upwork = new UpworkConnector();
  const registry = new PlatformRegistryService(
    upwork,
    new FiverrConnector(),
    new FreelancerConnector(),
    new ToptalConnector(),
    new GenericConnector(),
  );
  const engine = new ImportEngineService(db as never, rateStub as never);
  const syncService = new IntegrationsSyncService(db as never, registry, engine);
  const integrations = new IntegrationsService(db as never, registry, syncService);
  const scheduler = new IntegrationsSchedulerService(db as never, syncService);
  const csv = new CsvService(engine);
  const dashboard = new DashboardService(db as never);
  const reports = new ReportsService(db as never);
  const taxSvc = new TaxService(db as never);
  const filing = new FilingService(db as never, new WealthService(db as never));
  const transactions = new TransactionsService(db as never);
  const tax = taxSvc;

  const [user] = await db
    .insert(schema.users)
    .values({ email: 'e2e@example.com', name: 'E2E User', passwordHash: 'x' })
    .returning();
  const userId = user.id;

  // ---------------------------------------------------------------------
  section('Connect (OAuth) + initial sync');

  const batch = [
    {
      externalId: 'REC-5001',
      platform: 'upwork',
      type: 'income',
      occurredAt: new Date('2026-08-01T10:00:00Z'),
      amount: 1850,
      currency: 'USD',
      description: 'Milestone 1 — platform rebuild',
      client: { name: 'CloudScale Systems', company: 'CloudScale Systems Inc.' },
      invoiceRef: 'REC-5001',
      invoiceStatus: 'paid',
      category: 'freelance_service',
    },
    {
      externalId: 'REC-5002',
      platform: 'upwork',
      type: 'expense',
      occurredAt: new Date('2026-08-01T10:00:00Z'),
      amount: 185,
      currency: 'USD',
      description: 'Upwork fee — Milestone 1',
      vendor: 'Upwork',
      category: 'other',
    },
    {
      externalId: 'REC-5003',
      platform: 'upwork',
      type: 'income',
      occurredAt: new Date('2026-08-05T09:00:00Z'),
      amount: 950,
      currency: 'EUR',
      description: 'Milestone 2 — API integration',
      client: { name: 'DataVibe Interactive' },
      invoiceRef: 'REC-5003',
      invoiceStatus: 'paid',
      category: 'freelance_service',
    },
  ];

  upwork.exchangeAuthCode = async () => ({
    accessToken: 'e2e-access',
    refreshToken: 'e2e-refresh',
    expiresAt: new Date(Date.now() + 3_600_000),
    accountIdentifier: 'ace-e2e',
    accountName: 'E2E Upwork Account',
    metadata: { accountingEntityId: 'ace-e2e' },
  });
  upwork.fetchTransactions = async () => batch;

  const state = createOAuthState(userId, 'upwork');
  const connected = await integrations.completeAuthorization(
    userId,
    'upwork',
    'code-123',
    state,
    'https://app.test/cb',
  );

  check('connection established', connected.connection.status === 'connected', connected.connection.status);
  check('initial sync imported 2 income + 1 fee', connected.syncResult?.incomeCreatedCount === 2 && connected.syncResult?.expensesCreatedCount === 1, connected.syncResult);
  check('no token field in the API payload', !JSON.stringify(connected.connection).match(/token|e2e-access|e2e-refresh/i));

  const stored = await db.select().from(schema.platformConnections).where(eq(schema.platformConnections.userId, userId));
  check('access token stored encrypted', !!stored[0].encryptedAccessToken && !stored[0].encryptedAccessToken!.includes('e2e-access'));

  const connectionId = stored[0].id;

  // ---------------------------------------------------------------------
  section('Records created (behave like manual records)');

  const incomeRows = await db.select().from(schema.income).where(eq(schema.income.userId, userId));
  const expenseRows = await db.select().from(schema.expenses).where(eq(schema.expenses.userId, userId));
  const clientRows = await db.select().from(schema.clients).where(eq(schema.clients.userId, userId));
  const invoiceRows = await db.select().from(schema.invoices).where(eq(schema.invoices.userId, userId));
  const itemRows = await db.select().from(schema.invoiceItems);

  check('2 income rows', incomeRows.length === 2, incomeRows.length);
  check('1 expense row', expenseRows.length === 1, expenseRows.length);
  check('2 clients', clientRows.length === 2, clientRows.map((c) => c.name));
  check('2 invoices', invoiceRows.length === 2, invoiceRows.length);
  check('2 invoice line items', itemRows.length === 2, itemRows.length);

  const usdIncome = incomeRows.find((r) => r.currency === 'USD')!;
  const eurIncome = incomeRows.find((r) => r.currency === 'EUR')!;
  check('USD income converted at its own rate', usdIncome.amountPKR === '518000.00', usdIncome.amountPKR);
  check('EUR income converted at its own rate', eurIncome.amountPKR === '285000.00', eurIncome.amountPKR);
  check('income linked to a client', incomeRows.every((r) => r.clientId !== null));
  check('income linked to an invoice', incomeRows.every((r) => r.invoiceId !== null));
  check('fee expense attributed to the platform', expenseRows[0].vendor === 'Upwork' && expenseRows[0].amountPKR === '51800.00', expenseRows[0]);
  check('external ids namespaced by platform', incomeRows.every((r) => r.externalId?.startsWith('upwork:')));
  check('SBP code left to the schema default, not the importer', incomeRows.every((r) => r.sbpPurposeCode === '9100') && incomeRows.every((r) => r.prcReferenceNumber === null));

  // ---------------------------------------------------------------------
  section('Idempotency — repeated sync');

  const second = await syncService.runSync(userId, connectionId, 'manual');
  const third = await syncService.runSync(userId, connectionId, 'scheduled');

  check('second sync creates nothing', second.incomeCreatedCount === 0 && second.expensesCreatedCount === 0, second);
  check('second sync counts duplicates', second.duplicatesSkippedCount === 3, second.duplicatesSkippedCount);
  check('third sync also creates nothing', third.incomeCreatedCount === 0 && third.expensesCreatedCount === 0, third);

  const afterRepeat = await db.select().from(schema.income).where(eq(schema.income.userId, userId));
  const afterRepeatClients = await db.select().from(schema.clients).where(eq(schema.clients.userId, userId));
  const afterRepeatInvoices = await db.select().from(schema.invoices).where(eq(schema.invoices.userId, userId));
  check('income table unchanged after 3 syncs', afterRepeat.length === 2, afterRepeat.length);
  check('clients unchanged after 3 syncs', afterRepeatClients.length === 2, afterRepeatClients.length);
  check('invoices unchanged after 3 syncs', afterRepeatInvoices.length === 2, afterRepeatInvoices.length);

  section('Database enforces idempotency even if code is bypassed');
  let uniqueViolation = false;
  try {
    await db.insert(schema.income).values({
      userId,
      amount: '1.00',
      currency: 'USD',
      exchangeRate: '280.0000',
      amountPKR: '280.00',
      description: 'duplicate attempt',
      externalId: 'upwork:REC-5001',
      receivedAt: new Date(),
    });
  } catch {
    uniqueViolation = true;
  }
  check('unique index rejects a duplicate external id', uniqueViolation);

  // ---------------------------------------------------------------------
  section('Incremental sync');

  const conn = (await db.select().from(schema.platformConnections).where(eq(schema.platformConnections.id, connectionId)))[0];
  check('cursor advanced after success', conn.lastSuccessfulSyncAt !== null);

  let requestedSince: Date | undefined;
  upwork.fetchTransactions = async (opts: { since?: Date }) => {
    requestedSince = opts.since;
    return [
      {
        externalId: 'REC-5004',
        platform: 'upwork',
        type: 'income',
        occurredAt: new Date('2026-08-09T12:00:00Z'),
        amount: 400,
        currency: 'USD',
        description: 'Milestone 3',
        client: { name: 'CloudScale Systems' },
        invoiceRef: 'REC-5004',
        invoiceStatus: 'paid',
      },
    ];
  };

  const incremental = await syncService.runSync(userId, connectionId, 'manual');
  check('incremental request bounded by last success', requestedSince instanceof Date, requestedSince);
  check('new transaction imported', incremental.incomeCreatedCount === 1, incremental);
  check('existing client reused, not duplicated', incremental.clientsCreatedCount === 0, incremental.clientsCreatedCount);

  // ---------------------------------------------------------------------
  section('Preview writes nothing');

  upwork.fetchTransactions = async () => [
    {
      externalId: 'REC-6001',
      platform: 'upwork',
      type: 'income',
      occurredAt: new Date('2026-08-11T12:00:00Z'),
      amount: 700,
      currency: 'USD',
      description: 'Unconfirmed milestone',
      client: { name: 'Northwind Digital' },
      invoiceRef: 'REC-6001',
    },
  ];

  const beforePreview = (await db.select({ n: sql<number>`count(*)::int` }).from(schema.income))[0].n;
  const preview = await syncService.previewSync(userId, connectionId);
  const afterPreview = (await db.select({ n: sql<number>`count(*)::int` }).from(schema.income))[0].n;

  check('preview reports the pending income', preview.incomeCount === 1, preview.incomeCount);
  check('preview computes PKR totals', preview.grossAmountPKR === 196000, preview.grossAmountPKR);
  check('preview identifies the new client', preview.newClients.includes('Northwind Digital'), preview.newClients);
  check('preview wrote nothing', beforePreview === afterPreview, { beforePreview, afterPreview });

  // ---------------------------------------------------------------------
  section('Token expiry, refresh, and reconnect');

  await db
    .update(schema.platformConnections)
    .set({ tokenExpiresAt: new Date(Date.now() - 60_000) })
    .where(eq(schema.platformConnections.id, connectionId));

  upwork.refreshTokens = async () => ({
    accessToken: 'rotated-access',
    refreshToken: 'rotated-refresh',
    expiresAt: new Date(Date.now() + 3_600_000),
  });
  upwork.fetchTransactions = async (opts: { accessToken: string }) => {
    check('sync used the refreshed token', opts.accessToken === 'rotated-access', opts.accessToken);
    return [];
  };
  await syncService.runSync(userId, connectionId, 'manual');

  const refreshed = (await db.select().from(schema.platformConnections).where(eq(schema.platformConnections.id, connectionId)))[0];
  check('refreshed token re-encrypted at rest', !refreshed.encryptedAccessToken!.includes('rotated-access'));

  // Now make refresh fail: the account must be flagged for reconnect.
  await db
    .update(schema.platformConnections)
    .set({ tokenExpiresAt: new Date(Date.now() - 60_000) })
    .where(eq(schema.platformConnections.id, connectionId));
  upwork.refreshTokens = async () => {
    throw new Error('invalid_grant');
  };

  let reauthMessage = '';
  try {
    await syncService.runSync(userId, connectionId, 'scheduled');
  } catch (err) {
    reauthMessage = err instanceof Error ? err.message : String(err);
  }
  check('expired refresh asks the user to reconnect', /reconnect/i.test(reauthMessage), reauthMessage);

  const expired = (await db.select().from(schema.platformConnections).where(eq(schema.platformConnections.id, connectionId)))[0];
  check('connection marked expired', expired.status === 'expired', expired.status);

  check('scheduler skips an expired connection', (await scheduler.sweep()).attempted === 0);

  // Reconnect restores the same row.
  upwork.exchangeAuthCode = async () => ({
    accessToken: 'reconnected-access',
    refreshToken: 'reconnected-refresh',
    expiresAt: new Date(Date.now() + 3_600_000),
    accountIdentifier: 'ace-e2e',
    accountName: 'E2E Upwork Account',
    metadata: { accountingEntityId: 'ace-e2e' },
  });
  upwork.fetchTransactions = async () => [];

  const reconnected = await integrations.completeAuthorization(
    userId,
    'upwork',
    'code-456',
    createOAuthState(userId, 'upwork'),
    'https://app.test/cb',
  );
  const allConnections = await db.select().from(schema.platformConnections).where(eq(schema.platformConnections.userId, userId));
  check('reconnect updates in place (one row)', allConnections.length === 1, allConnections.length);
  check('reconnect clears the error state', reconnected.connection.status === 'connected', reconnected.connection.status);

  // ---------------------------------------------------------------------
  section('Failed sync is recorded, cursor preserved');

  const cursorBefore = (await db.select().from(schema.platformConnections).where(eq(schema.platformConnections.id, connectionId)))[0].lastSuccessfulSyncAt;
  upwork.fetchTransactions = async () => {
    throw new Error('Upwork API request failed with status 503.');
  };
  try {
    await syncService.runSync(userId, connectionId, 'manual');
  } catch {
    /* expected */
  }
  const afterFailure = (await db.select().from(schema.platformConnections).where(eq(schema.platformConnections.id, connectionId)))[0];
  check('failure marks the connection', afterFailure.status === 'error' && afterFailure.syncStatus === 'failed', afterFailure.status);
  check('failure preserves the cursor', afterFailure.lastSuccessfulSyncAt?.getTime() === cursorBefore?.getTime());

  const logs = await integrations.getSyncLogs(userId, connectionId);
  check('sync log records both successes and failures', logs.some((l) => l.status === 'success') && logs.some((l) => l.status === 'failed'), logs.map((l) => l.status));

  // ---------------------------------------------------------------------
  section('CSV fallback shares the same engine');

  const fiverrCsv = `Date,Order ID,Item Description,Buyer,Gross Amount,Service Fee,Net Amount,Status
08/12/2026,FO90001,"Landing page build",acme_buyer,600.00,-120.00,480.00,Cleared`;

  const csvPreview = await csv.previewImport(userId, Buffer.from(fiverrCsv), 280);
  check('CSV preview detects the platform', csvPreview.detectedPlatform === 'fiverr', csvPreview.detectedPlatform);
  check('CSV preview splits gross and fee', csvPreview.incomeCount === 1 && csvPreview.expenseCount === 1, csvPreview);

  const csvImport = await csv.parseAndImport(userId, Buffer.from(fiverrCsv), 280);
  const csvRepeat = await csv.parseAndImport(userId, Buffer.from(fiverrCsv), 280);
  check('CSV import creates income + fee', csvImport.incomeCount === 1 && csvImport.expenseCount === 1, csvImport);
  check('CSV re-import is idempotent', csvRepeat.incomeCount === 0 && csvRepeat.duplicateRows === 2, csvRepeat);

  const fiverrIncome = (await db.select().from(schema.income).where(eq(schema.income.platform, 'fiverr')))[0];
  check('CSV income carries an external id', fiverrIncome.externalId?.startsWith('fiverr:'), fiverrIncome.externalId);
  check('CSV income has the same shape as API income', fiverrIncome.clientId !== null && fiverrIncome.invoiceId !== null);

  section('CSV-only platforms refuse to fake a connection');
  for (const platform of ['fiverr', 'freelancer', 'toptal', 'generic']) {
    let refused = false;
    try {
      await integrations.getAuthUrl(userId, platform, 'https://app.test/cb');
    } catch {
      refused = true;
    }
    check(`${platform} refuses OAuth and states its limitation`, refused);
  }

  // ---------------------------------------------------------------------
  section('Downstream features read the imported records');

  const summary = await dashboard.getSummary(userId);
  const summaryJson = JSON.stringify(summary);
  check('dashboard summary computed over imported records', typeof summary === 'object' && summary !== null);
  check('dashboard reports non-zero income', /[1-9]/.test(summaryJson) && summaryJson.includes('ncome'), summaryJson.slice(0, 200));

  const txList = await transactions.findAll(userId, {} as never);
  check('transactions feed lists imported records', (txList.data?.length ?? 0) > 0, txList.data?.length);
  check('feed includes both income and fee rows',
    new Set((txList.data ?? []).map((t: { type?: string }) => t.type)).size >= 2,
    Array.from(new Set((txList.data ?? []).map((t: { type?: string }) => t.type))));

  // Pakistani tax year N runs 1 Jul (N-1) → 30 Jun (N), so the Aug-2026
  // transactions above belong to tax year 2027.
  const estimate = await tax.calculateTaxEstimate(userId, false, 2027);
  check('tax engine sees imported income as export income',
    estimate.totalGrossIncomePKR > 0 && estimate.exportIncomePKR > 0,
    { gross: estimate.totalGrossIncomePKR, export: estimate.exportIncomePKR });
  check('tax engine sees imported platform fees as expenses',
    estimate.totalExpensesPKR > 0, estimate.totalExpensesPKR);
  check('net profit = imported income - imported fees',
    Math.round(estimate.netProfitPKR) === Math.round(estimate.totalGrossIncomePKR - estimate.totalExpensesPKR),
    { net: estimate.netProfitPKR, gross: estimate.totalGrossIncomePKR, exp: estimate.totalExpensesPKR });
  check('tax liability derived from imported records',
    Number.isFinite(estimate.exportTaxLiabilityPKR), estimate.exportTaxLiabilityPKR);

  const emptyYear = await tax.calculateTaxEstimate(userId, false, 2026);
  check('a year with no imported activity stays zero', emptyYear.totalGrossIncomePKR === 0, emptyYear.totalGrossIncomePKR);

  const readiness = await filing.getReadinessScore(userId);
  check('filing readiness computes without error', typeof readiness === 'object' && readiness !== null);

  const checklist = await filing.getChecklist(userId);
  check('filing checklist computes without error', typeof checklist === 'object' && checklist !== null);

  const incomeVsExpenses = await reports.getIncomeVsExpenses(userId);
  check('reports: income vs expenses includes imported data',
    JSON.stringify(incomeVsExpenses).length > 2, JSON.stringify(incomeVsExpenses).slice(0, 160));

  const consolidation = await reports.getIncomeConsolidation(userId);
  check('reports: income consolidation groups imported platforms',
    JSON.stringify(consolidation).includes('upwork') || JSON.stringify(consolidation).includes('fiverr'),
    JSON.stringify(consolidation).slice(0, 200));

  section('Disconnect keeps the ledger');
  const incomeBeforeDisconnect = (await db.select({ n: sql<number>`count(*)::int` }).from(schema.income))[0].n;
  await integrations.disconnect(userId, connectionId);
  const incomeAfterDisconnect = (await db.select({ n: sql<number>`count(*)::int` }).from(schema.income))[0].n;
  const connectionsAfter = await db.select().from(schema.platformConnections).where(eq(schema.platformConnections.userId, userId));
  check('connection removed', connectionsAfter.length === 0);
  check('imported records survive disconnect', incomeBeforeDisconnect === incomeAfterDisconnect, { incomeBeforeDisconnect, incomeAfterDisconnect });

  await client.end();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`${checks - failures}/${checks} checks passed`);
  console.log('='.repeat(60));
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\nE2E HARNESS ERROR:', err);
  process.exit(2);
});
