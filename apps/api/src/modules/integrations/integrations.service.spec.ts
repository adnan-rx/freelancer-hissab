import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { IntegrationsSyncService } from './integrations-sync.service';
import { IntegrationsSchedulerService } from './integrations-scheduler.service';
import { ImportEngineService } from './import-engine.service';
import { PlatformRegistryService } from './registry/platform-registry.service';
import { UpworkConnector } from './connectors/upwork.connector';
import { FiverrConnector } from './connectors/fiverr.connector';
import { FreelancerConnector } from './connectors/freelancer.connector';
import { ToptalConnector } from './connectors/toptal.connector';
import { GenericConnector } from './connectors/generic.connector';
import { ExchangeRateService } from '../exchange-rate/exchange-rate.service';
import { DRIZZLE } from '../../database/database.module';
import {
  clients,
  expenses,
  income,
  invoiceItems,
  invoices,
  platformConnections,
  platformSyncLogs,
} from '../../database/schema';
import { createMockDb, mockExchangeRateService } from '../../common/testing/mock-db';
import { decryptToken, encryptToken } from '../../common/encryption';
import { createOAuthState, verifyOAuthState } from './oauth-state';
import { NormalizedTransaction } from './interfaces/normalized-transaction.interface';

const USER_ID = '11111111-1111-1111-1111-111111111111';
const CONNECTION_ID = '22222222-2222-2222-2222-222222222222';

/** A milestone payment and the Upwork fee taken out of it. */
function upworkBatch(): NormalizedTransaction[] {
  return [
    {
      externalId: 'REC-1001',
      platform: 'upwork',
      type: 'income',
      occurredAt: new Date('2026-08-01T10:00:00Z'),
      amount: 1850,
      currency: 'USD',
      description: 'Milestone 1 — platform rebuild',
      client: { name: 'CloudScale Systems', company: 'CloudScale Systems Inc.' },
      invoiceRef: 'REC-1001',
      invoiceStatus: 'paid',
      category: 'freelance_service',
    },
    {
      externalId: 'REC-1002',
      platform: 'upwork',
      type: 'expense',
      occurredAt: new Date('2026-08-01T10:00:00Z'),
      amount: 185,
      currency: 'USD',
      description: 'Upwork fee — Milestone 1',
      vendor: 'Upwork',
      category: 'other',
    },
  ];
}

function connectionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: CONNECTION_ID,
    userId: USER_ID,
    platform: 'upwork',
    accountIdentifier: 'ace-778',
    accountName: 'Acme Studio',
    encryptedAccessToken: encryptToken('live-access-token'),
    encryptedRefreshToken: encryptToken('live-refresh-token'),
    tokenExpiresAt: new Date(Date.now() + 3600_000),
    status: 'connected',
    lastSyncAt: null,
    lastSuccessfulSyncAt: null,
    syncStatus: 'idle',
    lastSyncError: null,
    syncedTransactionsCount: 0,
    failedTransactionsCount: 0,
    metadata: JSON.stringify({ accountingEntityId: 'ace-778' }),
    createdAt: new Date('2026-07-01T00:00:00Z'),
    updatedAt: new Date('2026-07-01T00:00:00Z'),
    ...overrides,
  };
}

async function buildHarness(connections: Array<Record<string, unknown>> = []) {
  const rows = new Map<unknown, unknown[]>([
    [platformConnections, connections],
    [platformSyncLogs, []],
    [clients, []],
    [invoices, []],
    [invoiceItems, []],
    [income, []],
    [expenses, []],
  ]);
  const db = createMockDb(rows);

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      IntegrationsService,
      IntegrationsSyncService,
      IntegrationsSchedulerService,
      ImportEngineService,
      PlatformRegistryService,
      UpworkConnector,
      FiverrConnector,
      FreelancerConnector,
      ToptalConnector,
      GenericConnector,
      { provide: DRIZZLE, useValue: db },
      { provide: ExchangeRateService, useValue: mockExchangeRateService },
    ],
  }).compile();

  return {
    service: module.get(IntegrationsService),
    sync: module.get(IntegrationsSyncService),
    scheduler: module.get(IntegrationsSchedulerService),
    engine: module.get(ImportEngineService),
    registry: module.get(PlatformRegistryService),
    upwork: module.get(UpworkConnector),
    db,
    rows,
  };
}

