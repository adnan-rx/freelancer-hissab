import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  ConnectorAccount,
  ConnectorAuthUrlResult,
  ConnectorTokens,
  FetchTransactionsOptions,
  PlatformConnector,
  PlatformMetadata,
} from '../interfaces/platform-connector.interface';
import { NormalizedTransaction, TransactionMetadata } from '../interfaces/normalized-transaction.interface';

/**
 * Endpoints and the GraphQL schema below are taken from Upwork's own published
 * Power BI connector (github.com/upwork/powerbi-connector) and the GraphQL API
 * docs. Note the token endpoint lives on www.upwork.com, not api.upwork.com.
 */
const AUTHORIZE_URL = 'https://www.upwork.com/ab/account-security/oauth2/authorize';
const TOKEN_URL = 'https://www.upwork.com/api/v3/oauth2/token';
const GRAPHQL_URL = 'https://api.upwork.com/graphql';

/** Upwork's own connector defaults to a 1s gap between calls; we honour the same. */
const REQUEST_SPACING_MS = 1000;

/** Access tokens are short-lived; refresh a little early to avoid a racing 401. */
const TOKEN_EXPIRY_SAFETY_MS = 60_000;

/** Upwork rejects unbounded history; its own connector uses this floor. */
const EARLIEST_SUPPORTED_DATE = '2010-01-01';

const ACCOUNTING_ENTITY_QUERY = `query AccountingEntity { accountingEntity { id } }`;

const ORGANIZATION_QUERY = `query Organization { organization { id name } }`;

/**
 * `transactionHistory` is the freelancer-facing financial ledger. `aceIds_any`
 * scopes it to the accounting entity and `transactionDateTime_bt` bounds the
 * range, which is what makes incremental sync possible.
 */
const TRANSACTION_HISTORY_QUERY = `
  query TransactionHistory($filter: TransactionHistoryFilter!) {
    transactionHistory(transactionHistoryFilter: $filter) {
      transactionDetail {
        transactionHistoryRow {
          recordId
          accountingSubtype
          transactionCreationDate
          relatedTransactionId
          fullyPaidDate
          transactionAmount { rawValue currency }
          type
          relatedAssignment
          assignmentDeveloperName
          assignmentCompanyName
          assignmentTeamUserId
        }
      }
    }
  }
`;

interface UpworkTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface UpworkGraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

interface UpworkTransactionRow {
  recordId?: string | null;
  accountingSubtype?: string | null;
  transactionCreationDate?: string | null;
  relatedTransactionId?: string | null;
  fullyPaidDate?: string | null;
  transactionAmount?: { rawValue?: string | number | null; currency?: string | null } | null;
  type?: string | null;
  relatedAssignment?: string | null;
  assignmentDeveloperName?: string | null;
  assignmentCompanyName?: string | null;
  assignmentTeamUserId?: string | null;
}

interface TransactionHistoryData {
  transactionHistory?: {
    transactionDetail?: { transactionHistoryRow?: UpworkTransactionRow[] | null } | null;
  } | null;
}

/**
 * Accounting subtypes that represent money leaving the freelancer's account as a
 * marketplace charge. Everything else with a negative amount is a withdrawal or
 * an internal transfer and is deliberately not booked as an expense.
 */
const FEE_SUBTYPE_PATTERNS = ['fee', 'commission', 'membership', 'connects', 'refund_processing'];

/** Money movements that are neither revenue nor cost — a transfer to the user's own bank. */
const TRANSFER_SUBTYPE_PATTERNS = ['withdrawal', 'transfer', 'payout'];

@Injectable()
export class UpworkConnector implements PlatformConnector {
  private readonly logger = new Logger(UpworkConnector.name);
  private lastRequestAt = 0;

  readonly metadata: PlatformMetadata = {
    id: 'upwork',
    name: 'Upwork',
    authMechanism: 'oauth2',
    description:
      'Official Upwork OAuth 2.0 + GraphQL integration. Syncs your transaction history, including Upwork service fees, straight into your ledger.',
    documentationUrl: 'https://www.upwork.com/developer/documentation/graphql/api/docs/index.html',
    capabilities: {
      automaticSync: true,
      incrementalSync: true,
      feeExtraction: true,
      clientAttribution: true,
      // Upwork offers webhook subscriptions, but not for financial ledger events,
      // so sync remains poll-based.
      webhooks: false,
      csvFallback: true,
    },
  };

