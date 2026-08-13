import {
  AuthMechanism,
  ConnectionStatus,
  NormalizedTransaction,
  PlatformId,
  SyncStatus,
  SyncType,
  TransactionMetadata,
} from './normalized-transaction.interface';

export type {
  AuthMechanism,
  ConnectionStatus,
  NormalizedTransaction,
  PlatformId,
  SyncStatus,
  SyncType,
  TransactionMetadata,
};

/**
 * What a platform's *official* API actually lets us do. These flags drive the UI,
 * so they must describe reality — a platform without a financial ledger endpoint
 * is never advertised as automatically syncable.
 */
export interface PlatformCapabilities {
  /** An official API exposes the account's financial ledger and we poll it. */
  automaticSync: boolean;
  /** The ledger endpoint accepts a date filter, so we can sync only what is new. */
  incrementalSync: boolean;
  /** Platform commissions arrive as distinct, attributable amounts. */
  feeExtraction: boolean;
  /** The counterparty is identifiable, so income can be attributed to a client. */
  clientAttribution: boolean;
  /** The platform can push change events to us. */
  webhooks: boolean;
  /** Statement import is offered for this platform. */
  csvFallback: boolean;
}

export interface PlatformMetadata {
  id: PlatformId;
  name: string;
  authMechanism: AuthMechanism;
  description: string;
  documentationUrl: string;
  capabilities: PlatformCapabilities;
  /**
   * Required whenever `capabilities.automaticSync` is false: the specific,
   * verifiable reason the platform cannot be synced automatically.
   */
  limitationNotice?: string;
}

export interface ConnectorAuthUrlResult {
  authUrl: string;
  state: string;
}

export interface ConnectorTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

export interface ConnectorAccount extends ConnectorTokens {
  /** Stable platform-side account id. */
  accountIdentifier: string;
  accountName: string;
  /** Non-secret detail the connector needs on later calls (e.g. Upwork's tenant id). */
  metadata?: TransactionMetadata;
}

export interface FetchTransactionsOptions {
  accessToken: string;
  /** Only fetch activity after this instant. Absent on a first sync. */
  since?: Date;
  metadata?: TransactionMetadata;
}

/**
 * A platform connector. OAuth-capable connectors implement every method;
 * CSV-only connectors implement `metadata` and throw a descriptive
 * `UnsupportedPlatformOperationError` from the rest.
 */
export interface PlatformConnector {
  readonly metadata: PlatformMetadata;
  getAuthUrl(state: string, redirectUri: string): Promise<ConnectorAuthUrlResult>;
  exchangeAuthCode(code: string, redirectUri: string): Promise<ConnectorAccount>;
  refreshTokens(refreshToken: string): Promise<ConnectorTokens>;
  fetchTransactions(options: FetchTransactionsOptions): Promise<NormalizedTransaction[]>;
}
