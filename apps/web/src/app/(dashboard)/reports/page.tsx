"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, DollarSign, Wallet, ShieldCheck, Download, PieChart as PieIcon, BarChart3, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPKR, formatUSD } from "@/lib/utils";
import { useIncomeVsExpensesReport, useTaxEstimate } from "@/hooks/use-reports";
import { useIncome } from "@/hooks/use-income";
import { useExpenses } from "@/hooks/use-expenses";

export default function ReportsPage() {
  const { data: trendData = [] } = useIncomeVsExpensesReport();
  const { data: incomeList = [] } = useIncome();
  const { data: expensesList = [] } = useExpenses();
  const { data: taxEstimate } = useTaxEstimate(true);

  // 100% Dynamic Financial Totals from Database
  const totalRevenuePKR = incomeList.reduce((sum: number, inc: any) => sum + Number(inc.amountPKR || inc.amount * 280.50 || 0), 0);
  const totalExpensesPKR = expensesList.reduce((sum: number, exp: any) => sum + Number(exp.amount || 0), 0);
  const netProfitPKR = totalRevenuePKR - totalExpensesPKR;
  const profitMargin = totalRevenuePKR > 0 ? ((netProfitPKR / totalRevenuePKR) * 100).toFixed(1) : "0.0";

  // Dynamic Platform Distribution Calculation
  const platformTotals: Record<string, { label: string; amount: number; color: string }> = {};
  let totalIncomeSum = 0;

  incomeList.forEach((inc: any) => {
    const platKey = (inc.platform || "upwork").toLowerCase();
    const amt = Number(inc.amountPKR || inc.amount * 280.50 || 0);
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

  const taxRate = (taxEstimate && taxEstimate.exportTaxRatePercentage !== undefined)
    ? `${taxEstimate.exportTaxRatePercentage}%`
    : "0.25%";
  const taxLiability = (taxEstimate && taxEstimate.totalTaxLiabilityPKR !== undefined)
    ? formatPKR(taxEstimate.totalTaxLiabilityPKR)
    : formatPKR(totalRevenuePKR * 0.0025);

  return (
    <div className="space-y-8 max-w-7xl">
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

      {/* Summary KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Gross Income (YTD)</CardTitle>
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
            <CardTitle className="text-sm font-medium text-foreground">Total Expenses (YTD)</CardTitle>
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
              <BarChart3 className="h-5 w-5 text-primary" /> Income vs. Expense Trend (2026)
            </CardTitle>
            <CardDescription>Monthly gross income vs operating expenses in PKR.</CardDescription>
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
                    <div key={item.month} className="space-y-1.5">
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
                No platform income logged in database yet.
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
                      <div className={`h-2 rounded-full ${plat.color.split(' ')[0]}`} style={{ width: `${plat.percentage}%` }}></div>
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
                Ensure foreign remittances received via Meezan Bank carry proper SBP purpose codes (e.g. 9100 / Software Export Services).
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
                  <TableHead className="text-muted-foreground">Transaction Description</TableHead>
                  <TableHead className="text-muted-foreground">Type</TableHead>
                  <TableHead className="text-muted-foreground text-right">Amount (PKR)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incomeList.length === 0 && expensesList.length === 0 ? (
                  <TableRow className="border-border">
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                      No P&L transactions recorded in database yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {incomeList.map((inc: any) => (
                      <TableRow key={`inc-${inc.id}`} className="transition-colors">
                        <TableCell className="font-semibold text-foreground">{inc.description || `${inc.platform || 'Foreign'} Remittance`}</TableCell>
                        <TableCell><Badge variant="outline" className="border-primary/30 text-primary bg-primary/10">Income</Badge></TableCell>
                        <TableCell className="text-right font-mono text-primary font-bold">{formatPKR(inc.amountPKR || inc.amount * 280.50)}</TableCell>
                      </TableRow>
                    ))}
                    {expensesList.map((exp: any) => (
                      <TableRow key={`exp-${exp.id}`} className="transition-colors">
                        <TableCell className="font-semibold text-foreground">{exp.description || exp.vendor || "Business Expense"}</TableCell>
                        <TableCell><Badge variant="outline" className="border-destructive/30 text-destructive bg-destructive/10">Expense</Badge></TableCell>
                        <TableCell className="text-right font-mono text-destructive font-bold">- {formatPKR(exp.amount || 0)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-secondary/50 font-bold border-t-2 border-border">
                      <TableCell className="text-foreground text-base">Net Freelance Profit</TableCell>
                      <TableCell><Badge className="bg-primary text-primary-foreground">Net Operating Revenue</Badge></TableCell>
                      <TableCell className="text-right font-mono text-primary text-lg">{formatPKR(netProfitPKR)}</TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
