"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Upload, Sparkles } from 'lucide-react';
import { formatPKR, formatUSD } from '@/lib/utils';
import { useIncome } from '@/hooks/use-income';
import { CSVImportModal } from '@/components/features/csv-import-modal';

export default function IncomePage() {
  const { data: incomeList = [], isLoading } = useIncome();
  const [isImportOpen, setIsImportOpen] = useState(false);

  const displayIncome = incomeList.length > 0 ? incomeList : [
    { id: "1", receivedAt: "2026-08-07", clientName: "TechFlow Inc.", platform: "upwork", amount: 1000, currency: "USD", amountPKR: 280500, description: "Upwork Withdrawal to Meezan Bank" },
    { id: "2", receivedAt: "2026-08-04", clientName: "Jane Smith", platform: "fiverr", amount: 500, currency: "USD", amountPKR: 140000, description: "Fiverr Direct Clearing" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-100">Income Logs</h1>
          <p className="text-sm text-slate-400 mt-1">Track foreign remittances and local earnings with automated PKR conversion.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            onClick={() => setIsImportOpen(true)}
            variant="outline" 
            className="border-slate-800 bg-slate-900 text-slate-200 hover:bg-slate-800"
          >
            <Sparkles className="mr-2 h-4 w-4 text-emerald-400" /> Auto-Import Upwork/Fiverr CSV
          </Button>
          <Button className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold shadow-lg shadow-emerald-500/20">
            <Plus className="mr-2 h-4 w-4" /> Log Income Manually
          </Button>
        </div>
      </div>

      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
        <Table>
          <TableHeader className="bg-slate-900/80">
            <TableRow className="border-slate-800">
              <TableHead className="text-slate-300">Date</TableHead>
              <TableHead className="text-slate-300">Description / Client</TableHead>
              <TableHead className="text-slate-300">Platform</TableHead>
              <TableHead className="text-slate-300">Original Amount</TableHead>
              <TableHead className="text-slate-300">Converted Amount (PKR)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-slate-400">Loading income logs...</TableCell>
              </TableRow>
            ) : (
              displayIncome.map((inc: any) => (
                <TableRow key={inc.id} className="border-slate-800 hover:bg-slate-800/40">
                  <TableCell className="text-slate-400 text-xs font-mono">{inc.receivedAt ? String(inc.receivedAt).substring(0, 10) : "2026-08-07"}</TableCell>
                  <TableCell className="font-medium text-slate-100">{inc.description || inc.clientName || "Direct Transfer"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                      {inc.platform || "upwork"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-200 font-medium font-mono">
                    {inc.currency === "USD" ? formatUSD(inc.amount) : `${inc.currency || 'USD'} ${inc.amount}`}
                  </TableCell>
                  <TableCell className="font-bold text-emerald-400 font-mono">{formatPKR(inc.amountPKR || 0)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CSVImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} />
    </div>
  );
}
