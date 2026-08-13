import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ClientsModule } from './modules/clients/clients.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { IncomeModule } from './modules/income/income.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ReportsModule } from './modules/reports/reports.module';
import { CsvModule } from './modules/csv/csv.module';
import { TaxModule } from './modules/tax/tax.module';
import { ExchangeRateModule } from './modules/exchange-rate/exchange-rate.module';

import { TransactionsModule } from './modules/transactions/transactions.module';
import { FilingModule } from './modules/filing/filing.module';
import { EvidenceModule } from './modules/evidence/evidence.module';
import { WealthModule } from './modules/wealth/wealth.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    DatabaseModule,
    AuthModule,
    UsersModule,
    ClientsModule,
    InvoicesModule,
    IncomeModule,
    ExpensesModule,
    DashboardModule,
    ReportsModule,
    CsvModule,
    TaxModule,
    ExchangeRateModule,
    TransactionsModule,
    FilingModule,
    EvidenceModule,
    WealthModule,
    IntegrationsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
