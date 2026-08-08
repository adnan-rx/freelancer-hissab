"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Search, Eye, FileText, CheckCircle2, Clock, DollarSign } from 'lucide-react';
import Link from 'next/link';
import { formatPKR, formatUSD } from '@/lib/utils';
import { useInvoices } from '@/hooks/use-invoices';

export default function InvoicesPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const { data: invoicesList = [], isLoading } = useInvoices(statusFilter === "all" ? undefined : statusFilter);

  const rawList = invoicesList;
  
  const displayInvoices = rawList.filter((inv: any) => {
    const matchesStatus = statusFilter === "all" || inv.status === statusFilter;
    const clientName = inv.client?.name || inv.clientName || "";
    const matchesSearch = inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) || clientName.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const totalBilledPKR = rawList.reduce((sum: number, inv: any) => sum + Number(inv.totalPKR || 0), 0);
  const totalPaidPKR = rawList.filter((inv: any) => inv.status === "paid").reduce((sum: number, inv: any) => sum + Number(inv.totalPKR || 0), 0);
  const pendingAmountPKR = totalBilledPKR - totalPaidPKR;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-100">Invoices</h1>
          <p className="text-sm text-slate-400 mt-1">Generate, track, and export professional freelancer invoices.</p>
        </div>
        <Button asChild className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold shadow-lg shadow-emerald-500/20">
          <Link href="/invoices/new"><Plus className="mr-2 h-4 w-4" /> Create New Invoice</Link>
        </Button>
      </div>

      {/* Metrics Banner */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-slate-900/60 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Total Invoiced (PKR)</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-50">{formatPKR(totalBilledPKR)}</div>
            <p className="text-xs text-slate-400 mt-1">Gross Invoiced Revenue</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Collected Remittances</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400">{formatPKR(totalPaidPKR)}</div>
            <p className="text-xs text-emerald-400 mt-1 font-medium">Paid into Meezan / Bank Account</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Outstanding Balance</CardTitle>
            <Clock className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-400">{formatPKR(pendingAmountPKR)}</div>
            <p className="text-xs text-amber-400 mt-1 font-medium">Pending or Overdue</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto">
          {["all", "draft", "sent", "paid", "overdue"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                statusFilter === st 
                  ? "bg-emerald-500 text-slate-950 shadow" 
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <Input 
            placeholder="Search by invoice # or client..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-slate-900 border-slate-800 text-slate-100 placeholder:text-slate-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
        <Table>
          <TableHeader className="bg-slate-900/80">
            <TableRow className="border-slate-800">
              <TableHead className="text-slate-300">Invoice Number</TableHead>
              <TableHead className="text-slate-300">Client</TableHead>
              <TableHead className="text-slate-300">Due Date</TableHead>
              <TableHead className="text-slate-300">Billed Amount</TableHead>
              <TableHead className="text-slate-300">Converted (PKR)</TableHead>
              <TableHead className="text-slate-300">Status</TableHead>
              <TableHead className="text-right text-slate-300">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-slate-400">Loading invoices...</TableCell>
              </TableRow>
            ) : displayInvoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-slate-400">No invoices match your filter criteria.</TableCell>
              </TableRow>
            ) : (
              displayInvoices.map((inv: any) => (
                <TableRow key={inv.id} className="border-slate-800 hover:bg-slate-800/40 transition-colors">
                  <TableCell className="font-medium text-emerald-400">
                    <Link href={`/invoices/${inv.id}`} className="hover:underline flex items-center gap-1.5 font-mono">
                      <FileText className="h-4 w-4" /> {inv.invoiceNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="text-slate-200 font-medium">
                    {inv.client?.name || inv.clientName || "Direct Client"}
                  </TableCell>
                  <TableCell className="text-slate-400 text-xs font-mono">{inv.dueDate || "2026-08-30"}</TableCell>
                  <TableCell className="font-medium text-slate-100">
                    {inv.currency === "USD" ? formatUSD(inv.total) : `${inv.currency || 'USD'} ${inv.total}`}
                  </TableCell>
                  <TableCell className="font-bold text-emerald-400 font-mono">
                    {formatPKR(inv.totalPKR || 0)}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant="outline" 
                      className={`capitalize ${
                        inv.status === "paid" 
                          ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10" 
                          : inv.status === "overdue"
                          ? "border-rose-500/30 text-rose-400 bg-rose-500/10"
                          : "border-blue-500/30 text-blue-400 bg-blue-500/10"
                      }`}
                    >
                      {inv.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="ghost" className="text-slate-300 hover:text-emerald-400 hover:bg-slate-800">
                      <Link href={`/invoices/${inv.id}`}>
                        <Eye className="mr-1.5 h-3.5 w-3.5" /> Export PDF
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
