import { Module, Global } from '@nestjs/common';
import { db } from './db';

export const DRIZZLE = Symbol('DRIZZLE');

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE,
      useValue: db,
    },
  ],
  exports: [DRIZZLE],
})
export class DatabaseModule {}
