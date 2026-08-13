import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { Database } from '../../database/types';
import { platformConnections, platformSyncLogs } from '../../database/schema';
import { decryptToken, encryptToken } from '../../common/encryption';
import { ImportEngineService } from './import-engine.service';
import { PlatformRegistryService } from './registry/platform-registry.service';
import {
  ImportPreview,
  ImportSummary,
  NormalizedTransaction,
  PlatformId,
  SyncType,
  TransactionMetadata,
} from './interfaces/normalized-transaction.interface';

/** Refresh a token that expires within this window rather than risk a mid-sync 401. */
const TOKEN_REFRESH_WINDOW_MS = 5 * 60_000;

/**
 * Re-fetch a little before the last successful sync. Platforms can back-date a
 * transaction after it settles, and dedup by external id makes the overlap free.
 */
const INCREMENTAL_OVERLAP_MS = 24 * 60 * 60 * 1000;

type ConnectionRow = typeof platformConnections.$inferSelect;

export class ReauthorizationRequiredError extends BadRequestException {
  constructor(accountName: string) {
    super(`Your ${accountName} authorization has expired. Reconnect the account to resume syncing.`);
  }
}

/**
 * Owns one sync run: refresh credentials, pull what is new, hand it to the import
 * engine, and record the outcome. It knows nothing about any platform's data
 * shape — connectors normalize before anything reaches here.
 */
@Injectable()
export class IntegrationsSyncService {
  private readonly logger = new Logger(IntegrationsSyncService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly registry: PlatformRegistryService,
    private readonly importEngine: ImportEngineService,
  ) {}

  /** Dry run: fetches from the platform and reports what an import would do. */
  async previewSync(userId: string, connectionId: string): Promise<ImportPreview> {
    const connection = await this.requireConnection(userId, connectionId);
    const transactions = await this.fetchIncremental(connection);
    return this.importEngine.preview(userId, transactions);
  }

