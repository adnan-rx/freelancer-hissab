import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import { users, income, expenses, invoices } from '../../database/schema';

@Injectable()
export class FilingService {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  async getReadinessScore(userId: string, year?: string) {
    const issues: any[] = [];
    
    // 1. Profile completeness
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user.psebId) {
      issues.push({ code: "MISSING_PROFILE_INFO", message: "PSEB ID is missing from your profile", count: 1, severity: "WARNING" });
    }

    // Filter by year if necessary
    let userIncome = await this.db.select().from(income).where(eq(income.userId, userId));
    let userExpenses = await this.db.select().from(expenses).where(eq(expenses.userId, userId));
    let userInvoices = await this.db.select().from(invoices).where(eq(invoices.userId, userId));
    
    // 2. Income without platforms/source
    let missingPlatformCount = 0;
    userIncome.forEach((inc: any) => {
      if (!inc.platform && !inc.clientId) missingPlatformCount++;
    });
    if (missingPlatformCount > 0) {
      issues.push({ code: "INCOME_UNMATCHED_PLATFORM", message: `${missingPlatformCount} income entries are missing a platform or client`, count: missingPlatformCount, severity: "WARNING" });
    }

    // 3. Expenses without category
    let missingCategoryCount = 0;
    userExpenses.forEach((exp: any) => {
      if (exp.category === 'other' || !exp.category) missingCategoryCount++;
    });
    if (missingCategoryCount > 0) {
      issues.push({ code: "EXPENSE_MISSING_CATEGORY", message: `${missingCategoryCount} expenses are missing a specific category`, count: missingCategoryCount, severity: "INFO" });
    }

    // 4. Invoices "Sent" for >90 days
    let overdueInvoices = 0;
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    userInvoices.forEach((inv: any) => {
      if (inv.status === 'sent' && new Date(inv.createdAt) < ninetyDaysAgo) overdueInvoices++;
    });
    if (overdueInvoices > 0) {
      issues.push({ code: "OVERDUE_INVOICES", message: `${overdueInvoices} invoices have been Sent for >90 days without update`, count: overdueInvoices, severity: "WARNING" });
    }

    // 5. Exchange rate fallback
    let fallbackRateCount = 0;
    userIncome.forEach((inc: any) => {
      if (inc.currency !== 'PKR' && (Number(inc.exchangeRate) === 1 || Number(inc.exchangeRate) === 280)) fallbackRateCount++;
    });
    if (fallbackRateCount > 0) {
      issues.push({ code: "MISSING_EXCHANGE_RATE", message: `${fallbackRateCount} income entries might be using a fallback exchange rate`, count: fallbackRateCount, severity: "WARNING" });
    }

    // 6. Deep Audit: Missing SBP / PRC for Exports
    let missingExportDocsCount = 0;
    userIncome.forEach((inc: any) => {
      if (inc.currency !== 'PKR' && (!inc.sbpPurposeCode || !inc.prcReferenceNumber)) {
        missingExportDocsCount++;
      }
    });
    if (missingExportDocsCount > 0) {
      issues.push({ code: "MISSING_PRC_SBP", message: `${missingExportDocsCount} export income entries are missing PRC references or SBP purpose codes`, count: missingExportDocsCount, severity: "WARNING" });
    }

    // 7. Deep Audit: Invoices marked Paid but missing Income records
    let paidInvoicesWithoutIncome = 0;
    userInvoices.forEach((inv: any) => {
      if (inv.status === 'paid') {
        const hasIncome = userIncome.some((inc: any) => inc.invoiceId === inv.id);
        if (!hasIncome) paidInvoicesWithoutIncome++;
      }
    });
    if (paidInvoicesWithoutIncome > 0) {
      issues.push({ code: "ORPHANED_PAID_INVOICE", message: `${paidInvoicesWithoutIncome} invoices are marked Paid but have no linked Income record`, count: paidInvoicesWithoutIncome, severity: "WARNING" });
    }

    // Calculate score
    const totalChecks = 7;
    let passedChecks = totalChecks;
    if (!user.psebId) passedChecks--;
    if (missingPlatformCount > 0) passedChecks--;
    if (missingCategoryCount > 0) passedChecks--;
    if (overdueInvoices > 0) passedChecks--;
    if (fallbackRateCount > 0) passedChecks--;
    if (missingExportDocsCount > 0) passedChecks--;
    if (paidInvoicesWithoutIncome > 0) passedChecks--;

    const score = Math.round((passedChecks / totalChecks) * 100);
    
    let status = "NOT_STARTED";
    if (score >= 100) status = "READY";
    else if (score >= 80) status = "ALMOST_READY";
    else if (score >= 40) status = "IN_PROGRESS";

    return {
      score,
      status,
      issues
    };
  }

  async getChecklist(userId: string, year?: string) {
    // 1. Profile completeness
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    const profileComplete = !!user.psebId;

    // Filter by year if necessary
    let userIncome = await this.db.select().from(income).where(eq(income.userId, userId));
    let userExpenses = await this.db.select().from(expenses).where(eq(expenses.userId, userId));
    
    // 2. Income without platforms/source
    let missingPlatformCount = 0;
    userIncome.forEach((inc: any) => {
      if (!inc.platform && !inc.clientId) missingPlatformCount++;
    });
    const incomeReviewed = missingPlatformCount === 0;

    // 3. Expenses without category
    let missingCategoryCount = 0;
    userExpenses.forEach((exp: any) => {
      if (exp.category === 'other' || !exp.category) missingCategoryCount++;
    });
    const expensesReviewed = missingCategoryCount === 0;

    // Calculate score (reusing same logic roughly)
    const scoreResult = await this.getReadinessScore(userId, year);

    return {
      stages: [
        {
          name: "PREPARATION",
          items: [
            { label: "Profile completed", complete: profileComplete },
            { label: "Income reviewed", complete: incomeReviewed },
            { label: "Expenses reviewed", complete: expensesReviewed },
            { label: "Foreign income reviewed", complete: true }, // Simplified for v1
            { label: "Remittances reconciled", complete: false, blockedByFeature: "WEALTH_RECONCILIATION" },
            { label: "Assets entered", complete: false, blockedByFeature: "WEALTH_RECONCILIATION" },
            { label: "Tax calculated", complete: true },
            { label: "Supporting documents", complete: false, blockedByFeature: "EVIDENCE_VAULT" }
          ]
        }
      ],
      overallPercent: scoreResult.score,
      issues: scoreResult.issues
    };
  }
}
