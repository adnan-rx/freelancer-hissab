import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ClientsModule } from './modules/clients/clients.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { IncomeModule } from './modules/income/income.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ReportsModule } from './modules/reports/reports.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    UsersModule,
    ClientsModule,
    InvoicesModule,
    IncomeModule,
    ExpensesModule,
    DashboardModule,
    ReportsModule,
  ],
})
export class AppModule {}
