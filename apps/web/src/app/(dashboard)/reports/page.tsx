"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PaginationBar } from "@/components/ui/pagination-bar";
import {
  TrendingUp,
  DollarSign,
  Wallet,
  ShieldCheck,
  Download,
  PieChart as PieIcon,
  BarChart3,
  Calculator,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPKR } from "@/lib/utils";
import { useIncomeVsExpensesReport, useTaxEstimate } from "@/hooks/use-reports";
import { useIncome } from "@/hooks/use-income";
import { useExpenses } from "@/hooks/use-expenses";

const PAGE_SIZE = 10;

/** Both receivedAt (ISO datetime) and expenseDate ('YYYY-MM-DD') compare correctly as plain strings once sliced to the date part. */
function toDateOnly(value: string | undefined): string {
  return value ? String(value).slice(0, 10) : "";
}

export default function ReportsPage() {
  const { data: trendData = [] } = useIncomeVsExpensesReport();
  const { data: incomeList = [] } = useIncome();
  const { data: expensesList = [] } = useExpenses();
  const { data: taxEstimate } = useTaxEstimate(true);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [startDate, endDate]);

  const hasDateFilter = !!(startDate || endDate);
  const dateRangeInvalid = !!(startDate && endDate && startDate > endDate);

  const inRange = (dateStr: string) => {
    if (!dateStr) return false;
    if (startDate && dateStr < startDate) return false;
    if (endDate && dateStr > endDate) return false;
    return true;
  };

  // Every KPI, chart and table below derives from these two filtered lists, so the
  // date range consistently scopes the entire page rather than just one table.
  const filteredIncome = useMemo(() => {
    if (!hasDateFilter || dateRangeInvalid) return hasDateFilter ? [] : incomeList;
    return incomeList.filter((inc: any) => inRange(toDateOnly(inc.receivedAt)));
  }, [incomeList, startDate, endDate]);

  const filteredExpenses = useMemo(() => {
    if (!hasDateFilter || dateRangeInvalid) return hasDateFilter ? [] : expensesList;
    return expensesList.filter((exp: any) => inRange(toDateOnly(exp.expenseDate)));
  }, [expensesList, startDate, endDate]);

  const totalRevenuePKR = filteredIncome.reduce((sum: number, inc: any) => sum + Number(inc.amountPKR || 0), 0);
  const totalExpensesPKR = filteredExpenses.reduce((sum: number, exp: any) => sum + Number(exp.amountPKR ?? exp.amount ?? 0), 0);
  const netProfitPKR = totalRevenuePKR - totalExpensesPKR;
  const profitMargin = totalRevenuePKR > 0 ? ((netProfitPKR / totalRevenuePKR) * 100).toFixed(1) : "0.0";

  // Dynamic Platform Distribution Calculation
  const platformTotals: Record<string, { label: string; amount: number; color: string }> = {};
  let totalIncomeSum = 0;

  filteredIncome.forEach((inc: any) => {
    const platKey = (inc.platform || "upwork").toLowerCase();
    const amt = Number(inc.amountPKR || 0);
    totalIncomeSum += amt;

    const metaMap: Record<string, { label: string; color: string }> = {
      upwork: { label: "Upwork Escrow", color: "bg-primary text-primary-foreground" },
      fiverr: { label: "Fiverr Orders", color: "bg-green-500 text-white" },
      direct: { label: "Direct Bank Transfer / Wise", color: "bg-teal-500 text-white" },
      freelancer: { label: "Freelancer.com", color: "bg-blue-500 text-white" },
      other: { label: "Other Local PKR Client", color: "bg-muted-foreground text-white" },
    };

    const meta = metaMap[platKey] || { label: platKey.toUpperCase(), color: "bg-primary text-primary-foreground" };
    if (!platformTotals[platKey]) {
      platformTotals[platKey] = { label: meta.label, amount: 0, color: meta.color };
    }
    platformTotals[platKey].amount += amt;
  });

  const platformDistribution = Object.values(platformTotals).map((p) => ({
    ...p,
    percentage: totalIncomeSum > 0 ? Math.round((p.amount / totalIncomeSum) * 100) : 0,
  }));

  const taxRate =
    taxEstimate && taxEstimate.exportTaxRatePercentage !== undefined ? `${taxEstimate.exportTaxRatePercentage}%` : "0.25%";
  const taxLiability =
    taxEstimate && taxEstimate.totalTaxLiabilityPKR !== undefined
      ? formatPKR(taxEstimate.totalTaxLiabilityPKR)
      : formatPKR(totalRevenuePKR * 0.0025);

  // P&L rows: income + expenses merged, newest first, paginated client-side —
  // both lists are already fully loaded for the KPI math above, so a second
  // network round trip through the transactions endpoint would be redundant.
  const plRows = useMemo(() => {
    const incomeRows = filteredIncome.map((inc: any) => ({
      key: `inc-${inc.id}`,
      date: toDateOnly(inc.receivedAt),
      description: inc.description || `${inc.platform || "Foreign"} Remittance`,
      type: "income" as const,
      amountPKR: Number(inc.amountPKR || 0),
    }));
    const expenseRows = filteredExpenses.map((exp: any) => ({
      key: `exp-${exp.id}`,
      date: toDateOnly(exp.expenseDate),
      description: exp.description || exp.vendor || "Business Expense",
      type: "expense" as const,
      amountPKR: Number(exp.amountPKR ?? exp.amount ?? 0),
    }));
    return [...incomeRows, ...expenseRows].sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [filteredIncome, filteredExpenses]);

  const totalPlPages = Math.max(1, Math.ceil(plRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPlPages);
  const pagedPlRows = plRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const clearDateFilter = () => {
    setStartDate("");
    setEndDate("");
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Financial Reports & Tax Engine</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Profit & Loss statements, FBR Section 154A IT Exporter tax liability, and live exchange rate analytics.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => window.print()}>
            <Download className="mr-2 h-4 w-4" /> Export P&L PDF
          </Button>
        </div>
      </div>

      {/* Date range filter — scopes every KPI, chart and the P&L table below */}
      <Card>
        <CardContent className="py-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Date range:</span>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-auto bg-background border-input text-foreground text-sm h-9"
            aria-label="Start date"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-auto bg-background border-input text-foreground text-sm h-9"
            aria-label="End date"
          />
          {hasDateFilter && (
            <Button variant="ghost" size="sm" onClick={clearDateFilter} className="h-9 px-2 text-xs text-muted-foreground">
              <X className="h-3.5 w-3.5 mr-1" /> Clear
            </Button>
          )}
          {dateRangeInvalid && <p className="text-xs text-destructive ml-2">Start date must be before the end date.</p>}
          {hasDateFilter && !dateRangeInvalid && (
            <span className="text-xs text-muted-foreground ml-2">
              Showing {filteredIncome.length + filteredExpenses.length} transaction(s) in range
            </span>
          )}
        </CardContent>
      </Card>

      {/* Summary KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Gross Income</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatPKR(totalRevenuePKR)}</div>
            <p className="text-xs text-primary mt-1 flex items-center font-medium">
              <TrendingUp className="h-3.5 w-3.5 mr-1" /> Foreign & Direct Earnings
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Total Expenses</CardTitle>
            <Wallet className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatPKR(totalExpensesPKR)}</div>
            <p className="text-xs text-muted-foreground mt-1">Operational & Subscriptions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Net Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{formatPKR(netProfitPKR)}</div>
            <p className="text-xs text-primary mt-1 font-medium">{profitMargin}% Profit Margin</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-foreground">FBR Section 154A Tax Liability</CardTitle>
            <Calculator className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{taxLiability}</div>
            <p className="text-xs text-primary mt-1 font-medium">{taxRate} PSEB Reduced Export Tax Rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Visual Analytics Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Bar Breakdown */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
              <BarChart3 className="h-5 w-5 text-primary" /> Income vs. Expense Trend
            </CardTitle>
            <CardDescription>Monthly gross income vs operating expenses in PKR, current tax year.</CardDescription>
          </CardHeader>
          <CardContent>
            {trendData.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                No monthly trend data recorded yet. Log income and expenses to populate monthly analytics.
              </div>
            ) : (
              <div className="space-y-4 pt-2">
                {trendData.map((item: any) => {
                  const maxVal = Math.max(...trendData.map((m: any) => m.income || 1));
                  const incPct = Math.round(((item.income || 0) / maxVal) * 100);
                  const expPct = Math.round(((item.expenses || 0) / maxVal) * 100);

                  return (
                    <div key={`${item.month}-${item.year}`} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-foreground w-12">{item.month}</span>
                        <div className="space-x-4">
                          <span className="text-primary">Income: {formatPKR(item.income)}</span>
                          <span className="text-destructive">Expense: {formatPKR(item.expenses)}</span>
                        </div>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-3 flex overflow-hidden p-0.5 gap-1">
                        <div className="bg-primary rounded-full h-full transition-all duration-500" style={{ width: `${incPct}%` }}></div>
                        <div className="bg-destructive rounded-full h-full transition-all duration-500" style={{ width: `${expPct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dynamic Platform Share */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
              <PieIcon className="h-5 w-5 text-primary" /> Platform Distribution
            </CardTitle>
            <CardDescription>Earnings share calculated from database records.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {platformDistribution.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-xs">
                No platform income logged {hasDateFilter ? "in this date range" : "in database yet"}.
              </div>
            ) : (
              <div className="space-y-4">
                {platformDistribution.map((plat) => (
                  <div key={plat.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-foreground font-medium">{plat.label}</span>
                      <span className="font-bold font-mono text-primary">{plat.percentage}%</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                      <div className={`h-2 rounded-full ${plat.color.split(" ")[0]}`} style={{ width: `${plat.percentage}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="p-4 rounded-xl border border-border bg-card shadow-sm text-xs text-muted-foreground space-y-2 mt-6">
              <div className="font-semibold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-primary" /> PRC Exemption Advice
              </div>
              <p>
                Ensure foreign remittances received via Meezan Bank carry proper SBP purpose codes (e.g. 9100 / Software Export
                Services).
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* P&L Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-bold text-foreground">Profit & Loss Statement (P&L Breakdown)</CardTitle>
          <CardDescription>Real-time financial statement generated from database logs.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="border-border">
                  <TableHead className="text-muted-foreground">Date</TableHead>
                  <TableHead className="text-muted-foreground">Transaction Description</TableHead>
                  <TableHead className="text-muted-foreground">Type</TableHead>
                  <TableHead className="text-muted-foreground text-right">Amount (PKR)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dateRangeInvalid ? (
                  <TableRow className="border-border">
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      Fix the date range above to see results.
                    </TableCell>
                  </TableRow>
                ) : plRows.length === 0 ? (
                  <TableRow className="border-border">
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      {hasDateFilter ? "No transactions in this date range." : "No P&L transactions recorded in database yet."}
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {pagedPlRows.map((row) => (
                      <TableRow key={row.key} className="transition-colors">
                        <TableCell className="text-muted-foreground font-mono text-xs whitespace-nowrap">{row.date}</TableCell>
                        <TableCell className="font-semibold text-foreground">{row.description}</TableCell>
                        <TableCell>
                          {row.type === "income" ? (
                            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/10">
                              Income
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-destructive/30 text-destructive bg-destructive/10">
                              Expense
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell
                          className={`text-right font-mono font-bold ${row.type === "income" ? "text-primary" : "text-destructive"}`}
                        >
                          {row.type === "expense" ? "- " : ""}
                          {formatPKR(row.amountPKR)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-secondary/50 font-bold border-t-2 border-border">
                      <TableCell colSpan={2} className="text-foreground text-base">
                        Net Freelance Profit {hasDateFilter ? "(filtered)" : ""}
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-primary text-primary-foreground">Net Operating Revenue</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-primary text-lg">{formatPKR(netProfitPKR)}</TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
            <PaginationBar page={currentPage} pageSize={PAGE_SIZE} total={plRows.length} onPageChange={setPage} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
