import { Injectable } from '@nestjs/common';
import { CsvOnlyConnector } from './csv-only.connector';
import { PlatformMetadata } from '../interfaces/platform-connector.interface';

@Injectable()
export class GenericConnector extends CsvOnlyConnector {
  readonly metadata: PlatformMetadata = {
    id: 'generic',
    name: 'Other platform or bank',
    authMechanism: 'csv_only',
    description:
      'Import a statement from any other marketplace, payment processor or bank. Columns are matched by name, so most exports work as-is.',
    documentationUrl: '',
    capabilities: {
      automaticSync: false,
      incrementalSync: false,
      feeExtraction: true,
      clientAttribution: true,
      webhooks: false,
      csvFallback: true,
    },
    limitationNotice:
      'This is the catch-all statement importer. There is no account to connect — upload a CSV with at least a date and an amount column.',
  };
}
