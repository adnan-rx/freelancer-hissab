import { Injectable } from '@nestjs/common';
import { CsvOnlyConnector } from './csv-only.connector';
import { PlatformMetadata } from '../interfaces/platform-connector.interface';

@Injectable()
export class ToptalConnector extends CsvOnlyConnector {
  readonly metadata: PlatformMetadata = {
    id: 'toptal',
    name: 'Toptal',
    authMechanism: 'csv_only',
    description: 'Import your Toptal payment report so engagements and fees land in your ledger.',
    documentationUrl: 'https://www.toptal.com',
    capabilities: {
      automaticSync: false,
      incrementalSync: false,
      feeExtraction: true,
      clientAttribution: true,
      webhooks: false,
      csvFallback: true,
    },
    limitationNotice:
      'Toptal publishes no developer API of any kind — there is no OAuth flow and no endpoint for your engagements or payments. Export your payment report from the Toptal dashboard and import it here.',
  };
}
