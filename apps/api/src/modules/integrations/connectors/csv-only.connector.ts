import { BadRequestException } from '@nestjs/common';
import {
  ConnectorAccount,
  ConnectorAuthUrlResult,
  ConnectorTokens,
  PlatformConnector,
  PlatformMetadata,
} from '../interfaces/platform-connector.interface';
import { NormalizedTransaction } from '../interfaces/normalized-transaction.interface';

/**
 * Base for platforms with no official API exposing a freelancer's own earnings.
 *
 * Every OAuth operation fails loudly with the platform's specific limitation
 * rather than pretending to connect, and the UI routes the user to statement
 * import instead. We do not scrape.
 */
export abstract class CsvOnlyConnector implements PlatformConnector {
  abstract readonly metadata: PlatformMetadata;

  private unsupported(): never {
    throw new BadRequestException(
      this.metadata.limitationNotice ??
        `${this.metadata.name} does not expose an official API for your own earnings. Import a statement instead.`,
    );
  }

  async getAuthUrl(): Promise<ConnectorAuthUrlResult> {
    this.unsupported();
  }

  async exchangeAuthCode(): Promise<ConnectorAccount> {
    this.unsupported();
  }

  async refreshTokens(): Promise<ConnectorTokens> {
    this.unsupported();
  }

  async fetchTransactions(): Promise<NormalizedTransaction[]> {
    this.unsupported();
  }
}
