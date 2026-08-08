"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, FileText, ArrowUpRight, ArrowDownRight, Users, Wallet } from 'lucide-react';
import { formatPKR } from '@/lib/utils';
import { useDashboardSummary } from '@/hooks/use-dashboard';

export default function DashboardPage() {
  const { data: summary, isLoading } = useDashboardSummary();

  const totalIncome = summary?.totalIncome ?? 0;
  const totalExpenses = summary?.totalExpenses ?? 0;
  const netProfit = summary?.netProfit ?? (totalIncome - totalExpenses);
  const pendingInvoices = summary?.pendingInvoices ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">Real-time financial summary for your freelancing business.</p>
        </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Income (PKR)</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground font-mono">
              {isLoading ? "Loading..." : formatPKR(totalIncome)}
            </div>
            <p className="text-xs flex items-center text-primary mt-1 font-medium">
              <ArrowUpRight className="h-4 w-4 mr-1" />
              +12.5% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
            <Wallet className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground font-mono">
              {isLoading ? "Loading..." : formatPKR(totalExpenses)}
            </div>
            <p className="text-xs flex items-center text-destructive mt-1 font-medium">
              <ArrowDownRight className="h-4 w-4 mr-1" />
              Operational costs
            </p>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-secondary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Net Profit</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary font-mono">
              {isLoading ? "Loading..." : formatPKR(netProfit)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Take-home revenue
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Invoices</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground font-mono">
              {isLoading ? "Loading..." : pendingInvoices}
            </div>
            <p className="text-xs text-amber-600 mt-1 font-medium">
              Requires attention
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
