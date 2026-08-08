"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { formatPKR } from '@/lib/utils';
import { useExpenses } from '@/hooks/use-expenses';
import { AddExpenseModal } from '@/components/features/add-expense-modal';

export default function ExpensesPage() {
  const { data: expensesList = [], isLoading } = useExpenses();
  const [isAddOpen, setIsAddOpen] = useState(false);

  const displayExpenses = expensesList;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Expenses</h1>
          <p className="text-sm text-muted-foreground mt-1">Track business expenses, internet bills, hardware, and subscriptions.</p>
        </div>
        <Button onClick={() => setIsAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Expense
        </Button>
      </div>

      <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="border-border">
              <TableHead className="text-muted-foreground font-medium">Date</TableHead>
              <TableHead className="text-muted-foreground font-medium">Description / Vendor</TableHead>
              <TableHead className="text-muted-foreground font-medium">Category</TableHead>
              <TableHead className="text-muted-foreground font-medium text-right">Amount (PKR)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Loading expenses...</TableCell>
              </TableRow>
            ) : (
              displayExpenses.map((exp: any) => (
                <TableRow key={exp.id} className="transition-colors">
                  <TableCell className="text-muted-foreground">{exp.expenseDate ? String(exp.expenseDate).substring(0, 10) : "2026-08-10"}</TableCell>
                  <TableCell className="font-medium text-foreground">
                    {exp.description} {exp.vendor ? <span className="text-xs text-muted-foreground ml-1">({exp.vendor})</span> : null}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">
                      {exp.category || "other"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-bold text-destructive text-right">{formatPKR(exp.amount || 0)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AddExpenseModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} />
    </div>
  );
}
