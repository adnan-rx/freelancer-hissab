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
      upwork: { label: "Upwork Escrow", color: "bg-emerald-500 text-emerald-400" },
      fiverr: { label: "Fiverr Orders", color: "bg-green-500 text-green-400" },
      direct: { label: "Direct Bank Transfer / Wise", color: "bg-teal-400 text-teal-400" },
      freelancer: { label: "Freelancer.com", color: "bg-blue-500 text-blue-400" },
      other: { label: "Other Local PKR Client", color: "bg-slate-400 text-slate-300" },
    };

    const meta = metaMap[platKey] || { label: platKey.toUpperCase(), color: "bg-emerald-500 text-emerald-400" };
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
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-100">Financial Reports & Tax Engine</h1>
          <p className="text-sm text-slate-400 mt-1">
            Profit & Loss statements, FBR Section 154A IT Exporter tax liability, and live exchange rate analytics.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800" onClick={() => window.print()}>
            <Download className="mr-2 h-4 w-4" /> Export P&L PDF
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-slate-900/60 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Gross Income (YTD)</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-50">{formatPKR(totalRevenuePKR)}</div>
            <p className="text-xs text-emerald-400 mt-1 flex items-center font-medium">
              <TrendingUp className="h-3.5 w-3.5 mr-1" /> Foreign & Direct Earnings
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Total Expenses (YTD)</CardTitle>
            <Wallet className="h-4 w-4 text-rose-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-50">{formatPKR(totalExpensesPKR)}</div>
            <p className="text-xs text-slate-400 mt-1">Operational & Subscriptions</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Net Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400">{formatPKR(netProfitPKR)}</div>
            <p className="text-xs text-emerald-400 mt-1 font-medium">{profitMargin}% Profit Margin</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">FBR Section 154A Tax Liability</CardTitle>
            <Calculator className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-50">{taxLiability}</div>
            <p className="text-xs text-emerald-400 mt-1 font-medium">{taxRate} PSEB Reduced Export Tax Rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Visual Analytics Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Bar Breakdown */}
        <Card className="md:col-span-2 bg-slate-900/60 border-slate-800">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-100">
              <BarChart3 className="h-5 w-5 text-emerald-400" /> Income vs. Expense Trend (2026)
            </CardTitle>
            <CardDescription className="text-slate-400">Monthly gross income vs operating expenses in PKR.</CardDescription>
          </CardHeader>
          <CardContent>
            {trendData.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-sm">
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
                        <span className="text-slate-300 w-12">{item.month}</span>
                        <div className="space-x-4">
                          <span className="text-emerald-400">Income: {formatPKR(item.income)}</span>
                          <span className="text-rose-400">Expense: {formatPKR(item.expenses)}</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-800/80 rounded-full h-3 flex overflow-hidden p-0.5 gap-1">
                        <div className="bg-emerald-500 rounded-full h-full transition-all duration-500" style={{ width: `${incPct}%` }}></div>
                        <div className="bg-rose-500 rounded-full h-full transition-all duration-500" style={{ width: `${expPct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dynamic Platform Share */}
        <Card className="bg-slate-900/60 border-slate-800">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-100">
              <PieIcon className="h-5 w-5 text-emerald-400" /> Platform Distribution
            </CardTitle>
            <CardDescription className="text-slate-400">Earnings share calculated from database records.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {platformDistribution.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                No platform income logged in database yet.
              </div>
            ) : (
              <div className="space-y-4">
                {platformDistribution.map((plat) => (
                  <div key={plat.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-200 font-medium">{plat.label}</span>
                      <span className="font-bold font-mono text-emerald-400">{plat.percentage}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div className={`h-2 rounded-full ${plat.color.split(' ')[0]}`} style={{ width: `${plat.percentage}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 text-xs text-slate-400 space-y-2 mt-6">
              <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-400" /> PRC Exemption Advice
              </div>
              <p>
                Ensure foreign remittances received via Meezan Bank carry proper SBP purpose codes (e.g. 9100 / Software Export Services).
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* P&L Detailed Table */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-slate-100">Profit & Loss Statement (P&L Breakdown)</CardTitle>
          <CardDescription className="text-slate-400">Real-time financial statement generated from database logs.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader className="bg-slate-900/80 border-slate-800">
              <TableRow className="border-slate-800">
                <TableHead className="text-slate-300">Transaction Description</TableHead>
                <TableHead className="text-slate-300">Type</TableHead>
                <TableHead className="text-slate-300 text-right">Amount (PKR)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {incomeList.length === 0 && expensesList.length === 0 ? (
                <TableRow className="border-slate-800">
                  <TableCell colSpan={3} className="text-center py-8 text-slate-400">
                    No P&L transactions recorded in database yet.
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {incomeList.map((inc: any) => (
                    <TableRow key={`inc-${inc.id}`} className="border-slate-800">
                      <TableCell className="font-semibold text-slate-100">{inc.description || `${inc.platform || 'Foreign'} Remittance`}</TableCell>
                      <TableCell><Badge variant="default" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Income</Badge></TableCell>
                      <TableCell className="text-right font-mono text-emerald-400 font-bold">{formatPKR(inc.amountPKR || inc.amount * 280.50)}</TableCell>
                    </TableRow>
                  ))}
                  {expensesList.map((exp: any) => (
                    <TableRow key={`exp-${exp.id}`} className="border-slate-800">
                      <TableCell className="font-semibold text-slate-100">{exp.description || exp.vendor || "Business Expense"}</TableCell>
                      <TableCell><Badge variant="secondary" className="bg-rose-500/20 text-rose-400 border-rose-500/30">Expense</Badge></TableCell>
                      <TableCell className="text-right font-mono text-rose-400 font-bold">- {formatPKR(exp.amount || 0)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-slate-800 bg-slate-900 font-bold">
                    <TableCell className="text-slate-100 text-base">Net Freelance Profit</TableCell>
                    <TableCell><Badge className="bg-emerald-500 text-slate-950">Net Operating Revenue</Badge></TableCell>
                    <TableCell className="text-right font-mono text-emerald-400 text-lg">{formatPKR(netProfitPKR)}</TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
