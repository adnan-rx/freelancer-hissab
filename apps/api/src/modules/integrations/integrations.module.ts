import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { ExchangeRateModule } from '../exchange-rate/exchange-rate.module';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { IntegrationsSyncService } from './integrations-sync.service';
import { IntegrationsSchedulerService } from './integrations-scheduler.service';
import { ImportEngineService } from './import-engine.service';
import { PlatformRegistryService } from './registry/platform-registry.service';
import { UpworkConnector } from './connectors/upwork.connector';
import { FiverrConnector } from './connectors/fiverr.connector';
import { FreelancerConnector } from './connectors/freelancer.connector';
import { ToptalConnector } from './connectors/toptal.connector';
import { GenericConnector } from './connectors/generic.connector';

@Module({
  imports: [DatabaseModule, ExchangeRateModule],
  controllers: [IntegrationsController],
  providers: [
    IntegrationsService,
    IntegrationsSyncService,
    IntegrationsSchedulerService,
    ImportEngineService,
    PlatformRegistryService,
    UpworkConnector,
    FiverrConnector,
    FreelancerConnector,
    ToptalConnector,
    GenericConnector,
  ],
  // CSV import shares the same normalization → dedup → persistence path.
  exports: [ImportEngineService, PlatformRegistryService],
})
export class IntegrationsModule {}