  private get clientId(): string | undefined {
    return process.env.UPWORK_CLIENT_ID;
  }

  private get clientSecret(): string | undefined {
    return process.env.UPWORK_CLIENT_SECRET;
  }

  private requireCredentials(): { clientId: string; clientSecret: string } {
    if (!this.clientId || !this.clientSecret) {
      throw new ServiceUnavailableException(
        'Upwork integration is not configured on this server. Set UPWORK_CLIENT_ID and UPWORK_CLIENT_SECRET, then try again.',
      );
    }
    return { clientId: this.clientId, clientSecret: this.clientSecret };
  }

  async getAuthUrl(state: string, redirectUri: string): Promise<ConnectorAuthUrlResult> {
    const { clientId } = this.requireCredentials();

    // Upwork grants scopes against the registered API key rather than per
    // authorization request, so no `scope` parameter is sent.
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
    });

    return { authUrl: `${AUTHORIZE_URL}?${params.toString()}`, state };
  }

  async exchangeAuthCode(code: string, redirectUri: string): Promise<ConnectorAccount> {
    const tokens = await this.requestToken({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    });

    // The accounting entity id is required by every transactionHistory call, and
    // the organization gives us a human-readable account label.
    const entity = await this.graphql<{ accountingEntity?: { id?: string } }>(
      tokens.accessToken,
      ACCOUNTING_ENTITY_QUERY,
    );
    const accountingEntityId = entity.accountingEntity?.id;
    if (!accountingEntityId) {
      throw new BadRequestException(
        'Upwork did not return an accounting entity for this account. Make sure the authorized user can view financial reports.',
      );
    }

    let accountName = 'Upwork account';
    let organizationId: string | undefined;
    try {
      const org = await this.graphql<{ organization?: { id?: string; name?: string } }>(
        tokens.accessToken,
        ORGANIZATION_QUERY,
      );
      accountName = org.organization?.name ?? accountName;
      organizationId = org.organization?.id;
    } catch (error) {
      // Non-fatal: the label is cosmetic, the entity id is what sync needs.
      this.logger.warn(`Could not read Upwork organization name: ${this.errorText(error)}`);
    }

    const metadata: TransactionMetadata = { accountingEntityId };
    if (organizationId) metadata.organizationId = organizationId;

    return {
      ...tokens,
      accountIdentifier: accountingEntityId,
      accountName,
      metadata,
    };
  }

  async refreshTokens(refreshToken: string): Promise<ConnectorTokens> {
    return this.requestToken({ grant_type: 'refresh_token', refresh_token: refreshToken });
  }

  async fetchTransactions(options: FetchTransactionsOptions): Promise<NormalizedTransaction[]> {
    const accountingEntityId = options.metadata?.accountingEntityId;
    if (typeof accountingEntityId !== 'string' || accountingEntityId.length === 0) {
      throw new BadRequestException(
        'This Upwork connection is missing its accounting entity. Reconnect the account to repair it.',
      );
    }

    const filter = {
      aceIds_any: [accountingEntityId],
      transactionDateTime_bt: {
        rangeStart: options.since ? this.dateOnly(options.since) : EARLIEST_SUPPORTED_DATE,
        rangeEnd: this.dateOnly(new Date()),
      },
    };

    const payload = await this.graphql<TransactionHistoryData>(
      options.accessToken,
      TRANSACTION_HISTORY_QUERY,
      { filter },
      typeof options.metadata?.organizationId === 'string' ? options.metadata.organizationId : undefined,
    );

    const rows = payload.transactionHistory?.transactionDetail?.transactionHistoryRow ?? [];
    return rows
      .map((row) => this.normalize(row))
      .filter((tx): tx is NormalizedTransaction => tx !== null);
  }

  // -------------------------------------------------------------------------
  // Normalization
  // -------------------------------------------------------------------------

  /**
   * Maps one Upwork ledger row onto the internal model. Returns null for rows
   * that are not accounting events for us — withdrawals to a bank account, and
   * anything without an id, date or amount.
   */
  private normalize(row: UpworkTransactionRow): NormalizedTransaction | null {
    const externalId = row.recordId?.trim();
    const dateText = row.transactionCreationDate ?? row.fullyPaidDate;
    if (!externalId || !dateText) return null;

    const occurredAt = new Date(dateText);
    if (Number.isNaN(occurredAt.getTime())) return null;

    const rawValue = row.transactionAmount?.rawValue;
    const amount = typeof rawValue === 'number' ? rawValue : parseFloat(String(rawValue ?? ''));
    if (!Number.isFinite(amount) || amount === 0) return null;

    const subtype = (row.accountingSubtype ?? row.type ?? '').toLowerCase();
    if (TRANSFER_SUBTYPE_PATTERNS.some((p) => subtype.includes(p))) return null;

    const isFee = amount < 0 || FEE_SUBTYPE_PATTERNS.some((p) => subtype.includes(p));
    const currency = (row.transactionAmount?.currency ?? 'USD').toUpperCase();
    const description =
      row.relatedAssignment?.trim() ||
      row.accountingSubtype?.trim() ||
      (isFee ? 'Upwork service fee' : 'Upwork earning');

    const metadata: TransactionMetadata = {
      accountingSubtype: row.accountingSubtype ?? null,
      relatedTransactionId: row.relatedTransactionId ?? null,
      assignmentTeamUserId: row.assignmentTeamUserId ?? null,
    };

    if (isFee) {
      return {
        externalId,
        platform: 'upwork',
        type: 'expense',
        occurredAt,
        amount: Math.abs(amount),
        currency,
        description: `Upwork fee — ${description}`,
        vendor: 'Upwork',
        category: 'other',
        metadata,
      };
    }

    const clientName = row.assignmentCompanyName?.trim() || row.assignmentDeveloperName?.trim();

    return {
      externalId,
      platform: 'upwork',
      type: 'income',
      occurredAt,
      amount,
      currency,
      description,
      client: clientName ? { name: clientName, company: row.assignmentCompanyName?.trim() } : undefined,
      invoiceRef: externalId,
      invoiceStatus: 'paid',
      category: 'freelance_service',
      metadata,
    };
  }

  // -------------------------------------------------------------------------
  // Transport
  // -------------------------------------------------------------------------

  private async requestToken(grantFields: Record<string, string>): Promise<ConnectorTokens> {
    const { clientId, clientSecret } = this.requireCredentials();

    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...grantFields }).toString(),
    });

    const body = (await response.json().catch(() => null)) as UpworkTokenResponse | null;

    if (!response.ok || !body?.access_token) {
      const reason = body?.error_description ?? body?.error ?? `HTTP ${response.status}`;
      this.logger.error(`Upwork token request failed: ${reason}`);
      throw new BadRequestException(`Upwork rejected the authorization: ${reason}`);
    }

    return {
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      expiresAt: body.expires_in
        ? new Date(Date.now() + body.expires_in * 1000 - TOKEN_EXPIRY_SAFETY_MS)
        : undefined,
    };
  }

  private async graphql<T>(
    accessToken: string,
    query: string,
    variables?: Record<string, unknown>,
    tenantId?: string,
  ): Promise<T> {
    await this.throttle();

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (tenantId) headers['X-Upwork-API-TenantId'] = tenantId;

    const response = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    });

    if (response.status === 401 || response.status === 403) {
      throw new BadRequestException('Upwork rejected the stored credentials. Reconnect the account.');
    }
    if (response.status === 429) {
      throw new ServiceUnavailableException('Upwork rate limit reached. Try syncing again in a few minutes.');
    }
    if (!response.ok) {
      throw new ServiceUnavailableException(`Upwork API request failed with status ${response.status}.`);
    }

    const payload = (await response.json()) as UpworkGraphQLResponse<T>;
    if (payload.errors?.length) {
      throw new ServiceUnavailableException(`Upwork API error: ${payload.errors[0].message}`);
    }
    if (!payload.data) {
      throw new ServiceUnavailableException('Upwork API returned no data.');
    }

    return payload.data;
  }

  /** Keeps at least REQUEST_SPACING_MS between calls, mirroring Upwork's own client. */
  private async throttle(): Promise<void> {
    const wait = this.lastRequestAt + REQUEST_SPACING_MS - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    this.lastRequestAt = Date.now();
  }

  private dateOnly(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private errorText(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
