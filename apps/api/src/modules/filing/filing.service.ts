import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import { users, income, expenses, invoices, evidenceDocuments } from '../../database/schema';
import { taxYearRange, incomeInTaxYear, expensesInTaxYear, isWithinTaxYear } from '../../common/tax-year';
import { WealthService } from '../wealth/wealth.service';

export interface ReadinessIssue {
  code: string;
  message: string;
  count: number;
  severity: 'INFO' | 'WARNING';
  /** Where the user should go to fix it. */
  fixPath: string;
  /** Ids of the offending records, so the UI can deep-link. */
  recordIds: string[];
}

@Injectable()
export class FilingService {
  constructor(
    @Inject(DRIZZLE) private readonly db: any,
    private readonly wealthService: WealthService,
  ) {}

  private async collect(userId: string, year?: string) {
    const range = taxYearRange(year);

    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    const allIncome = await this.db.select().from(income).where(eq(income.userId, userId));
    const allExpenses = await this.db.select().from(expenses).where(eq(expenses.userId, userId));
    const allInvoices = await this.db.select().from(invoices).where(eq(invoices.userId, userId));
    const allEvidence = await this.db
      .select()
      .from(evidenceDocuments)
      .where(eq(evidenceDocuments.userId, userId));

    return {
      range,
      user,
      userIncome: incomeInTaxYear(allIncome, range),
      userExpenses: expensesInTaxYear(allExpenses, range),
      userInvoices: allInvoices.filter((inv: any) => isWithinTaxYear(inv.createdAt, range)),
      evidence: allEvidence,
    };
  }

  async getReadinessScore(userId: string, year?: string) {
    const { range, user, userIncome, userExpenses, userInvoices, evidence } = await this.collect(userId, year);
    const issues: ReadinessIssue[] = [];

    const add = (
      code: string,
      message: string,
      severity: 'INFO' | 'WARNING',
      fixPath: string,
      recordIds: string[],
    ) => {
      issues.push({ code, message, count: recordIds.length || 1, severity, fixPath, recordIds });
    };

    // 1. Profile completeness
    const profileComplete = !!user?.psebId;
    if (!profileComplete) {
      add('MISSING_PROFILE_INFO', 'PSEB ID is missing from your profile', 'WARNING', '/settings', []);
    }

    // 2. Income without a platform or client
    const unmatchedIncome = userIncome.filter((inc: any) => !inc.platform && !inc.clientId);
    if (unmatchedIncome.length) {
      add(
        'INCOME_UNMATCHED_PLATFORM',
        `${unmatchedIncome.length} income entries are missing a platform or client`,
        'WARNING',
        '/income',
        unmatchedIncome.map((i: any) => i.id),
      );
    }

    // 3. Expenses left in the catch-all category
    const uncategorisedExpenses = userExpenses.filter((exp: any) => !exp.category || exp.category === 'other');
    if (uncategorisedExpenses.length) {
      add(
        'EXPENSE_MISSING_CATEGORY',
        `${uncategorisedExpenses.length} expenses are missing a specific category`,
        'INFO',
        '/expenses',
        uncategorisedExpenses.map((e: any) => e.id),
      );
    }

    // 4. Invoices sitting in "sent" for more than 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const staleInvoices = userInvoices.filter(
      (inv: any) => inv.status === 'sent' && new Date(inv.createdAt) < ninetyDaysAgo,
    );
    if (staleInvoices.length) {
      add(
        'OVERDUE_INVOICES',
        `${staleInvoices.length} invoices have been Sent for >90 days without update`,
        'WARNING',
        '/invoices',
        staleInvoices.map((i: any) => i.id),
      );
    }

    // 5. Foreign income that never got a real FX rate.
    // A rate of exactly 1 on a non-PKR row means no conversion was applied.
    const badRateIncome = userIncome.filter(
      (inc: any) => inc.currency !== 'PKR' && Number(inc.exchangeRate) === 1,
    );
    if (badRateIncome.length) {
      add(
        'MISSING_EXCHANGE_RATE',
        `${badRateIncome.length} foreign income entries have no exchange rate applied`,
        'WARNING',
        '/income',
        badRateIncome.map((i: any) => i.id),
      );
    }

    // 6. Export income missing its SBP purpose code or PRC reference
    const missingExportDocs = userIncome.filter(
      (inc: any) => inc.currency !== 'PKR' && (!inc.sbpPurposeCode || !inc.prcReferenceNumber),
    );
    if (missingExportDocs.length) {
      add(
        'MISSING_PRC_SBP',
        `${missingExportDocs.length} export income entries are missing PRC references or SBP purpose codes`,
        'WARNING',
        '/income',
        missingExportDocs.map((i: any) => i.id),
      );
    }

