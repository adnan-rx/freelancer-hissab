"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, Calculator, Download, PieChart as PieIcon, ShieldCheck, TrendingUp, Wallet } from "lucide-react";

import { Card, CardContent, CardDescription, CardTitle, CardToolbar } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { BreakdownBars, GroupedBarChart, TrendChart } from "@/components/ui/charts";
import { formatPKR, formatDate } from "@/lib/utils";
import { platformLabel } from "@/lib/platforms";
import { useIncomeVsExpensesReport } from "@/hooks/use-reports";
import { useTaxEstimate } from "@/hooks/use-tax";
import { useIncome } from "@/hooks/use-income";
import { useExpenses } from "@/hooks/use-expenses";
import { getCurrentTaxYear, taxYearBounds, taxYearLabel } from "@/lib/tax-year";

const PAGE_SIZE = 10;

/** Both receivedAt (ISO datetime) and expenseDate ('YYYY-MM-DD') compare correctly as plain strings once sliced to the date part. */
function toDateOnly(value: string | undefined): string {
  return value ? String(value).slice(0, 10) : "";
}

export default function ReportsPage() {
  const currentTaxYear = getCurrentTaxYear();
  const { data: trendData = [] } = useIncomeVsExpensesReport(String(currentTaxYear));
  const { data: incomeList = [] } = useIncome();
  const { data: expensesList = [] } = useExpenses();
  // PSEB status is derived server-side from the user's own profile, not
  // hardcoded — an unregistered freelancer used to be quoted the 0.25%
  // concessional rate here regardless of their actual registration.
  const { data: taxEstimate, isLoading: isTaxLoading, isError: isTaxError } = useTaxEstimate(currentTaxYear);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [startDate, endDate, pageSize]);

  const hasDateFilter = !!(startDate || endDate);
  const dateRangeInvalid = !!(startDate && endDate && startDate > endDate);

  // With no explicit filter, the KPIs and P&L table default to the SAME
  // current-tax-year window as the trend chart and tax card beside them.
  // They used to default to "every income/expense ever," so this page could
  // show three different totals for "the same" data depending which card you
  // looked at. An explicit filter still overrides the default on either end.
  const defaultBounds = taxYearBounds(currentTaxYear);
  const effectiveStart = startDate || defaultBounds.start;
  const effectiveEnd = endDate || defaultBounds.end;

  const inRange = useCallback(
    (dateStr: string) => {
      if (!dateStr) return false;
      if (dateStr < effectiveStart) return false;
      if (dateStr > effectiveEnd) return false;
      return true;
    },
    [effectiveStart, effectiveEnd],
  );

  const filteredIncome = useMemo(() => {
    if (dateRangeInvalid) return [];
    return incomeList.filter((inc: any) => inRange(toDateOnly(inc.receivedAt)));
  }, [incomeList, inRange, dateRangeInvalid]);

  const filteredExpenses = useMemo(() => {
    if (dateRangeInvalid) return [];
    return expensesList.filter((exp: any) => inRange(toDateOnly(exp.expenseDate)));
  }, [expensesList, inRange, dateRangeInvalid]);

  const totalRevenuePKR = filteredIncome.reduce((sum: number, inc: any) => sum + Number(inc.amountPKR || 0), 0);
  const totalExpensesPKR = filteredExpenses.reduce((sum: number, exp: any) => sum + Number(exp.amountPKR ?? exp.amount ?? 0), 0);
  const netProfitPKR = totalRevenuePKR - totalExpensesPKR;
  const profitMargin = totalRevenuePKR > 0 ? ((netProfitPKR / totalRevenuePKR) * 100).toFixed(1) : "0.0";

  // Dynamic Platform Distribution Calculation
  const platformTotals: Record<string, { label: string; amount: number }> = {};
  let totalIncomeSum = 0;

  filteredIncome.forEach((inc: any) => {
    const platKey = (inc.platform || "upwork").toLowerCase();
    const amt = Number(inc.amountPKR || 0);
    totalIncomeSum += amt;

    if (!platformTotals[platKey]) {
      platformTotals[platKey] = { label: platformLabel(platKey), amount: 0 };
    }
    platformTotals[platKey].amount += amt;
  });

  const platformDistribution = Object.values(platformTotals)
    .map((p) => ({
      label: p.label,
      value: p.amount,
      percentage: totalIncomeSum > 0 ? Math.round((p.amount / totalIncomeSum) * 100) : 0,
    }))
    .sort((a, b) => b.value - a.value);

  // No fabricated fallback: a failed/loading estimate used to render as
  // "0.25% / Rs X" computed from a hardcoded rate, indistinguishable from a
  // real number. It now honestly shows loading or unavailable.
  const taxLiability = isTaxLoading ? "…" : isTaxError || !taxEstimate ? "—" : formatPKR(taxEstimate.totalTaxLiabilityPKR);
  const taxRateLabel = isTaxLoading
    ? "Working it out…"
    : isTaxError || !taxEstimate
      ? "Tax estimate unavailable"
      : `${taxEstimate.exportTaxRatePercentage}% export tax rate${taxEstimate.isPsebRegistered ? " (PSEB)" : ""}`;

  const chartData = trendData.map((m: any) => ({
    label: m.month,
    values: [Number(m.income) || 0, Number(m.expenses) || 0],
  }));
  const profitSeries = trendData.map((m: any) => ({ label: m.month, value: Number(m.profit) || 0 }));
  const hasChartData = chartData.some((d) => d.values.some((v) => v > 0));

  // P&L rows: income + expenses merged, newest first, paginated client-side —
  // both lists are already fully loaded for the KPI math above, so a second
  // network round trip through the transactions endpoint would be redundant.
  const plRows = useMemo(() => {
    const incomeRows = filteredIncome.map((inc: any) => ({
      key: `inc-${inc.id}`,
      date: toDateOnly(inc.receivedAt),
      description: inc.description || `${inc.platform || "Foreign"} remittance`,
      type: "income" as const,
      amountPKR: Number(inc.amountPKR || 0),
    }));
    const expenseRows = filteredExpenses.map((exp: any) => ({
      key: `exp-${exp.id}`,
      date: toDateOnly(exp.expenseDate),
      description: exp.description || exp.vendor || "Business expense",
      type: "expense" as const,
      amountPKR: Number(exp.amountPKR ?? exp.amount ?? 0),
    }));
    return [...incomeRows, ...expenseRows].sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [filteredIncome, filteredExpenses]);

  const totalPlPages = Math.max(1, Math.ceil(plRows.length / pageSize));
  const currentPage = Math.min(page, totalPlPages);
  const pagedPlRows = plRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const clearDateFilter = () => {
    setStartDate("");
    setEndDate("");
  };

  const periodLabel = hasDateFilter
    ? `${formatDate(effectiveStart)} – ${formatDate(effectiveEnd)}`
    : `Tax year ${taxYearLabel(currentTaxYear)}`;

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title="Reports"
        description="Profit and loss, platform mix and your Section 154A export tax position — all from your own records."
        actions={
          <Button variant="outline" onClick={() => window.print()}>
            <Download /> Export P&amp;L
          </Button>
        }
      />

      {/* Filter row sits on its own surface; the KPIs below are cards in their
          own right, never cards nested inside another card. */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 pt-4 sm:flex-row sm:items-center sm:justify-between sm:p-5 sm:pt-5">
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onStartChange={setStartDate}
            onEndChange={setEndDate}
            onClear={clearDateFilter}
            invalid={dateRangeInvalid}
          />
          <span className="text-xs text-muted-foreground">
            {dateRangeInvalid
              ? "Fix the range to see figures"
              : `${filteredIncome.length + filteredExpenses.length} entries · ${periodLabel}`}
          </span>
        </CardContent>
      </Card>

      <section aria-label="Period totals" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Gross income" value={formatPKR(totalRevenuePKR)} icon={TrendingUp} hint="Foreign and direct earnings" />
        <StatCard label="Total expenses" value={formatPKR(totalExpensesPKR)} icon={Wallet} hint="Operational and subscriptions" />
        <StatCard
          label="Net profit"
          value={formatPKR(netProfitPKR)}
          icon={TrendingUp}
          emphasis
          hint={`${profitMargin}% profit margin`}
        />
        <StatCard label="Section 154A tax" value={taxLiability} icon={Calculator} hint={taxRateLabel} />
      </section>

      <section className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <Card className="lg:col-span-2">
          <CardToolbar>
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="size-4 text-brand-600" aria-hidden="true" /> Income vs expenses
              </CardTitle>
              <CardDescription>Monthly totals in PKR, tax year {taxYearLabel(currentTaxYear)}.</CardDescription>
            </div>
          </CardToolbar>
          <CardContent className="pt-5 sm:pt-6">
            {hasChartData ? (
              <GroupedBarChart
                data={chartData}
                caption={`Monthly income and expenses for tax year ${taxYearLabel(currentTaxYear)}`}
                series={[
                  { key: "income", label: "Income", color: "bg-chart-1" },
                  { key: "expenses", label: "Expenses", color: "bg-chart-2" },
                ]}
              />
            ) : (
              <EmptyState
                icon={BarChart3}
                size="sm"
                title="No monthly data yet"
                description="Log income and expenses and this chart fills in month by month."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardToolbar>
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <PieIcon className="size-4 text-brand-600" aria-hidden="true" /> Platform mix
              </CardTitle>
              <CardDescription>Share of earnings in this period.</CardDescription>
            </div>
          </CardToolbar>
          <CardContent className="space-y-5 pt-5 sm:pt-6">
            {platformDistribution.length === 0 ? (
              <EmptyState
                size="sm"
                title="No platform income here"
                description={hasDateFilter ? "Nothing was earned in this date range." : "Tag income with a platform to see the split."}
              />
            ) : (
              <BreakdownBars items={platformDistribution} />
            )}

            <div className="rounded-md border border-info/15 bg-info-surface p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-info">
                <ShieldCheck className="size-4 shrink-0" aria-hidden="true" /> PRC exemption
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-info/90">
                Foreign remittances need the right SBP purpose code (for example 9100, software export services) for the
                exemption to hold. Check this with your bank when the payment lands.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardToolbar>
          <div className="space-y-1">
            <CardTitle>Net profit trend</CardTitle>
            <CardDescription>Income less expenses, month by month.</CardDescription>
          </div>
        </CardToolbar>
        <CardContent className="pt-5 sm:pt-6">
          {hasChartData ? (
            <TrendChart data={profitSeries} caption={`Monthly net profit for tax year ${taxYearLabel(currentTaxYear)}`} />
          ) : (
            <EmptyState icon={TrendingUp} size="sm" title="No trend to show yet" description="This chart needs at least one month of activity." />
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden print:break-inside-avoid">
        <CardToolbar>
          <div className="space-y-1">
            <CardTitle>Profit &amp; loss statement</CardTitle>
            <CardDescription>{periodLabel}</CardDescription>
          </div>
        </CardToolbar>

        {dateRangeInvalid ? (
          <EmptyState title="That date range doesn't work" description="The start date is after the end date." size="sm" />
        ) : plRows.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="Nothing recorded in this period"
            description={hasDateFilter ? "Try widening the date range." : "Log income or expenses to build your P&L."}
            action={
              hasDateFilter ? (
                <Button variant="outline" onClick={clearDateFilter}>
                  Clear date range
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedPlRows.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell className="whitespace-nowrap text-muted-foreground tabular">{formatDate(row.date)}</TableCell>
                    <TableCell className="font-medium text-foreground">{row.description}</TableCell>
                    <TableCell>
                      <Badge variant={row.type === "income" ? "success" : "neutral"} dot className="capitalize">
                        {row.type}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono text-sm font-medium tabular-nums ${
                        row.type === "income" ? "text-success" : "text-foreground"
                      }`}
                    >
                      {row.type === "expense" ? "− " : "+ "}
                      {formatPKR(row.amountPKR)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3} className="text-sm font-semibold text-foreground">
                    Net profit {hasDateFilter ? "(filtered)" : `· tax year ${taxYearLabel(currentTaxYear)}`}
                  </TableCell>
                  <TableCell className="text-right font-mono text-base font-semibold tabular-nums text-brand-900">
                    {formatPKR(netProfitPKR)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
            <PaginationBar
              page={currentPage}
              pageSize={pageSize}
              total={plRows.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </Card>
    </div>
  );
}
