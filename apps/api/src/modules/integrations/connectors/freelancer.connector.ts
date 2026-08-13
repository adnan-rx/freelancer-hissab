import { Injectable } from '@nestjs/common';
import { CsvOnlyConnector } from './csv-only.connector';
import { PlatformMetadata } from '../interfaces/platform-connector.interface';

@Injectable()
export class FreelancerConnector extends CsvOnlyConnector {
  readonly metadata: PlatformMetadata = {
    id: 'freelancer',
    name: 'Freelancer.com',
    authMechanism: 'csv_only',
    description:
      'Import your Freelancer.com transaction statement. Milestone releases and project commission fees are posted to your ledger.',
    documentationUrl: 'https://developers.freelancer.com',
    capabilities: {
      automaticSync: false,
      incrementalSync: false,
      feeExtraction: true,
      clientAttribution: true,
      webhooks: false,
      csvFallback: true,
    },
    limitationNotice:
      'Freelancer.com does have an official OAuth 2.0 API, but its documented surface (projects, bids, milestones, contests, users) exposes no transaction or earnings ledger — no net amounts and no commission fees. Deriving your accounts from milestone records alone would understate fees, so we import your statement instead. If Freelancer.com publishes a payments endpoint, this becomes an automatic sync with no change to your data.',
  };
}
