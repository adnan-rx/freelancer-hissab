"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Pencil, Check, Loader2 } from "lucide-react";
import { useTaxRules, useCreateTaxRule, useUpdateTaxRule, useDeleteTaxRule } from "@/hooks/use-tax";
import { useQueryClient } from "@tanstack/react-query";

export function TaxRulesTab() {
  const { data: rules, isLoading } = useTaxRules();
  const createRuleMutation = useCreateTaxRule();
  const updateRuleMutation = useUpdateTaxRule();
  const deleteRuleMutation = useDeleteTaxRule();
  const queryClient = useQueryClient();

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [taxYear, setTaxYear] = useState("2026-27");
  const [incomeType, setIncomeType] = useState("IT_EXPORT_PSEB");
  const [rate, setRate] = useState("0.01");
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  const resetForm = () => {
    setTaxYear("2026-27");
    setIncomeType("IT_EXPORT_PSEB");
    setRate("0.01");
    setEffectiveFrom(new Date().toISOString().split("T")[0]);
    setNotes("");
    setIsAdding(false);
    setEditingId(null);
  };

  const startEdit = (rule: any) => {
    setTaxYear(rule.taxYear);
    setIncomeType(rule.incomeType);
    setRate(rule.rate);
    setEffectiveFrom(rule.effectiveFrom ? String(rule.effectiveFrom).substring(0, 10) : "");
    setNotes(rule.notes || "");
    setEditingId(rule.id);
    setIsAdding(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      taxYear,
      incomeType,
      rate: parseFloat(rate),
      effectiveFrom,
      notes,
    };

    if (editingId) {
      await updateRuleMutation.mutateAsync({ id: editingId, data: payload });
    } else {
      await createRuleMutation.mutateAsync(payload);
    }
    
    queryClient.invalidateQueries({ queryKey: ["tax-rules"] });
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this tax rule?")) {
      await deleteRuleMutation.mutateAsync(id);
      queryClient.invalidateQueries({ queryKey: ["tax-rules"] });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg font-bold text-foreground">Tax Rules Configuration</CardTitle>
          <CardDescription>Manage the underlying tax slabs and export rates for the platform.</CardDescription>
        </div>
        {!isAdding && (
          <Button onClick={() => setIsAdding(true)} size="sm">
            <Plus className="mr-2 h-4 w-4" /> Add Rule
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {isAdding && (
          <div className="p-4 border border-border rounded-xl bg-muted/30">
            <h3 className="text-sm font-bold mb-4">{editingId ? "Edit Tax Rule" : "Create New Tax Rule"}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Tax Year (e.g. 2026-27)</label>
                  <Input value={taxYear} onChange={(e) => setTaxYear(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Income Type</label>
                  <Select value={incomeType} onValueChange={setIncomeType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="IT_EXPORT_PSEB">IT Export (PSEB)</SelectItem>
                      <SelectItem value="IT_EXPORT_STANDARD">IT Export (Standard)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Rate (e.g. 0.01 for 1%)</label>
                  <Input type="number" step="0.0001" value={rate} onChange={(e) => setRate(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Effective From</label>
                  <Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} required />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Notes</label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Budget 2026 update" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={resetForm}>Cancel</Button>
                <Button type="submit" disabled={createRuleMutation.isPending || updateRuleMutation.isPending}>
                  {createRuleMutation.isPending || updateRuleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                  Save Rule
                </Button>
              </div>
            </form>
          </div>
        )}

        <div className="border border-border rounded-xl overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Tax Year</TableHead>
                <TableHead>Income Type</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead>Effective From</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Loading rules...</TableCell></TableRow>
              ) : rules?.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No tax rules configured.</TableCell></TableRow>
              ) : (
                rules?.map((rule: any) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">{rule.taxYear}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{rule.incomeType}</TableCell>
                    <TableCell className="text-right font-mono text-destructive">{(Number(rule.rate) * 100).toFixed(2)}%</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{rule.effectiveFrom ? String(rule.effectiveFrom).substring(0, 10) : "N/A"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(rule)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDelete(rule.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
