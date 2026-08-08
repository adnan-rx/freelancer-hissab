"use client";

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DollarSign, FileText, ArrowUpRight, ArrowDownRight, Wallet, Plus, TrendingUp, Clock } from 'lucide-react';
import { formatPKR } from '@/lib/utils';
import { useDashboardSummary } from '@/hooks/use-dashboard';
import { useTransactions } from '@/hooks/use-transactions';
import { useInvoices } from '@/hooks/use-invoices';
import Link from 'next/link';

export default function DashboardPage() {
  const { data: summary, isLoading: isSummaryLoading } = useDashboardSummary();
  const { data: transactions, isLoading: isTxLoading } = useTransactions();
  const { data: invoices } = useInvoices();

  const totalIncome = summary?.totalIncome ?? 0;
  const totalExpenses = summary?.totalExpenses ?? 0;
  const netProfit = summary?.netProfit ?? (totalIncome - totalExpenses);
  const pendingInvoices = summary?.pendingInvoices ?? 0;

  // Grab the first 5 transactions for the recent activity table
  const recentTransactions = transactions?.slice(0, 5) || [];

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-2 md:px-0">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">Here is the summary of your overall financial data.</p>
        </div>
        <Link href="/invoices/new">
          <Button className="rounded-full shadow-sm px-6 font-semibold" size="lg">
            <Plus className="h-4 w-4 mr-2" /> New Payment
          </Button>
        </Link>
      </div>
      
      {/* KPI Cards Section */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Income */}
        <Card className="rounded-3xl border-border/50 shadow-sm overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-foreground">Total Income</h3>
              <div className="h-8 w-8 rounded-full bg-emerald-50 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-emerald-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-foreground font-mono tracking-tight">
              {isSummaryLoading ? "..." : formatPKR(totalIncome)}
            </div>
            <div className="flex items-center mt-3 gap-2">
              <span className="text-xs text-muted-foreground">Since Last Month</span>
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                <ArrowUpRight className="h-3 w-3 mr-0.5" /> +12.5%
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Total Expenses */}
        <Card className="rounded-3xl border-border/50 shadow-sm overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-foreground">Total Expenses</h3>
              <div className="h-8 w-8 rounded-full bg-rose-50 flex items-center justify-center">
                <Wallet className="h-4 w-4 text-rose-500" />
              </div>
            </div>
            <div className="text-3xl font-bold text-foreground font-mono tracking-tight">
              {isSummaryLoading ? "..." : formatPKR(totalExpenses)}
            </div>
            <div className="flex items-center mt-3 gap-2">
              <span className="text-xs text-muted-foreground">Since Last Month</span>
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                <ArrowDownRight className="h-3 w-3 mr-0.5" /> -3.2%
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Net Profit */}
        <Card className="rounded-3xl border-border/50 shadow-sm overflow-hidden bg-gradient-to-br from-background to-emerald-50/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-foreground">Net Profit</h3>
              <div className="h-8 w-8 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-100">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-emerald-700 font-mono tracking-tight">
              {isSummaryLoading ? "..." : formatPKR(netProfit)}
            </div>
            <div className="flex items-center mt-3 gap-2">
              <span className="text-xs text-muted-foreground">Take-home revenue</span>
            </div>
          </CardContent>
        </Card>

        {/* Pending Invoices */}
        <Card className="rounded-3xl border-border/50 shadow-sm overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-foreground">Pending Invoices</h3>
              <div className="h-8 w-8 rounded-full bg-amber-50 flex items-center justify-center">
                <Clock className="h-4 w-4 text-amber-500" />
              </div>
            </div>
            <div className="text-3xl font-bold text-foreground font-mono tracking-tight flex items-baseline gap-2">
              {isSummaryLoading ? "..." : pendingInvoices}
              <span className="text-sm font-medium text-muted-foreground font-sans">total</span>
            </div>
            <div className="flex items-center mt-3 gap-2">
              <span className="text-xs text-muted-foreground">Requires attention</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transactions Section */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="rounded-3xl border-border/50 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-6 pb-2">
              <h3 className="text-lg font-bold text-foreground">Transactions</h3>
              <select className="text-sm font-medium bg-transparent text-foreground focus:outline-none cursor-pointer">
                <option>Monthly</option>
                <option>Weekly</option>
              </select>
            </div>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground bg-background border-b border-border/50">
                    <tr>
                      <th className="px-6 py-4 font-medium">Name</th>
                      <th className="px-6 py-4 font-medium">Type</th>
                      <th className="px-6 py-4 font-medium">Date</th>
                      <th className="px-6 py-4 font-medium text-right">Amount</th>
                      <th className="px-6 py-4 font-medium text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {isTxLoading ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">Loading transactions...</td>
                      </tr>
                    ) : recentTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No recent transactions found.</td>
                      </tr>
                    ) : (
                      recentTransactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-muted/30 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-primary font-bold text-xs shrink-0">
                                {tx.entity.substring(0, 2).toUpperCase()}
                              </div>
                              <span className="font-semibold text-foreground">{tx.entity}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-muted-foreground">
                            {tx.category || (tx.type === 'INCOME' ? 'Income' : 'Withdrawal')}
                          </td>
                          <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                            {new Date(tx.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="px-6 py-4 text-right font-mono font-medium">
                            {tx.type === 'INCOME' ? (
                              <span className="text-foreground">
                                + {formatPKR(tx.amount)}
                              </span>
                            ) : (
                              <span className="text-foreground">
                                - {formatPKR(tx.amount)}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <Link href="/transactions">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-lg leading-none pb-2">...</span>
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Quick Actions */}
        <div className="space-y-6">
          <Card className="rounded-3xl border-border/50 shadow-sm overflow-hidden">
             <CardContent className="p-6">
               <h3 className="text-sm font-bold text-foreground mb-4">Quick Actions</h3>
               <div className="space-y-3">
                 <Link href="/invoices/new" className="block">
                   <Button variant="outline" className="w-full justify-start rounded-xl h-11 text-muted-foreground hover:text-foreground hover:bg-muted/50 border-border/50">
                     <FileText className="h-4 w-4 mr-3 text-emerald-600" />
                     Create New Invoice
                   </Button>
                 </Link>
                 <Link href="/expenses" className="block">
                   <Button variant="outline" className="w-full justify-start rounded-xl h-11 text-muted-foreground hover:text-foreground hover:bg-muted/50 border-border/50">
                     <Wallet className="h-4 w-4 mr-3 text-rose-500" />
                     Log an Expense
                   </Button>
                 </Link>
                 <Link href="/clients" className="block">
                   <Button variant="outline" className="w-full justify-start rounded-xl h-11 text-muted-foreground hover:text-foreground hover:bg-muted/50 border-border/50">
                     <Plus className="h-4 w-4 mr-3 text-blue-500" />
                     Add New Client
                   </Button>
                 </Link>
               </div>
             </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
