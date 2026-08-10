import { Module } from '@nestjs/common';
import { WealthController } from './wealth.controller';
import { WealthService } from './wealth.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [WealthController],
  providers: [WealthService],
  exports: [WealthService],
})
export class WealthModule {}
