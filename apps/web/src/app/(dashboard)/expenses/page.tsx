"use client";

import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { formatPKR } from '@/lib/utils';
import { useExpenses } from '@/hooks/use-expenses';

export default function ExpensesPage() {
  const { data: expensesList = [], isLoading } = useExpenses();

  const displayExpenses = expensesList.length > 0 ? expensesList : [
    { id: "1", expenseDate: "2026-08-10", description: "Nayatel Monthly Internet Bill", category: "internet", amount: 4500, vendor: "Nayatel" },
    { id: "2", expenseDate: "2026-08-04", description: "Adobe Creative Cloud Subscription", category: "software", amount: 15000, vendor: "Adobe" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Expenses</h1>
          <p className="text-sm text-slate-400 mt-1">Track business expenses, internet bills, hardware, and subscriptions.</p>
        </div>
        <Button><Plus className="mr-2 h-4 w-4" /> Add Expense</Button>
      </div>

      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
        <Table>
          <TableHeader className="bg-slate-900/80">
            <TableRow className="border-slate-800">
              <TableHead>Date</TableHead>
              <TableHead>Description / Vendor</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Amount (PKR)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-slate-400">Loading expenses...</TableCell>
              </TableRow>
            ) : (
              displayExpenses.map((exp: any) => (
                <TableRow key={exp.id} className="border-slate-800 hover:bg-slate-800/40">
                  <TableCell className="text-slate-400">{exp.expenseDate ? String(exp.expenseDate).substring(0, 10) : "2026-08-10"}</TableCell>
                  <TableCell className="font-medium text-slate-100">
                    {exp.description} {exp.vendor ? <span className="text-xs text-slate-400">({exp.vendor})</span> : null}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">
                      {exp.category || "other"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-bold text-rose-400">{formatPKR(exp.amount || 0)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
