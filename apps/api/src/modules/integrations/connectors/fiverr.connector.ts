import { Injectable } from '@nestjs/common';
import { CsvOnlyConnector } from './csv-only.connector';
import { PlatformMetadata } from '../interfaces/platform-connector.interface';

@Injectable()
export class FiverrConnector extends CsvOnlyConnector {
  readonly metadata: PlatformMetadata = {
    id: 'fiverr',
    name: 'Fiverr',
    authMechanism: 'csv_only',
    description:
      'Import your Fiverr earnings statement. Gross order value, Fiverr service fees and buyer details are read from the statement and posted to your ledger.',
    documentationUrl: 'https://www.fiverr.com/support/articles/360010451418-Withdrawing-Funds',
    capabilities: {
      automaticSync: false,
      incrementalSync: false,
      feeExtraction: true,
      clientAttribution: true,
      webhooks: false,
      csvFallback: true,
    },
    limitationNotice:
      'Fiverr publishes no public API for a seller’s own earnings — only an affiliate API for promoting gigs. Automatic sync is therefore impossible without scraping, which we do not do. Download your statement from Fiverr → Earnings → Reports and import it here.',
  };
}