    // 7. Invoices marked paid with no matching income record
    const orphanedInvoices = userInvoices.filter(
      (inv: any) => inv.status === 'paid' && !userIncome.some((inc: any) => inc.invoiceId === inv.id),
    );
    if (orphanedInvoices.length) {
      add(
        'ORPHANED_PAID_INVOICE',
        `${orphanedInvoices.length} invoices are marked Paid but have no linked Income record`,
        'WARNING',
        '/invoices',
        orphanedInvoices.map((i: any) => i.id),
      );
    }

    // 8. Wealth reconciliation (doc 19 — now shipped, so it counts towards the score)
    const reconciliation = await this.wealthService.getReconciliation(userId, String(range.taxYear));
    if (!reconciliation.reconciled) {
      add(
        'WEALTH_NOT_RECONCILED',
        `Declared wealth differs from income minus expenses by Rs ${Math.abs(
          Math.round(reconciliation.differencePKR),
        ).toLocaleString()}`,
        'WARNING',
        '/wealth',
        [],
      );
    }

    // 9. Evidence coverage (doc 20 — now shipped)
    const documentedIncomeIds = new Set(evidence.filter((d: any) => d.incomeId).map((d: any) => d.incomeId));
    const undocumentedIncome = userIncome.filter((inc: any) => !documentedIncomeIds.has(inc.id));
    const evidenceCoveragePercent =
      userIncome.length > 0
        ? Math.round(((userIncome.length - undocumentedIncome.length) / userIncome.length) * 100)
        : 100;
    if (undocumentedIncome.length) {
      add(
        'MISSING_EVIDENCE',
        `${undocumentedIncome.length} income entries have no supporting document attached`,
        'INFO',
        '/income',
        undocumentedIncome.map((i: any) => i.id),
      );
    }

    const totalChecks = 9;
    const failedChecks = issues.length;
    const passedChecks = Math.max(0, totalChecks - failedChecks);
    const score = Math.round((passedChecks / totalChecks) * 100);

    let status = 'NOT_STARTED';
    if (score >= 100) status = 'READY';
    else if (score >= 80) status = 'ALMOST_READY';
    else if (score >= 40) status = 'IN_PROGRESS';

    return {
      taxYear: range.taxYear,
      taxYearLabel: range.label,
      score,
      status,
      passedChecks,
      totalChecks,
      profileComplete,
      wealthReconciled: reconciliation.reconciled,
      evidenceCoveragePercent,
      issues,
    };
  }

  async getChecklist(userId: string, year?: string) {
    const { range, user, userIncome, userExpenses } = await this.collect(userId, year);
    const scoreResult = await this.getReadinessScore(userId, year);

    const has = (code: string) => scoreResult.issues.some((i: any) => i.code === code);

    const foreignIncome = userIncome.filter((inc: any) => inc.currency !== 'PKR');

    return {
      taxYear: range.taxYear,
      taxYearLabel: range.label,
      stages: [
        {
          name: 'PREPARATION',
          items: [
            { label: 'Profile completed', complete: !!user?.psebId, fixPath: '/settings' },
            { label: 'Income reviewed', complete: userIncome.length > 0 && !has('INCOME_UNMATCHED_PLATFORM'), fixPath: '/income' },
            { label: 'Expenses reviewed', complete: userExpenses.length > 0 && !has('EXPENSE_MISSING_CATEGORY'), fixPath: '/expenses' },
            {
              label: 'Foreign income reviewed',
              complete: foreignIncome.length === 0 || (!has('MISSING_PRC_SBP') && !has('MISSING_EXCHANGE_RATE')),
              fixPath: '/income',
            },
            { label: 'Remittances reconciled', complete: !has('MISSING_PRC_SBP'), fixPath: '/income' },
          ],
        },
        {
          name: 'WEALTH',
          items: [
            { label: 'Assets entered', complete: scoreResult.wealthReconciled || !has('WEALTH_NOT_RECONCILED'), fixPath: '/wealth' },
            { label: 'Wealth reconciled', complete: scoreResult.wealthReconciled, fixPath: '/wealth' },
          ],
        },
        {
          name: 'EVIDENCE',
          items: [
            {
              label: `Supporting documents (${scoreResult.evidenceCoveragePercent}% coverage)`,
              complete: !has('MISSING_EVIDENCE'),
              fixPath: '/income',
            },
          ],
        },
        {
          name: 'REVIEW',
          items: [
            { label: 'Invoices up to date', complete: !has('OVERDUE_INVOICES') && !has('ORPHANED_PAID_INVOICE'), fixPath: '/invoices' },
            { label: 'Tax calculated', complete: userIncome.length > 0, fixPath: '/tax-simulator' },
          ],
        },
      ],
      overallPercent: scoreResult.score,
      issues: scoreResult.issues,
    };
  }
}
