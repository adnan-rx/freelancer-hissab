"use client";

import { useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardTitle, CardToolbar } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { useTaxRules, useCreateTaxRule, useUpdateTaxRule, useDeleteTaxRule } from "@/hooks/use-tax";
import { useToast } from "@/providers/toast-provider";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { formatDate } from "@/lib/utils";
import { taxYearLabel } from "@/lib/tax-year";

export function TaxRulesTab() {
  const { data: rules, isLoading } = useTaxRules();
  const createRuleMutation = useCreateTaxRule();
  const updateRuleMutation = useUpdateTaxRule();
  const deleteRuleMutation = useDeleteTaxRule();
  const { showSuccess } = useToast();

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; taxYear: string; incomeType: string } | null>(null);

  // Form State
  const [taxYear, setTaxYear] = useState(taxYearLabel());
  const [incomeType, setIncomeType] = useState("IT_EXPORT_PSEB");
  const [rate, setRate] = useState("0.01");
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  const resetForm = () => {
    setTaxYear(taxYearLabel());
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

    // No try/catch: a failure here throws, skips resetForm below, and is
    // reported by the global mutation-error toast — this form previously had
    // no error handling of any kind, so a failed save looked identical to a
    // successful one.
    if (editingId) {
      await updateRuleMutation.mutateAsync({ id: editingId, data: payload });
      showSuccess("Tax rule updated.", "Rule updated");
    } else {
      await createRuleMutation.mutateAsync(payload);
      showSuccess("Tax rule created.", "Rule created");
    }

    resetForm();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteRuleMutation.mutateAsync(deleteTarget.id);
      showSuccess("Tax rule deleted.", "Rule deleted");
    } finally {
      // Closes the modal either way; a failure is already reported by the
      // global mutation-error toast.
      setDeleteTarget(null);
    }
  };

  const isSaving = createRuleMutation.isPending || updateRuleMutation.isPending;

  return (
    <Card className="overflow-hidden">
      <CardToolbar>
        <div className="space-y-1">
          <CardTitle>Tax rules</CardTitle>
          <CardDescription>Slabs and export rates applied across every account.</CardDescription>
        </div>
        {!isAdding && (
          <Button onClick={() => setIsAdding(true)} size="sm">
            <Plus /> Add rule
          </Button>
        )}
      </CardToolbar>

      {isAdding && (
        <div className="border-b border-border bg-muted/40 p-5 sm:p-6">
          <p className="mb-4 text-sm font-medium text-foreground">
            {editingId ? "Edit rule" : "New rule"}
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tax year" htmlFor="rule-year" required hint="Format: 2026-27">
                <Input id="rule-year" value={taxYear} onChange={(e) => setTaxYear(e.target.value)} required className="font-mono" />
              </Field>
              <Field label="Income type" htmlFor="rule-type">
                <Select value={incomeType} onValueChange={setIncomeType}>
                  <SelectTrigger id="rule-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IT_EXPORT_PSEB">IT export (PSEB)</SelectItem>
                    <SelectItem value="IT_EXPORT_STANDARD">IT export (standard)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Rate" htmlFor="rule-rate" required hint="As a decimal — 0.01 means 1%.">
                <Input
                  id="rule-rate"
                  type="number"
                  step="0.0001"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  required
                  className="font-mono tabular-nums"
                />
              </Field>
              <Field label="Effective from" htmlFor="rule-from" required>
                <Input
                  id="rule-from"
                  type="date"
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                  required
                />
              </Field>
            </div>

            <Field label="Notes" htmlFor="rule-notes">
              <Input
                id="rule-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Budget 2026 update"
              />
            </Field>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={resetForm}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="animate-spin" />} Save rule
              </Button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <TableSkeleton rows={4} columns={5} />
      ) : rules?.length === 0 ? (
        <EmptyState
          title="No tax rules configured"
          description="Add a rule so tax estimates use a rate rather than falling back."
          action={
            <Button size="sm" onClick={() => setIsAdding(true)}>
              <Plus /> Add rule
            </Button>
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tax year</TableHead>
              <TableHead>Income type</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead>Effective from</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules?.map((rule: any) => (
              <TableRow key={rule.id}>
                <TableCell className="font-mono font-medium tabular-nums text-foreground">{rule.taxYear}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{rule.incomeType}</TableCell>
                <TableCell className="text-right font-mono text-sm font-medium tabular-nums text-foreground">
                  {(Number(rule.rate) * 100).toFixed(2)}%
                </TableCell>
                <TableCell className="text-muted-foreground tabular">
                  {rule.effectiveFrom ? formatDate(String(rule.effectiveFrom).substring(0, 10)) : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <span className="flex items-center justify-end gap-0.5">
                    <Button size="icon-sm" variant="ghost" onClick={() => startEdit(rule)} title="Edit rule">
                      <Pencil />
                      <span className="sr-only">Edit {rule.taxYear} rule</span>
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="hover:bg-destructive-surface hover:text-destructive"
                      onClick={() => setDeleteTarget({ id: rule.id, taxYear: rule.taxYear, incomeType: rule.incomeType })}
                      title="Delete rule"
                    >
                      <Trash2 />
                      <span className="sr-only">Delete {rule.taxYear} rule</span>
                    </Button>
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Delete this tax rule?"
        description={
          deleteTarget
            ? `The ${deleteTarget.taxYear} rule for ${deleteTarget.incomeType} will be removed. This changes tax calculations for every account.`
            : ""
        }
        confirmText="Delete rule"
        isLoading={deleteRuleMutation.isPending}
      />
    </Card>
  );
}
