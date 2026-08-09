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
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Invoices</h1>
          <p className="text-sm text-muted-foreground mt-1">Generate, track, and export professional freelancer invoices.</p>
        </div>
        <Button asChild>
          <Link href="/invoices/new"><Plus className="mr-2 h-4 w-4" /> Create New Invoice</Link>
        </Button>
      </div>

      {/* Metrics Banner */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Total Invoiced (PKR)</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatPKR(totalBilledPKR)}</div>
            <p className="text-xs text-muted-foreground mt-1">Gross Invoiced Revenue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Collected Remittances</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{formatPKR(totalPaidPKR)}</div>
            <p className="text-xs text-primary mt-1 font-medium">Paid into Meezan / Bank Account</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Outstanding Balance</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">{formatPKR(pendingAmountPKR)}</div>
            <p className="text-xs text-amber-500 mt-1 font-medium">Pending or Overdue</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-card border border-border rounded-xl overflow-x-auto shadow-sm">
          {["all", "draft", "sent", "paid", "overdue"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                statusFilter === st 
                  ? "bg-primary text-primary-foreground shadow" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by invoice # or client..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-background border-border text-foreground"
          />
        </div>
      </div>

      {/* Table */}
      <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="border-border">
              <TableHead className="text-muted-foreground font-medium">Invoice Number</TableHead>
              <TableHead className="text-muted-foreground font-medium">Client</TableHead>
              <TableHead className="text-muted-foreground font-medium">Due Date</TableHead>
              <TableHead className="text-muted-foreground font-medium">Billed Amount</TableHead>
              <TableHead className="text-muted-foreground font-medium">Converted (PKR)</TableHead>
              <TableHead className="text-muted-foreground font-medium">Status</TableHead>
              <TableHead className="text-right text-muted-foreground font-medium">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading invoices...</TableCell>
              </TableRow>
            ) : displayInvoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No invoices match your filter criteria.</TableCell>
              </TableRow>
            ) : (
              displayInvoices.map((inv: any) => (
                <TableRow key={inv.id} className="transition-colors">
                  <TableCell className="font-medium text-primary">
                    <Link href={`/invoices/${inv.id}`} className="hover:underline flex items-center gap-1.5 font-mono">
                      <FileText className="h-4 w-4" /> {inv.invoiceNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="text-foreground font-medium">
                    {inv.client?.name || inv.clientName || "Direct Client"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs font-mono">{inv.dueDate || "—"}</TableCell>
                  <TableCell className="font-medium text-foreground">
                    {inv.currency === "USD" ? formatUSD(inv.total) : `${inv.currency || 'USD'} ${Number(inv.total || 0).toFixed(2)}`}
                  </TableCell>
                  <TableCell className="font-bold text-primary font-mono">
                    {formatPKR(inv.totalPKR || 0)}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant="outline" 
                      className={`capitalize ${
                        inv.status === "paid" 
                          ? "border-primary/30 text-primary bg-primary/10" 
                          : inv.status === "overdue"
                          ? "border-destructive/30 text-destructive bg-destructive/10"
                          : "border-blue-500/30 text-blue-500 bg-blue-500/10"
                      }`}
                    >
                      {inv.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="ghost" className="text-muted-foreground hover:text-primary hover:bg-muted">
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
