"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateExpense, useUpdateExpense, EXPENSE_CATEGORIES } from "@/hooks/use-expenses";
import { apiErrorMessage } from "@/lib/utils";
import { useToast } from "@/providers/toast-provider";

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Pass an existing expense to edit it instead of creating a new one. */
  expense?: any | null;
}

export function AddExpenseModal({ isOpen, onClose, expense }: AddExpenseModalProps) {
  const createExpenseMutation = useCreateExpense();
  const updateExpenseMutation = useUpdateExpense();
  const { showSuccess } = useToast();
  const isEditing = !!expense?.id;

  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [vendor, setVendor] = useState("");
  const [category, setCategory] = useState("software");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("PKR");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [error, setError] = useState<string | null>(null);

  // Reload the form whenever the modal opens, so a previous edit never leaks into a new entry.
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setExpenseDate(expense?.expenseDate ? String(expense.expenseDate).substring(0, 10) : new Date().toISOString().split("T")[0]);
    setDescription(expense?.description || "");
    setVendor(expense?.vendor || "");
    setCategory(expense?.category || "software");
    setAmount(expense?.amount ? String(expense.amount) : "");
    setCurrency(expense?.currency || "PKR");
    setPaymentMethod(expense?.paymentMethod || "bank_transfer");
  }, [isOpen, expense]);

  const isPending = createExpenseMutation.isPending || updateExpenseMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseFloat(amount);
    if (!amount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }

    const payload = {
      expenseDate,
      description: description.trim() || "Business Expense",
      vendor: vendor.trim() || undefined,
      category,
      amount: parsedAmount,
      currency,
      paymentMethod,
    };

    try {
      if (isEditing) {
        await updateExpenseMutation.mutateAsync({ id: expense.id, ...payload });
        showSuccess("Expense updated.", "Expense updated");
      } else {
        await createExpenseMutation.mutateAsync(payload);
        showSuccess(`"${payload.description}" logged.`, "Expense added");
      }
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to save the expense."));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit expense" : "Add expense"}</DialogTitle>
          <DialogDescription>Deductible costs reduce the taxable portion of your local income.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="contents">
          <DialogBody className="space-y-4">
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-md border border-destructive/15 bg-destructive-surface p-3 text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Date" htmlFor="exp-date" required>
                <Input
                  id="exp-date"
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  required
                />
              </Field>

              <Field label="Category" htmlFor="exp-category">
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="exp-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field label="Description" htmlFor="exp-desc" required>
              <Input
                id="exp-desc"
                placeholder="Monthly internet bill"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                required
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Vendor" htmlFor="exp-vendor">
                <Input
                  id="exp-vendor"
                  placeholder="Nayatel, Adobe, AWS…"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  maxLength={255}
                />
              </Field>

              <Field label="Paid via" htmlFor="exp-method">
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger id="exp-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                    <SelectItem value="credit_card">Credit card</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="e_wallet">E-wallet</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Amount" htmlFor="exp-amount" required>
                <Input
                  id="exp-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="4500"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className="font-mono tabular-nums"
                />
              </Field>

              <Field
                label="Currency"
                htmlFor="exp-currency"
                hint={currency !== "PKR" ? "Converted to PKR at the market rate when saved." : undefined}
              >
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger id="exp-currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PKR">PKR (Rs)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="animate-spin" />}
              {isEditing ? "Save changes" : "Add expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
