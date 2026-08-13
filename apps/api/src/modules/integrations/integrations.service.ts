import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { Database } from '../../database/types';
import { platformConnections, platformSyncLogs } from '../../database/schema';
import { encryptToken } from '../../common/encryption';
import { PlatformRegistryService } from './registry/platform-registry.service';
import { IntegrationsSyncService } from './integrations-sync.service';
import { createOAuthState, verifyOAuthState } from './oauth-state';
import { PlatformSyncLogEntry, PublicPlatformConnection } from './dto/integrations.dto';
import {
  ConnectionStatus,
  ImportSummary,
  PlatformId,
  SyncLogStatus,
  SyncStatus,
  SyncType,
} from './interfaces/normalized-transaction.interface';
import { PlatformMetadata } from './interfaces/platform-connector.interface';

type ConnectionRow = typeof platformConnections.$inferSelect;
type SyncLogRow = typeof platformSyncLogs.$inferSelect;

/**
 * Connection lifecycle: connect, reconnect, disconnect, and read-only status.
 *
 * Every value that leaves this service passes through `toPublicConnection`, which
 * builds a fresh object from named fields — a token cannot be returned to the
 * browser even by accident.
 */
@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly registry: PlatformRegistryService,
    private readonly syncService: IntegrationsSyncService,
  ) {}

  /** Every supported platform with its real, verified capabilities. */
  getPlatforms(): PlatformMetadata[] {
    return this.registry.getAllPlatforms();
  }

  async getConnections(userId: string): Promise<PublicPlatformConnection[]> {
    const rows = await this.db
      .select()
      .from(platformConnections)
      .where(eq(platformConnections.userId, userId))
      .orderBy(desc(platformConnections.createdAt));

    return rows.map((row) => this.toPublicConnection(row));
  }

  /**
   * Starts an authorization. Used for both first connection and reconnect —
   * reconnecting is just authorizing again, which updates the existing row and
   * preserves its sync cursor.
   */
  async getAuthUrl(userId: string, platform: string, redirectUri: string): Promise<{ authUrl: string; state: string }> {
    const connector = this.registry.getSyncableConnector(platform);
    const state = createOAuthState(userId, connector.metadata.id);
    const result = await connector.getAuthUrl(state, redirectUri);
    return { authUrl: result.authUrl, state: result.state };
  }

  /**
   * Completes an authorization: exchanges the code, stores the credentials
   * encrypted, and runs a first sync.
   */
  async completeAuthorization(
    userId: string,
    platform: string,
    code: string,
    state: string,
    redirectUri: string,
  ): Promise<{ connection: PublicPlatformConnection; syncResult: ImportSummary | null; syncError: string | null }> {
    const connector = this.registry.getSyncableConnector(platform);
    verifyOAuthState(state, userId, connector.metadata.id);

    const account = await connector.exchangeAuthCode(code, redirectUri);

    const credentials = {
      accountIdentifier: account.accountIdentifier,
      accountName: account.accountName,
      encryptedAccessToken: encryptToken(account.accessToken),
      encryptedRefreshToken: account.refreshToken ? encryptToken(account.refreshToken) : null,
      tokenExpiresAt: account.expiresAt ?? null,
      status: 'connected' as const,
      syncStatus: 'idle' as const,
      lastSyncError: null,
      metadata: account.metadata ? JSON.stringify(account.metadata) : null,
    };

    // One connection per platform per user: reconnecting updates in place so the
    // incremental cursor and sync history survive.
    const [existing] = await this.db
      .select()
      .from(platformConnections)
      .where(
        and(eq(platformConnections.userId, userId), eq(platformConnections.platform, connector.metadata.id)),
      )
      .limit(1);

    let connectionId: string;
    if (existing) {
      connectionId = existing.id;
      await this.db
        .update(platformConnections)
        .set({ ...credentials, updatedAt: new Date() })
        .where(eq(platformConnections.id, connectionId));
    } else {
      const [created] = await this.db
        .insert(platformConnections)
        .values({ userId, platform: connector.metadata.id, ...credentials })
        .returning({ id: platformConnections.id });
      connectionId = created.id;
    }

    // A failed first sync must not undo a valid connection — the account stays
    // connected and the error surfaces on the card for a retry.
    let syncResult: ImportSummary | null = null;
    let syncError: string | null = null;
    try {
      syncResult = await this.syncService.runSync(userId, connectionId, existing ? 'manual' : 'initial');
    } catch (error) {
      syncError = error instanceof Error ? error.message : 'Initial synchronization failed.';
      this.logger.warn(`Initial ${connector.metadata.id} sync failed for connection ${connectionId}: ${syncError}`);
    }

    const [row] = await this.db
      .select()
      .from(platformConnections)
      .where(eq(platformConnections.id, connectionId))
      .limit(1);

    return { connection: this.toPublicConnection(row), syncResult, syncError };
  }

  /**
   * Removes the connection and its stored credentials. Imported clients,
   * invoices, income and expenses are deliberately kept — they are the user's
   * accounting records, not the integration's.
   */
  async disconnect(userId: string, connectionId: string): Promise<{ success: boolean; message: string }> {
    const [deleted] = await this.db
      .delete(platformConnections)
      .where(and(eq(platformConnections.id, connectionId), eq(platformConnections.userId, userId)))
      .returning({ accountName: platformConnections.accountName });

    if (!deleted) throw new NotFoundException('Connected account not found.');

    return {
      success: true,
      message: `Disconnected ${deleted.accountName}. Records already imported stay in your ledger.`,
    };
  }

  async getSyncLogs(userId: string, connectionId: string, limit = 25): Promise<PlatformSyncLogEntry[]> {
    const rows = await this.db
      .select()
      .from(platformSyncLogs)
      .where(and(eq(platformSyncLogs.connectionId, connectionId), eq(platformSyncLogs.userId, userId)))
      .orderBy(desc(platformSyncLogs.startedAt))
      .limit(limit);

    return rows.map((row) => this.toLogEntry(row));
  }

  // -------------------------------------------------------------------------
  // Serialization
  // -------------------------------------------------------------------------

  private toPublicConnection(row: ConnectionRow): PublicPlatformConnection {
    return {
      id: row.id,
      platform: row.platform as PlatformId,
      accountIdentifier: row.accountIdentifier,
      accountName: row.accountName,
      status: row.status as ConnectionStatus,
      syncStatus: row.syncStatus as SyncStatus,
      lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
      lastSuccessfulSyncAt: row.lastSuccessfulSyncAt?.toISOString() ?? null,
      lastSyncError: row.lastSyncError,
      syncedTransactionsCount: row.syncedTransactionsCount,
      failedTransactionsCount: row.failedTransactionsCount,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toLogEntry(row: SyncLogRow): PlatformSyncLogEntry {
    return {
      id: row.id,
      connectionId: row.connectionId,
      platform: row.platform,
      syncType: row.syncType as SyncType,
      status: row.status as SyncLogStatus,
      sinceTimestamp: row.sinceTimestamp?.toISOString() ?? null,
      fetchedCount: row.fetchedCount,
      incomeCreatedCount: row.incomeCreatedCount,
      expensesCreatedCount: row.expensesCreatedCount,
      clientsCreatedCount: row.clientsCreatedCount,
      invoicesCreatedCount: row.invoicesCreatedCount,
      duplicatesSkippedCount: row.duplicatesSkippedCount,
      failedCount: row.failedCount,
      errorMessage: row.errorMessage,
      startedAt: row.startedAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
    };
  }
}
