import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PlatformConnector, PlatformMetadata } from '../interfaces/platform-connector.interface';
import { UpworkConnector } from '../connectors/upwork.connector';
import { FiverrConnector } from '../connectors/fiverr.connector';
import { FreelancerConnector } from '../connectors/freelancer.connector';
import { ToptalConnector } from '../connectors/toptal.connector';
import { GenericConnector } from '../connectors/generic.connector';

/**
 * The one place that knows which platforms exist. Adding a platform means adding
 * a connector and listing it here — nothing downstream changes.
 */
@Injectable()
export class PlatformRegistryService {
  private readonly connectors: ReadonlyMap<string, PlatformConnector>;

  constructor(
    upwork: UpworkConnector,
    fiverr: FiverrConnector,
    freelancer: FreelancerConnector,
    toptal: ToptalConnector,
    generic: GenericConnector,
  ) {
    this.connectors = new Map(
      [upwork, fiverr, freelancer, toptal, generic].map((c) => [c.metadata.id, c]),
    );
  }

  getConnector(platformId: string): PlatformConnector {
    const connector = this.connectors.get(platformId.trim().toLowerCase());
    if (!connector) {
      throw new NotFoundException(`'${platformId}' is not a supported platform.`);
    }
    return connector;
  }

  /**
   * Like `getConnector`, but refuses platforms that cannot be synced automatically
   * so a caller can never start an OAuth or sync flow against a CSV-only platform.
   */
  getSyncableConnector(platformId: string): PlatformConnector {
    const connector = this.getConnector(platformId);
    if (!connector.metadata.capabilities.automaticSync) {
      throw new BadRequestException(connector.metadata.limitationNotice);
    }
    return connector;
  }

  getAllPlatforms(): PlatformMetadata[] {
    return Array.from(this.connectors.values()).map((c) => c.metadata);
  }
}
