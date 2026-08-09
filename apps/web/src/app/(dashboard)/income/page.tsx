"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Sparkles, Trash2, DollarSign, Pencil } from 'lucide-react';
import { formatPKR, formatUSD } from '@/lib/utils';
import { useIncome, useDeleteIncome } from '@/hooks/use-income';
import { CSVImportModal } from '@/components/features/csv-import-modal';
import { AddIncomeModal } from '@/components/features/add-income-modal';
import { EvidenceVaultModal } from '@/components/features/evidence-vault-modal';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { Toast } from '@/components/ui/toast';

export default function IncomePage() {
  const { data: incomeList = [], isLoading } = useIncome();
  const deleteIncomeMutation = useDeleteIncome();

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<any | null>(null);
  const [evidenceTarget, setEvidenceTarget] = useState<{ id: string; title: string } | null>(null);

  // Modal & Toast States
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; description: string } | null>(null);
  const [toast, setToast] = useState<{ type: 'error' | 'success'; title?: string; message: string } | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  const displayIncome = incomeList.filter((inc: any) => {
    if (sourceFilter === "all") return true;
    const isForeign = !!inc.prcReferenceNumber || (inc.platform && inc.platform !== "direct");
    if (sourceFilter === "foreign") return isForeign;
    if (sourceFilter === "local") return !isForeign;
    return true;
  });

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
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Income Logs</h1>
          <p className="text-sm text-muted-foreground mt-1">Track foreign remittances and local earnings with automated PKR conversion.</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="foreign">Foreign / Remittance</SelectItem>
              <SelectItem value="local">Local Income</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            onClick={() => setIsImportOpen(true)}
            variant="outline" 
          >
            <Sparkles className="mr-2 h-4 w-4 text-primary" /> Auto-Import CSV
          </Button>
          <Button 
            onClick={() => { setEditingIncome(null); setIsAddOpen(true); }}
          >
            <Plus className="mr-2 h-4 w-4" /> Log Income
          </Button>
        </div>
      </div>

      <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="border-border">
              <TableHead className="text-muted-foreground font-medium">Date</TableHead>
              <TableHead className="text-muted-foreground font-medium">Description / Client</TableHead>
              <TableHead className="text-muted-foreground font-medium">Platform</TableHead>
              <TableHead className="text-muted-foreground font-medium">Original Amount</TableHead>
              <TableHead className="text-muted-foreground font-medium">Converted Amount (PKR)</TableHead>
              <TableHead className="text-right text-muted-foreground font-medium">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading income logs...</TableCell>
              </TableRow>
            ) : displayIncome.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <DollarSign className="h-8 w-8 text-muted-foreground/60" />
                    <p className="font-semibold text-foreground">No income entries recorded yet</p>
                    <p className="text-xs text-muted-foreground">Log manual foreign income or upload bank statements to start tracking.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              displayIncome.map((inc: any) => (
                <TableRow key={inc.id} className="transition-colors">
                  <TableCell className="text-muted-foreground text-xs font-mono">{inc.receivedAt ? String(inc.receivedAt).substring(0, 10) : "N/A"}</TableCell>
                  <TableCell className="font-medium text-foreground">{inc.description || inc.clientName || "Direct Transfer"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize border-primary/30 text-primary bg-primary/10 font-medium">
                      {inc.platform || "upwork"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-foreground font-medium font-mono">
                    {inc.currency === "USD" ? formatUSD(inc.amount) : `${inc.currency || 'USD'} ${inc.amount}`}
                  </TableCell>
                  <TableCell className="font-bold text-primary font-mono">{formatPKR(inc.amountPKR || 0)}</TableCell>
                  <TableCell className="text-right flex items-center justify-end gap-1">
                    <Button
                      onClick={() => { setEditingIncome(inc); setIsAddOpen(true); }}
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
                      title="Edit Income Entry"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button 
                      onClick={() => setEvidenceTarget({ id: inc.id, title: inc.description || "Income Entry" })} 
                      size="sm" 
                      variant="outline" 
                      className="h-8 text-xs font-semibold rounded-lg hover:text-primary transition-colors"
                    >
                      Evidence
                    </Button>
                    <Button 
                      onClick={() => setDeleteTarget({ id: inc.id, description: inc.description || "Income Entry" })} 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-muted transition-colors" 
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
      <AddIncomeModal
        isOpen={isAddOpen}
        onClose={() => { setIsAddOpen(false); setEditingIncome(null); }}
        income={editingIncome}
      />
      
      <EvidenceVaultModal 
        isOpen={!!evidenceTarget} 
        onClose={() => setEvidenceTarget(null)} 
        recordId={evidenceTarget?.id || null} 
        recordType="income"
        recordTitle={evidenceTarget?.title}
      />

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
