"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Search, Loader2, ArrowUpRight, ArrowDownRight, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTransactions, TransactionType } from "@/hooks/use-transactions";

export default function TransactionsPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'ALL'>('ALL');
  
  // Debounce search state could be added here for a large app, but for now we pass it directly
  const { data: transactions, isLoading } = useTransactions(search, typeFilter);

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-100">Unified Ledger</h1>
          <p className="text-sm text-slate-400 mt-1">
            Track all your business income and expenses chronologically in one place.
          </p>
        </div>
      </div>

      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="border-b border-slate-800/50 pb-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <CardTitle className="text-lg font-bold text-slate-100 hidden md:block">Transaction Feed</CardTitle>
            
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                <Input
                  type="text"
                  placeholder="Search entity, description..."
                  className="pl-9 bg-slate-950 border-slate-800 text-slate-200"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              
              <div className="relative">
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as TransactionType | 'ALL')}
                  className="appearance-none bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-md px-3 py-2 pr-8 focus:outline-none focus:border-emerald-500"
                >
                  <option value="ALL">All Types</option>
                  <option value="INCOME">Income Only</option>
                  <option value="EXPENSE">Expenses Only</option>
                </select>
                <Filter className="absolute right-2.5 top-2.5 h-4 w-4 text-slate-500 pointer-events-none" />
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-950/50">
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="text-slate-400 font-medium py-4 pl-6">Date</TableHead>
                  <TableHead className="text-slate-400 font-medium py-4">Entity</TableHead>
                  <TableHead className="text-slate-400 font-medium py-4">Description</TableHead>
                  <TableHead className="text-slate-400 font-medium py-4">Category</TableHead>
                  <TableHead className="text-slate-400 font-medium py-4 text-right pr-6">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center">
                      <Loader2 className="h-6 w-6 animate-spin text-emerald-500 mx-auto" />
                      <p className="text-sm text-slate-400 mt-2">Loading transactions...</p>
                    </TableCell>
                  </TableRow>
                ) : transactions?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center">
                      <p className="text-sm text-slate-400">No transactions found matching your criteria.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions?.map((tx) => {
                    const isIncome = tx.type === 'INCOME';
                    return (
                      <TableRow key={tx.id} className="border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                        <TableCell className="text-slate-300 whitespace-nowrap pl-6">
                          {format(new Date(tx.date), "MMM dd, yyyy")}
                        </TableCell>
                        <TableCell className="font-medium text-slate-200">
                          {tx.entity}
                        </TableCell>
                        <TableCell className="text-slate-400 max-w-[200px] truncate">
                          {tx.description}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="border-slate-700 text-slate-300 bg-slate-800/50">
                            {tx.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap pr-6">
                          <div className={`font-semibold flex items-center justify-end gap-1 ${isIncome ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isIncome ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                            {isIncome ? '+' : '-'} {tx.currency} {tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