  /**
   * Performs a sync. Safe to run repeatedly and concurrently with itself: the
   * import engine keys every record on the platform's own transaction id, so a
   * repeat run creates nothing.
   */
  async runSync(userId: string, connectionId: string, syncType: SyncType = 'manual'): Promise<ImportSummary> {
    const connection = await this.requireConnection(userId, connectionId);
    const startedAt = new Date();
    const since = this.sinceFor(connection);

    await this.db
      .update(platformConnections)
      .set({ syncStatus: 'syncing', updatedAt: new Date() })
      .where(eq(platformConnections.id, connection.id));

    try {
      const transactions = await this.fetchIncremental(connection);
      const summary = await this.importEngine.apply(userId, transactions);

      await this.recordOutcome(connection, syncType, startedAt, since, summary);
      return summary;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Synchronization failed';
      const credentialsRejected = error instanceof ReauthorizationRequiredError;
      await this.recordFailure(connection, syncType, startedAt, since, message, credentialsRejected);
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // Fetch
  // -------------------------------------------------------------------------

  private async fetchIncremental(connection: ConnectionRow): Promise<NormalizedTransaction[]> {
    const connector = this.registry.getSyncableConnector(connection.platform);
    const accessToken = await this.usableAccessToken(connection, connector);

    return connector.fetchTransactions({
      accessToken,
      since: this.sinceFor(connection),
      metadata: this.parseMetadata(connection.metadata),
    });
  }

  /**
   * Only the first sync pulls full history; later runs ask for everything since
   * the last success, minus a safety overlap.
   */
  private sinceFor(connection: ConnectionRow): Date | undefined {
    if (!connection.lastSuccessfulSyncAt) return undefined;
    return new Date(connection.lastSuccessfulSyncAt.getTime() - INCREMENTAL_OVERLAP_MS);
  }

  /**
   * Returns a token that is valid now, refreshing and re-encrypting it first if
   * it has expired or is about to. A refresh failure is terminal — the user must
   * reconnect — so the connection is flagged `expired` for the UI.
   */
  private async usableAccessToken(
    connection: ConnectionRow,
    connector: ReturnType<PlatformRegistryService['getConnector']>,
  ): Promise<string> {
    const accessToken = connection.encryptedAccessToken ? decryptToken(connection.encryptedAccessToken) : '';
    const expiresAt = connection.tokenExpiresAt?.getTime();
    const stillValid = !expiresAt || expiresAt - TOKEN_REFRESH_WINDOW_MS > Date.now();

    if (accessToken && stillValid) return accessToken;

    const refreshToken = connection.encryptedRefreshToken ? decryptToken(connection.encryptedRefreshToken) : '';
    if (!refreshToken) {
      await this.markExpired(connection);
      throw new ReauthorizationRequiredError(connection.accountName);
    }

    this.logger.log(`Refreshing ${connection.platform} token for connection ${connection.id}`);

    try {
      const refreshed = await connector.refreshTokens(refreshToken);

      await this.db
        .update(platformConnections)
        .set({
          encryptedAccessToken: encryptToken(refreshed.accessToken),
          // Providers that rotate refresh tokens send a new one; those that do
          // not expect the original to be reused.
          encryptedRefreshToken: encryptToken(refreshed.refreshToken ?? refreshToken),
          tokenExpiresAt: refreshed.expiresAt ?? null,
          status: 'connected',
          updatedAt: new Date(),
        })
        .where(eq(platformConnections.id, connection.id));

      return refreshed.accessToken;
    } catch (error) {
      this.logger.warn(
        `Token refresh failed for connection ${connection.id}: ${error instanceof Error ? error.message : error}`,
      );
      await this.markExpired(connection);
      throw new ReauthorizationRequiredError(connection.accountName);
    }
  }

  // -------------------------------------------------------------------------
  // Bookkeeping
  // -------------------------------------------------------------------------

  private async requireConnection(userId: string, connectionId: string): Promise<ConnectionRow> {
    const [connection] = await this.db
      .select()
      .from(platformConnections)
      .where(and(eq(platformConnections.id, connectionId), eq(platformConnections.userId, userId)))
      .limit(1);

    if (!connection) throw new NotFoundException('Connected account not found.');
    return connection;
  }

  private async markExpired(connection: ConnectionRow): Promise<void> {
    await this.db
      .update(platformConnections)
      .set({ status: 'expired', syncStatus: 'failed', updatedAt: new Date() })
      .where(eq(platformConnections.id, connection.id));
  }

  private async recordOutcome(
    connection: ConnectionRow,
    syncType: SyncType,
    startedAt: Date,
    since: Date | undefined,
    summary: ImportSummary,
  ): Promise<void> {
    const completedAt = new Date();

    await this.db.insert(platformSyncLogs).values({
      connectionId: connection.id,
      userId: connection.userId,
      platform: connection.platform,
      syncType,
      status: 'success',
      sinceTimestamp: since ?? null,
      fetchedCount: summary.fetchedCount,
      incomeCreatedCount: summary.incomeCreatedCount,
      expensesCreatedCount: summary.expensesCreatedCount,
      clientsCreatedCount: summary.clientsCreatedCount,
      invoicesCreatedCount: summary.invoicesCreatedCount,
      duplicatesSkippedCount: summary.duplicatesSkippedCount,
      failedCount: summary.failedCount,
      errorMessage: null,
      startedAt,
      completedAt,
    });

    await this.db
      .update(platformConnections)
      .set({
        status: 'connected',
        syncStatus: 'success',
        lastSyncError: null,
        lastSyncAt: completedAt,
        lastSuccessfulSyncAt: completedAt,
        syncedTransactionsCount:
          connection.syncedTransactionsCount + summary.incomeCreatedCount + summary.expensesCreatedCount,
        updatedAt: completedAt,
      })
      .where(eq(platformConnections.id, connection.id));
  }

  private async recordFailure(
    connection: ConnectionRow,
    syncType: SyncType,
    startedAt: Date,
    since: Date | undefined,
    errorMessage: string,
    credentialsRejected: boolean,
  ): Promise<void> {
    try {
      await this.db.insert(platformSyncLogs).values({
        connectionId: connection.id,
        userId: connection.userId,
        platform: connection.platform,
        syncType,
        status: 'failed',
        sinceTimestamp: since ?? null,
        failedCount: 1,
        errorMessage: errorMessage.slice(0, 1000),
        startedAt,
        completedAt: new Date(),
      });

      await this.db
        .update(platformConnections)
        .set({
          status: credentialsRejected ? 'expired' : 'error',
          syncStatus: 'failed',
          lastSyncError: errorMessage.slice(0, 1000),
          lastSyncAt: new Date(),
          failedTransactionsCount: connection.failedTransactionsCount + 1,
          updatedAt: new Date(),
        })
        .where(eq(platformConnections.id, connection.id));
    } catch (loggingError) {
      // Never let bookkeeping mask the original failure.
      this.logger.error('Could not persist sync failure', loggingError);
    }
  }

  private parseMetadata(raw: string | null): TransactionMetadata {
    if (!raw) return {};
    try {
      const parsed: unknown = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? (parsed as TransactionMetadata) : {};
    } catch {
      return {};
    }
  }

  /** Platforms whose connections the scheduler should poll. */
  platformSupportsAutoSync(platform: string): platform is PlatformId {
    try {
      return this.registry.getConnector(platform).metadata.capabilities.automaticSync;
    } catch {
      return false;
    }
  }
}
