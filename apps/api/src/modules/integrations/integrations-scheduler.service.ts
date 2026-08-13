import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { Database } from '../../database/types';
import { platformConnections } from '../../database/schema';
import { IntegrationsSyncService } from './integrations-sync.service';

const HOUR_MS = 60 * 60 * 1000;

/** How often the sweeper wakes up. */
const TICK_INTERVAL_MS = 15 * 60 * 1000;

/** A connection is due when its last successful sync is older than this. */
const SYNC_INTERVAL_MS = 6 * HOUR_MS;

/** Give the app time to finish booting before the first sweep. */
const STARTUP_DELAY_MS = 60 * 1000;

/**
 * Background synchronization.
 *
 * Sweeps every healthy connection on an auto-syncable platform and syncs the ones
 * that are due. Runs are sequential and failures are swallowed per connection —
 * one broken account must not stall everyone else's sync, and the failure is
 * already recorded on the connection for the user to see.
 *
 * ponytail: an in-process timer, so with more than one API instance every
 * instance sweeps. That is harmless — the import engine's external-id dedup
 * makes a double sync a no-op — but move to a locked job queue if the duplicated
 * outbound API calls start counting against platform rate limits.
 */
@Injectable()
export class IntegrationsSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IntegrationsSchedulerService.name);
  private timer: NodeJS.Timeout | null = null;
  private sweeping = false;

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly syncService: IntegrationsSyncService,
  ) {}

  onModuleInit(): void {
    if (process.env.INTEGRATIONS_BACKGROUND_SYNC === 'off') {
      this.logger.log('Background platform sync disabled by INTEGRATIONS_BACKGROUND_SYNC=off');
      return;
    }

    this.timer = setInterval(() => void this.sweep(), TICK_INTERVAL_MS);
    // Node keeps the process alive for pending timers; this one should not.
    this.timer.unref();
    setTimeout(() => void this.sweep(), STARTUP_DELAY_MS).unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Syncs every connection that is due. Exposed for tests and manual triggering. */
  async sweep(): Promise<{ attempted: number; succeeded: number }> {
    if (this.sweeping) return { attempted: 0, succeeded: 0 };
    this.sweeping = true;

    try {
      const connections = await this.db
        .select()
        .from(platformConnections)
        .where(eq(platformConnections.status, 'connected'));

      const due = connections.filter(
        (c) =>
          this.syncService.platformSupportsAutoSync(c.platform) &&
          (!c.lastSuccessfulSyncAt || Date.now() - c.lastSuccessfulSyncAt.getTime() >= SYNC_INTERVAL_MS),
      );

      let succeeded = 0;
      for (const connection of due) {
        try {
          await this.syncService.runSync(connection.userId, connection.id, 'scheduled');
          succeeded++;
        } catch (error) {
          this.logger.warn(
            `Scheduled sync failed for ${connection.platform} connection ${connection.id}: ${
              error instanceof Error ? error.message : error
            }`,
          );
        }
      }

      if (due.length > 0) {
        this.logger.log(`Background sync: ${succeeded}/${due.length} connections synced`);
      }
      return { attempted: due.length, succeeded };
    } catch (error) {
      this.logger.error('Background sync sweep failed', error);
      return { attempted: 0, succeeded: 0 };
    } finally {
      this.sweeping = false;
    }
  }
}
