"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Sparkles, Trash2, DollarSign } from 'lucide-react';
import { formatPKR, formatUSD } from '@/lib/utils';
import { useIncome, useDeleteIncome } from '@/hooks/use-income';
import { CSVImportModal } from '@/components/features/csv-import-modal';
import { AddIncomeModal } from '@/components/features/add-income-modal';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { Toast } from '@/components/ui/toast';

export default function IncomePage() {
  const { data: incomeList = [], isLoading } = useIncome();
  const deleteIncomeMutation = useDeleteIncome();

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Modal & Toast States
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; description: string } | null>(null);
  const [toast, setToast] = useState<{ type: 'error' | 'success'; title?: string; message: string } | null>(null);

  const displayIncome = incomeList;

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteIncomeMutation.mutateAsync(deleteTarget.id);
      setToast({
        type: "success",
        title: "Income Entry Deleted",
        message: "Income log has been removed from database.",
      });
      setDeleteTarget(null);
    } catch (err: any) {
      console.warn("Delete income error:", err);
      const apiErr = err?.response?.data?.error;
      setToast({
        type: "error",
        title: "Delete Failed",
        message: apiErr?.message || "Could not delete income log.",
      });
      setDeleteTarget(null);
    }
  };

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
          <Button 
            onClick={() => setIsAddOpen(true)}
            className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold shadow-lg shadow-emerald-500/20"
          >
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
              <TableHead className="text-right text-slate-300">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-slate-400">Loading income logs...</TableCell>
              </TableRow>
            ) : displayIncome.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-slate-400">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <DollarSign className="h-8 w-8 text-slate-600" />
                    <p className="font-semibold text-slate-300">No income entries recorded yet</p>
                    <p className="text-xs text-slate-500">Log manual foreign income or upload bank statements to start tracking.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              displayIncome.map((inc: any) => (
                <TableRow key={inc.id} className="border-slate-800 hover:bg-slate-800/40 transition-colors">
                  <TableCell className="text-slate-400 text-xs font-mono">{inc.receivedAt ? String(inc.receivedAt).substring(0, 10) : "N/A"}</TableCell>
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
                  <TableCell className="text-right">
                    <Button 
                      onClick={() => setDeleteTarget({ id: inc.id, description: inc.description || "Income Entry" })} 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8 text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors" 
                      title="Delete Income Entry"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CSVImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} />
      <AddIncomeModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} />

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Income Record?"
        description={deleteTarget ? `Are you sure you want to delete "${deleteTarget.description}"? This action will remove the record from your income logs.` : ""}
        confirmText="Delete Income"
        isLoading={deleteIncomeMutation.isPending}
      />

      {toast && (
        <Toast 
          type={toast.type} 
          title={toast.title} 
          message={toast.message} 
          onClose={() => setToast(null)} 
        />
      )}
    </div>
  );
}