const rowsOf = (db: ReturnType<typeof createMockDb>, table: unknown) =>
  db._inserted.filter((i: { table: unknown }) => i.table === table).map((i: { values: unknown }) => i.values);

describe('Platform integrations', () => {
  describe('Credential security', () => {
    it('round-trips a token through AES-256-GCM', () => {
      const token = 'oauth2-live-refresh-token-abc123';
      const encrypted = encryptToken(token);

      expect(encrypted).not.toContain(token);
      expect(encrypted.split(':')).toHaveLength(3); // iv:authTag:ciphertext
      expect(decryptToken(encrypted)).toBe(token);
    });

    it('rejects a tampered ciphertext rather than returning garbage', () => {
      const encrypted = encryptToken('sensitive');
      const [iv, tag, data] = encrypted.split(':');
      const flipped = data.startsWith('a') ? `b${data.slice(1)}` : `a${data.slice(1)}`;

      expect(() => decryptToken(`${iv}:${tag}:${flipped}`)).toThrow();
    });

    it('never returns a token in a connection payload', async () => {
      const { service } = await buildHarness([connectionRow()]);

      const [connection] = await service.getConnections(USER_ID);
      const serialized = JSON.stringify(connection);

      expect(serialized).not.toContain('live-access-token');
      expect(serialized).not.toContain('live-refresh-token');
      expect(serialized).not.toMatch(/encrypted/i);
      expect(connection.accountName).toBe('Acme Studio');
    });
  });

  describe('OAuth state', () => {
    it('accepts a state it issued for the same user and platform', () => {
      const state = createOAuthState(USER_ID, 'upwork');
      expect(() => verifyOAuthState(state, USER_ID, 'upwork')).not.toThrow();
    });

    it('rejects a state issued for a different user', () => {
      const state = createOAuthState('another-user', 'upwork');
      expect(() => verifyOAuthState(state, USER_ID, 'upwork')).toThrow(BadRequestException);
    });

    it('rejects a forged signature', () => {
      const [body] = createOAuthState(USER_ID, 'upwork').split('.');
      expect(() => verifyOAuthState(`${body}.forged`, USER_ID, 'upwork')).toThrow(BadRequestException);
    });
  });

  describe('Platform capabilities are stated honestly', () => {
    it('advertises automatic sync only where an official financial API exists', async () => {
      const { registry } = await buildHarness();
      const byId = new Map(registry.getAllPlatforms().map((p) => [p.id, p]));

      expect(byId.get('upwork')?.capabilities.automaticSync).toBe(true);

      for (const id of ['fiverr', 'freelancer', 'toptal', 'generic'] as const) {
        const platform = byId.get(id);
        expect(platform?.capabilities.automaticSync).toBe(false);
        // A platform that cannot sync must say why, and must offer the fallback.
        expect(platform?.limitationNotice?.length).toBeGreaterThan(0);
        expect(platform?.capabilities.csvFallback).toBe(true);
      }
    });

    it('refuses to start an OAuth flow for a platform with no official API', async () => {
      const { service } = await buildHarness();

      await expect(service.getAuthUrl(USER_ID, 'fiverr', 'https://app.test/cb')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.getAuthUrl(USER_ID, 'toptal', 'https://app.test/cb')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('surfaces the platform limitation when a CSV-only connector is invoked', async () => {
      const { registry } = await buildHarness();

      await expect(registry.getConnector('fiverr').fetchTransactions()).rejects.toThrow(/no public API/i);
    });
  });

  describe('Import engine', () => {
    it('creates client, invoice, income and fee expense from one batch', async () => {
      const { engine, db } = await buildHarness();

      const summary = await engine.apply(USER_ID, upworkBatch());

      expect(summary).toMatchObject({
        success: true,
        incomeCreatedCount: 1,
        expensesCreatedCount: 1,
        clientsCreatedCount: 1,
        invoicesCreatedCount: 1,
        duplicatesSkippedCount: 0,
      });

      const [client] = rowsOf(db, clients);
      expect(client).toMatchObject({ name: 'CloudScale Systems', platform: 'upwork', currency: 'USD' });

      const [invoice] = rowsOf(db, invoices);
      expect(invoice).toMatchObject({ invoiceNumber: 'REC-1001', status: 'paid', total: '1850.00' });
      // Rate 280 from the stub: the PKR value must be derived from the rounded amount.
      expect(invoice.totalPKR).toBe('518000.00');
      expect(rowsOf(db, invoiceItems)).toHaveLength(1);

      const [incomeRow] = rowsOf(db, income);
      expect(incomeRow).toMatchObject({
        amount: '1850.00',
        amountPKR: '518000.00',
        exchangeRate: '280.0000',
        platform: 'upwork',
        externalId: 'upwork:REC-1001',
      });

      const [expenseRow] = rowsOf(db, expenses);
      expect(expenseRow).toMatchObject({
        amount: '185.00',
        amountPKR: '51800.00',
        category: 'other',
        vendor: 'Upwork',
        externalId: 'upwork:REC-1002',
      });
      expect(expenseRow.expenseDate).toBe('2026-08-01');
    });

    it('does not write any tax classification of its own', async () => {
      const { engine, db } = await buildHarness();

      await engine.apply(USER_ID, upworkBatch());

      // The tax engine and the column default own SBP codes — not the importer.
      const [incomeRow] = rowsOf(db, income);
      expect(incomeRow).not.toHaveProperty('sbpPurposeCode');
      expect(incomeRow).not.toHaveProperty('prcReferenceNumber');
      expect(incomeRow).not.toHaveProperty('taxRate');
    });

    it('passes a regulatory code through when the source states one', async () => {
      const { engine, db } = await buildHarness();

      await engine.apply(USER_ID, [
        { ...upworkBatch()[0], sbpPurposeCode: '9186', prcReferenceNumber: 'PRC-42' },
      ]);

      expect(rowsOf(db, income)[0]).toMatchObject({ sbpPurposeCode: '9186', prcReferenceNumber: 'PRC-42' });
    });

    it('is idempotent — re-importing the same batch creates nothing', async () => {
      const { engine, db } = await buildHarness();

      const first = await engine.apply(USER_ID, upworkBatch());
      const second = await engine.apply(USER_ID, upworkBatch());

      expect(first.incomeCreatedCount).toBe(1);
      expect(second).toMatchObject({
        incomeCreatedCount: 0,
        expensesCreatedCount: 0,
        clientsCreatedCount: 0,
        invoicesCreatedCount: 0,
        duplicatesSkippedCount: 2,
      });

      expect(rowsOf(db, income)).toHaveLength(1);
      expect(rowsOf(db, expenses)).toHaveLength(1);
      expect(rowsOf(db, clients)).toHaveLength(1);
      expect(rowsOf(db, invoices)).toHaveLength(1);
    });

    it('deduplicates repeated ids inside a single batch', async () => {
      const { engine, db } = await buildHarness();
      const batch = upworkBatch();

      const summary = await engine.apply(USER_ID, [...batch, ...batch]);

      expect(summary.duplicatesSkippedCount).toBe(2);
      expect(rowsOf(db, income)).toHaveLength(1);
    });

    it('reuses an existing client regardless of letter case', async () => {
      const { engine, db, rows } = await buildHarness();
      rows.set(clients, [{ id: 'existing-client', userId: USER_ID, name: '  cloudscale SYSTEMS ' }]);

      const summary = await engine.apply(USER_ID, upworkBatch());

      expect(summary.clientsCreatedCount).toBe(0);
      expect(rowsOf(db, clients)).toHaveLength(0);
      expect(rowsOf(db, income)[0].clientId).toBe('existing-client');
    });

    it('keeps two same-day, same-amount transactions when their ids differ', async () => {
      const { engine, db } = await buildHarness();
      const [first] = upworkBatch();

      await engine.apply(USER_ID, [first, { ...first, externalId: 'REC-1009', invoiceRef: 'REC-1009' }]);

      expect(rowsOf(db, income)).toHaveLength(2);
    });

    it('maps a platform outside the client_platform enum onto "other"', async () => {
      const { engine, db } = await buildHarness();

      await engine.apply(USER_ID, [{ ...upworkBatch()[0], platform: 'toptal' }]);

      expect(rowsOf(db, income)[0].platform).toBe('other');
      expect(rowsOf(db, clients)[0].platform).toBe('other');
    });

    it('falls back to a safe expense category for an unknown one', async () => {
      const { engine, db } = await buildHarness();

      await engine.apply(USER_ID, [{ ...upworkBatch()[1], category: 'not-a-real-category' }]);

      expect(rowsOf(db, expenses)[0].category).toBe('other');
    });

    it('previews without writing anything', async () => {
      const { engine, db } = await buildHarness();

      const preview = await engine.preview(USER_ID, upworkBatch());

      expect(db._inserted).toHaveLength(0);
      expect(preview).toMatchObject({
        platform: 'upwork',
        transactionCount: 2,
        incomeCount: 1,
        expenseCount: 1,
        duplicateCount: 0,
        grossAmountPKR: 518000,
        feesAmountPKR: 51800,
        netAmountPKR: 466200,
        newInvoiceCount: 1,
      });
      expect(preview.newClients).toEqual(['CloudScale Systems']);
      expect(preview.existingClients).toEqual([]);
      expect(preview.currencyTotals).toEqual([{ currency: 'USD', gross: 1850, fees: 185, net: 1665 }]);
      expect(preview.items).toHaveLength(2);
    });

    it('flags already-imported rows in a preview and excludes them from totals', async () => {
      const { engine } = await buildHarness();
      await engine.apply(USER_ID, upworkBatch());

      const preview = await engine.preview(USER_ID, upworkBatch());

      expect(preview.duplicateCount).toBe(2);
      expect(preview.incomeCount).toBe(0);
      expect(preview.grossAmountPKR).toBe(0);
      expect(preview.items.every((item) => item.isDuplicate)).toBe(true);
      expect(preview.warnings.join(' ')).toMatch(/already/i);
    });
  });

  describe('Synchronization', () => {
    it('records a successful run and advances the incremental cursor', async () => {
      const { sync, upwork, db } = await buildHarness([connectionRow()]);
      jest.spyOn(upwork, 'fetchTransactions').mockResolvedValue(upworkBatch());

      const summary = await sync.runSync(USER_ID, CONNECTION_ID, 'manual');

      expect(summary.incomeCreatedCount).toBe(1);

      const [log] = rowsOf(db, platformSyncLogs);
      expect(log).toMatchObject({ status: 'success', syncType: 'manual', fetchedCount: 2, failedCount: 0 });

      const final = db._updated.at(-1).values;
      expect(final).toMatchObject({ status: 'connected', syncStatus: 'success', lastSyncError: null });
      expect(final.lastSuccessfulSyncAt).toBeInstanceOf(Date);
    });

    it('asks the connector only for activity since the last success', async () => {
      const lastSuccess = new Date('2026-08-01T00:00:00Z');
      const { sync, upwork } = await buildHarness([connectionRow({ lastSuccessfulSyncAt: lastSuccess })]);
      const fetch = jest.spyOn(upwork, 'fetchTransactions').mockResolvedValue([]);

      await sync.runSync(USER_ID, CONNECTION_ID, 'scheduled');

      const { since } = fetch.mock.calls[0][0];
      expect(since).toBeInstanceOf(Date);
      // A deliberate overlap re-reads the last day in case a row was back-dated.
      expect(since!.getTime()).toBeLessThan(lastSuccess.getTime());
      expect(lastSuccess.getTime() - since!.getTime()).toBe(24 * 60 * 60 * 1000);
    });

    it('requests full history on a first sync', async () => {
      const { sync, upwork } = await buildHarness([connectionRow()]);
      const fetch = jest.spyOn(upwork, 'fetchTransactions').mockResolvedValue([]);

      await sync.runSync(USER_ID, CONNECTION_ID);

      expect(fetch.mock.calls[0][0].since).toBeUndefined();
    });

    it('refreshes an expired access token and re-encrypts the result', async () => {
      const { sync, upwork, db } = await buildHarness([
        connectionRow({ tokenExpiresAt: new Date(Date.now() - 60_000) }),
      ]);
      jest.spyOn(upwork, 'refreshTokens').mockResolvedValue({
        accessToken: 'rotated-access',
        refreshToken: 'rotated-refresh',
        expiresAt: new Date(Date.now() + 3600_000),
      });
      const fetch = jest.spyOn(upwork, 'fetchTransactions').mockResolvedValue([]);

      await sync.runSync(USER_ID, CONNECTION_ID);

      expect(fetch.mock.calls[0][0].accessToken).toBe('rotated-access');

      const stored = db._updated.find((u: { values: Record<string, unknown> }) => u.values.encryptedAccessToken);
      expect(stored.values.encryptedAccessToken).not.toBe('rotated-access');
      expect(decryptToken(stored.values.encryptedAccessToken as string)).toBe('rotated-access');
      expect(decryptToken(stored.values.encryptedRefreshToken as string)).toBe('rotated-refresh');
    });

    it('keeps the existing refresh token when the platform does not rotate it', async () => {
      const { sync, upwork, db } = await buildHarness([
        connectionRow({ tokenExpiresAt: new Date(Date.now() - 60_000) }),
      ]);
      jest.spyOn(upwork, 'refreshTokens').mockResolvedValue({ accessToken: 'rotated-access' });
      jest.spyOn(upwork, 'fetchTransactions').mockResolvedValue([]);

      await sync.runSync(USER_ID, CONNECTION_ID);

      const stored = db._updated.find((u: { values: Record<string, unknown> }) => u.values.encryptedRefreshToken);
      expect(decryptToken(stored.values.encryptedRefreshToken as string)).toBe('live-refresh-token');
    });

    it('marks the connection expired and asks for a reconnect when refresh fails', async () => {
      const { sync, upwork, db } = await buildHarness([
        connectionRow({ tokenExpiresAt: new Date(Date.now() - 60_000) }),
      ]);
      jest.spyOn(upwork, 'refreshTokens').mockRejectedValue(new Error('invalid_grant'));

      await expect(sync.runSync(USER_ID, CONNECTION_ID)).rejects.toThrow(/[Rr]econnect/);

      expect(db._updated.some((u: { values: Record<string, unknown> }) => u.values.status === 'expired')).toBe(true);
      const [log] = rowsOf(db, platformSyncLogs);
      expect(log.status).toBe('failed');
    });

    it('needs a reconnect when there is no refresh token at all', async () => {
      const { sync } = await buildHarness([
        connectionRow({ encryptedRefreshToken: null, tokenExpiresAt: new Date(Date.now() - 60_000) }),
      ]);

      await expect(sync.runSync(USER_ID, CONNECTION_ID)).rejects.toThrow(/[Rr]econnect/);
    });

    it('records a failed run without corrupting the cursor', async () => {
      const lastSuccess = new Date('2026-08-01T00:00:00Z');
      const { sync, upwork, db } = await buildHarness([connectionRow({ lastSuccessfulSyncAt: lastSuccess })]);
      jest.spyOn(upwork, 'fetchTransactions').mockRejectedValue(new Error('Upwork API request failed with status 500.'));

      await expect(sync.runSync(USER_ID, CONNECTION_ID)).rejects.toThrow(/status 500/);

      const [log] = rowsOf(db, platformSyncLogs);
      expect(log).toMatchObject({ status: 'failed', failedCount: 1 });
      expect(log.errorMessage).toMatch(/status 500/);

      const final = db._updated.at(-1).values;
      expect(final).toMatchObject({ status: 'error', syncStatus: 'failed', failedTransactionsCount: 1 });
      // A failure must not advance the cursor, or the missed window is lost forever.
      expect(final).not.toHaveProperty('lastSuccessfulSyncAt');
    });

    it('rejects a connection belonging to another user', async () => {
      const { sync } = await buildHarness([connectionRow()]);

      await expect(sync.runSync('someone-else', CONNECTION_ID)).rejects.toThrow(/not found/i);
    });

    it('previews a sync without writing', async () => {
      const { sync, upwork, db } = await buildHarness([connectionRow()]);
      jest.spyOn(upwork, 'fetchTransactions').mockResolvedValue(upworkBatch());

      const preview = await sync.previewSync(USER_ID, CONNECTION_ID);

      expect(preview.incomeCount).toBe(1);
      expect(db._inserted).toHaveLength(0);
    });
  });

  describe('Connection lifecycle', () => {
    it('stores encrypted credentials and runs a first sync on connect', async () => {
      const { service, upwork, db } = await buildHarness();
      jest.spyOn(upwork, 'exchangeAuthCode').mockResolvedValue({
        accessToken: 'fresh-access',
        refreshToken: 'fresh-refresh',
        expiresAt: new Date(Date.now() + 3600_000),
        accountIdentifier: 'ace-778',
        accountName: 'Acme Studio',
        metadata: { accountingEntityId: 'ace-778' },
      });
      jest.spyOn(upwork, 'fetchTransactions').mockResolvedValue(upworkBatch());

      const state = createOAuthState(USER_ID, 'upwork');
      const result = await service.completeAuthorization(USER_ID, 'upwork', 'auth-code', state, 'https://app.test/cb');

      const [stored] = rowsOf(db, platformConnections);
      expect(stored.encryptedAccessToken).not.toBe('fresh-access');
      expect(decryptToken(stored.encryptedAccessToken)).toBe('fresh-access');
      expect(result.syncResult?.incomeCreatedCount).toBe(1);
      expect(JSON.stringify(result.connection)).not.toContain('fresh-access');
    });

    it('rejects a callback whose state was not issued to this user', async () => {
      const { service, upwork } = await buildHarness();
      const exchange = jest.spyOn(upwork, 'exchangeAuthCode');

      await expect(
        service.completeAuthorization(USER_ID, 'upwork', 'code', createOAuthState('attacker', 'upwork'), 'https://app.test/cb'),
      ).rejects.toThrow(BadRequestException);

      expect(exchange).not.toHaveBeenCalled();
    });

    it('reconnects in place, preserving the connection row and its history', async () => {
      const { service, upwork, db } = await buildHarness([connectionRow({ status: 'expired' })]);
      jest.spyOn(upwork, 'exchangeAuthCode').mockResolvedValue({
        accessToken: 'reconnected-access',
        refreshToken: 'reconnected-refresh',
        accountIdentifier: 'ace-778',
        accountName: 'Acme Studio',
        metadata: { accountingEntityId: 'ace-778' },
      });
      jest.spyOn(upwork, 'fetchTransactions').mockResolvedValue([]);

      const state = createOAuthState(USER_ID, 'upwork');
      await service.completeAuthorization(USER_ID, 'upwork', 'code', state, 'https://app.test/cb');

      // Updated, not inserted — otherwise the incremental cursor would reset.
      expect(rowsOf(db, platformConnections)).toHaveLength(0);
      const reconnect = db._updated.find((u: { values: Record<string, unknown> }) => u.values.encryptedAccessToken);
      expect(reconnect.values.status).toBe('connected');
      expect(reconnect.values.lastSyncError).toBeNull();
    });

    it('keeps the connection when the first sync fails, and reports the error', async () => {
      const { service, upwork } = await buildHarness();
      jest.spyOn(upwork, 'exchangeAuthCode').mockResolvedValue({
        accessToken: 'fresh-access',
        accountIdentifier: 'ace-778',
        accountName: 'Acme Studio',
        metadata: { accountingEntityId: 'ace-778' },
      });
      jest.spyOn(upwork, 'fetchTransactions').mockRejectedValue(new Error('Upwork rate limit reached.'));

      const state = createOAuthState(USER_ID, 'upwork');
      const result = await service.completeAuthorization(USER_ID, 'upwork', 'code', state, 'https://app.test/cb');

      expect(result.syncResult).toBeNull();
      expect(result.syncError).toMatch(/rate limit/i);
      expect(result.connection.id).toBeDefined();
    });

    it('disconnects without deleting imported records', async () => {
      const { service, db } = await buildHarness([connectionRow()]);

      const result = await service.disconnect(USER_ID, CONNECTION_ID);

      expect(result.success).toBe(true);
      expect(result.message).toMatch(/stay in your ledger/i);
      expect(db._deleted.map((d: { table: unknown }) => d.table)).toEqual([platformConnections]);
    });
  });

  describe('Background synchronization', () => {
    it('syncs connections that are due and skips fresh ones', async () => {
      const stale = connectionRow({ lastSuccessfulSyncAt: new Date(Date.now() - 12 * 3600_000) });
      const fresh = connectionRow({
        id: '33333333-3333-3333-3333-333333333333',
        lastSuccessfulSyncAt: new Date(Date.now() - 60_000),
      });
      const { scheduler, sync } = await buildHarness([stale, fresh]);
      const run = jest.spyOn(sync, 'runSync').mockResolvedValue({
        success: true,
        fetchedCount: 0,
        incomeCreatedCount: 0,
        expensesCreatedCount: 0,
        clientsCreatedCount: 0,
        invoicesCreatedCount: 0,
        duplicatesSkippedCount: 0,
        failedCount: 0,
        syncedAt: new Date(),
      });

      const result = await scheduler.sweep();

      expect(result).toEqual({ attempted: 1, succeeded: 1 });
      expect(run).toHaveBeenCalledWith(USER_ID, CONNECTION_ID, 'scheduled');
    });

    it('never schedules a platform that cannot sync automatically', async () => {
      const { scheduler, sync } = await buildHarness([connectionRow({ platform: 'fiverr' })]);
      const run = jest.spyOn(sync, 'runSync');

      expect(await scheduler.sweep()).toEqual({ attempted: 0, succeeded: 0 });
      expect(run).not.toHaveBeenCalled();
    });

    it('carries on after one connection fails', async () => {
      const first = connectionRow();
      const second = connectionRow({ id: '44444444-4444-4444-4444-444444444444' });
      const { scheduler, sync } = await buildHarness([first, second]);
      jest
        .spyOn(sync, 'runSync')
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce({
          success: true,
          fetchedCount: 0,
          incomeCreatedCount: 0,
          expensesCreatedCount: 0,
          clientsCreatedCount: 0,
          invoicesCreatedCount: 0,
          duplicatesSkippedCount: 0,
          failedCount: 0,
          syncedAt: new Date(),
        });

      expect(await scheduler.sweep()).toEqual({ attempted: 2, succeeded: 1 });
    });
  });
});
