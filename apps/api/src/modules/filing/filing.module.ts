import { Module } from '@nestjs/common';
import { FilingController } from './filing.controller';
import { FilingService } from './filing.service';

@Module({
  controllers: [FilingController],
  providers: [FilingService]
})
export class FilingModule {}
