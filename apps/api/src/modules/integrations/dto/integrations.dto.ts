import { IsIn, IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';
import {
  ConnectionStatus,
  PlatformId,
  SyncLogStatus,
  SyncStatus,
  SyncType,
} from '../interfaces/normalized-transaction.interface';

export class OAuthCallbackDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  state!: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  redirectUri?: string;
}

export class AuthUrlQueryDto {
  @IsOptional()
  @IsUrl({ require_tld: false })
  redirectUri?: string;
}

export class SyncQueryDto {
  /** `preview` runs a dry run and writes nothing; `apply` performs the import. */
  @IsOptional()
  @IsIn(['preview', 'apply'])
  mode?: 'preview' | 'apply';
}

/**
 * The connection as the browser sees it. Tokens are absent by construction —
 * this type has no field that could hold one.
 */
export interface PublicPlatformConnection {
  id: string;
  platform: PlatformId;
  accountIdentifier: string;
  accountName: string;
  status: ConnectionStatus;
  syncStatus: SyncStatus;
  lastSyncAt: string | null;
  lastSuccessfulSyncAt: string | null;
  lastSyncError: string | null;
  syncedTransactionsCount: number;
  failedTransactionsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformSyncLogEntry {
  id: string;
  connectionId: string;
  platform: string;
  syncType: SyncType;
  status: SyncLogStatus;
  sinceTimestamp: string | null;
  fetchedCount: number;
  incomeCreatedCount: number;
  expensesCreatedCount: number;
  clientsCreatedCount: number;
  invoicesCreatedCount: number;
  duplicatesSkippedCount: number;
  failedCount: number;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
}
