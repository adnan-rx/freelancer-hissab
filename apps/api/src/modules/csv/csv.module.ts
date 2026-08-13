import { Module } from '@nestjs/common';
import { CsvController } from './csv.controller';
import { CsvService } from './csv.service';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  // CSV parses and normalizes; IntegrationsModule supplies the shared import engine
  // that deduplicates and persists, so both import routes write identical records.
  imports: [IntegrationsModule],
  controllers: [CsvController],
  providers: [CsvService],
  exports: [CsvService],
})
export class CsvModule {}
