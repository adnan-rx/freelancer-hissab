"use client";

import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Clock,
  FileText,
  Plus,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  UserPlus,
  Wallet,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardTitle, CardToolbar } from '@/components/ui/card';
import { GroupedBarChart, BreakdownBars } from '@/components/ui/charts';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton, StatCardSkeleton, TableSkeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { Table, TableAmountCell, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatPKR } from '@/lib/utils';
import { platformLabel } from '@/lib/platforms';
import { getCurrentTaxYear, taxYearLabel } from '@/lib/tax-year';
import { useDashboardSummary } from '@/hooks/use-dashboard';
import { useTransactions } from '@/hooks/use-transactions';
import { useIncomeConsolidation, useIncomeVsExpensesReport } from '@/hooks/use-reports';
import { useReadinessScore } from '@/hooks/use-filing';

const QUICK_ACTIONS = [
  { href: '/invoices/new', label: 'Create an invoice', icon: FileText },
  { href: '/expenses', label: 'Log an expense', icon: Receipt },
  { href: '/clients', label: 'Add a client', icon: UserPlus },
];

export default function DashboardPage() {
  const { data: summary, isLoading: isSummaryLoading } = useDashboardSummary();
  const { data: transactions, isLoading: isTxLoading } = useTransactions({ pageSize: 6 });
  const { data: incomeConsolidation, isLoading: isConsolidationLoading } = useIncomeConsolidation();
  const { data: trendData = [], isLoading: isTrendLoading } = useIncomeVsExpensesReport();
  const { data: readiness } = useReadinessScore();

  const totalIncome = summary?.totalIncome ?? 0;
  const totalExpenses = summary?.totalExpenses ?? 0;
  const netProfit = summary?.netProfit ?? (totalIncome - totalExpenses);
  const pendingInvoices = summary?.pendingInvoices ?? 0;
  const pendingAmount = summary?.pendingAmount ?? 0;
  // Derived from this month vs last month; null when there's no prior-month data to compare against.
  const incomeGrowth: number | null = summary?.monthlyGrowth ?? null;
  const expenseGrowth: number | null = summary?.expenseGrowth ?? null;

  const periodLabel = summary?.taxYearLabel ?? taxYearLabel(getCurrentTaxYear());

  // Server already returns the most recent transactions (newest-first)
  const recentTransactions = transactions?.data || [];

  const chartData = trendData.map((m: any) => ({
    label: m.month,
    values: [Number(m.income) || 0, Number(m.expenses) || 0],
  }));
  const hasChartData = chartData.some((d) => d.values.some((v) => v > 0));

  const platforms = incomeConsolidation?.byPlatform ?? [];
  const isReady = (readiness?.score ?? 0) >= 100;

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title="Overview"
        description={`Your financial position for tax year ${periodLabel} — 1 July to 30 June.`}
        actions={
          <Button asChild>
            <Link href="/invoices/new">
              <Plus /> New invoice
            </Link>
          </Button>
        }
      />

      {/* Filing readiness — the one thing this product exists to answer. */}
      {readiness && (
        <Card className={isReady ? 'border-success/20 bg-success-surface' : 'border-warning/20 bg-warning-surface'}>
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex items-start gap-4">
              <span
                className={`flex size-10 shrink-0 items-center justify-center rounded-md ${
                  isReady ? 'bg-success text-success-foreground' : 'bg-warning text-warning-foreground'
                }`}
                aria-hidden="true"
              >
                {isReady ? <ShieldCheck className="size-5" /> : <ShieldAlert className="size-5" />}
              </span>
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold tracking-[-0.01em] text-foreground">Filing readiness</h2>
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-xs font-semibold tabular-nums ${
                      isReady ? 'bg-success text-success-foreground' : 'bg-warning text-warning-foreground'
                    }`}
                  >
                    {readiness.score}%
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {isReady
                    ? 'Your records are complete. You can generate the filing package.'
                    : `${readiness.issues?.length || 0} item${readiness.issues?.length === 1 ? '' : 's'} still need attention before you can file.`}
                </p>
              </div>
            </div>
            <Button asChild variant={isReady ? 'default' : 'outline'} className="shrink-0">
              <Link href="/filing">
                {isReady ? 'Generate package' : 'Review issues'} <ArrowRight />
              </Link>
            </Button>
          </div>
        </Card>
      )}

      {/* KPIs */}
      <section aria-label="Key figures" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isSummaryLoading ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard
              label="Total income"
              value={formatPKR(totalIncome)}
              icon={ArrowUpRight}
              delta={incomeGrowth}
              hint="Gross earnings this tax year"
            />
            <StatCard
              label="Total expenses"
              value={formatPKR(totalExpenses)}
              icon={Wallet}
              delta={expenseGrowth}
              deltaGoodDirection="down"
              hint="Deductible business spend"
            />
            <StatCard
              label="Net profit"
              value={formatPKR(netProfit)}
              icon={TrendingUp}
              emphasis
              hint="Income less expenses"
            />
            <StatCard
              label="Pending invoices"
              value={pendingInvoices}
              unit={pendingInvoices === 1 ? 'invoice' : 'invoices'}
              icon={Clock}
              hint={pendingAmount > 0 ? `${formatPKR(pendingAmount)} outstanding` : 'Nothing outstanding'}
            />
          </>
        )}
      </section>

      {/* Cash flow + income sources */}
      <section className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <Card className="lg:col-span-2">
          <CardToolbar>
            <div className="space-y-1">
              <CardTitle>Income vs expenses</CardTitle>
              <CardDescription>Monthly totals in PKR across tax year {periodLabel}.</CardDescription>
            </div>
          </CardToolbar>
          <CardContent className="pt-5 sm:pt-6">
            {isTrendLoading ? (
              <Skeleton className="h-[240px] w-full" />
            ) : hasChartData ? (
              <GroupedBarChart
                data={chartData}
                caption={`Monthly income and expenses for tax year ${periodLabel}`}
                series={[
                  { key: 'income', label: 'Income', color: 'bg-chart-1' },
                  { key: 'expenses', label: 'Expenses', color: 'bg-chart-2' },
                ]}
              />
            ) : (
              <EmptyState
                icon={TrendingUp}
                size="sm"
                title="No monthly activity yet"
                description="Log income or an expense and this chart starts tracking your cash flow month by month."
                action={
                  <Button asChild variant="outline" size="sm">
                    <Link href="/income">Log income</Link>
                  </Button>
                }
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardToolbar>
            <div className="space-y-1">
              <CardTitle>Income sources</CardTitle>
              <CardDescription>Share of earnings by platform.</CardDescription>
            </div>
          </CardToolbar>
          <CardContent className="space-y-5 pt-5 sm:pt-6">
            {isConsolidationLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-8 w-40" />
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : platforms.length === 0 ? (
              <EmptyState
                size="sm"
                title="No platform income logged"
                description="Tag income with its platform to see where your earnings come from."
              />
            ) : (
              <>
                <div>
                  <p className="text-sm text-muted-foreground">Total tracked</p>
                  <p className="mt-1 font-mono text-2xl font-semibold tracking-[-0.03em] tabular-nums text-foreground">
                    {formatPKR(incomeConsolidation.totalPKR)}
                  </p>
                </div>
                <BreakdownBars
                  items={platforms.map((p: any) => ({
                    label: platformLabel(p.platform),
                    value: p.amountPKR,
                    percentage: p.percentage,
                  }))}
                />
                {incomeConsolidation.unmatchedPercentage > 0 && (
                  <p className="rounded-md border border-warning/15 bg-warning-surface px-3 py-2 text-xs leading-relaxed text-warning">
                    {incomeConsolidation.unmatchedPercentage}% of income has no platform or client attached. Tag it so
                    your filing package reconciles.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Recent activity + quick actions */}
      <section className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <Card className="overflow-hidden lg:col-span-2">
          <CardToolbar>
            <CardTitle>Recent activity</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/transactions">
                View all <ArrowRight />
              </Link>
            </Button>
          </CardToolbar>

          {isTxLoading ? (
            <TableSkeleton rows={5} columns={4} />
          ) : recentTransactions.length === 0 ? (
            <EmptyState
              icon={Receipt}
              size="sm"
              title="No transactions yet"
              description="Income and expenses you record will appear here, newest first."
              action={
                <Button asChild size="sm">
                  <Link href="/income">Log your first entry</Link>
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentTransactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>
                      <span className="flex items-center gap-3">
                        <span
                          className={`flex size-8 shrink-0 items-center justify-center rounded-sm text-2xs font-semibold ${
                            tx.type === 'INCOME' ? 'bg-brand-50 text-brand-800' : 'bg-muted text-muted-foreground'
                          }`}
                          aria-hidden="true"
                        >
                          {tx.entity.substring(0, 2).toUpperCase()}
                        </span>
                        <span className="min-w-0 truncate font-medium text-foreground">{tx.entity}</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {tx.category || (tx.type === 'INCOME' ? 'Income' : 'Expense')}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground tabular">
                      {new Date(tx.date).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </TableCell>
                    <TableAmountCell tone={tx.type === 'INCOME' ? 'positive' : 'default'}>
                      {tx.type === 'INCOME' ? '+' : '−'} {formatPKR(tx.amount)}
                    </TableAmountCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        <Card>
          <CardToolbar>
            <CardTitle>Quick actions</CardTitle>
          </CardToolbar>
          <CardContent className="pt-4 sm:pt-5">
            <ul className="space-y-1">
              {QUICK_ACTIONS.map((action) => (
                <li key={action.href}>
                  <Link
                    href={action.href}
                    className="group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
                  >
                    <span
                      className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-brand-50 text-brand-700"
                      aria-hidden="true"
                    >
                      <action.icon className="size-4" />
                    </span>
                    {action.label}
                    <ArrowRight className="ml-auto size-4 shrink-0 text-subtle transition-transform duration-200 ease-smooth group-hover:translate-x-0.5 group-hover:text-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
