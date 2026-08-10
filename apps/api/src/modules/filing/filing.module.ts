import { Module } from '@nestjs/common';
import { FilingController } from './filing.controller';
import { FilingService } from './filing.service';
import { WealthModule } from '../wealth/wealth.module';

@Module({
  imports: [WealthModule],
  controllers: [FilingController],
  providers: [FilingService],
})
export class FilingModule {}
