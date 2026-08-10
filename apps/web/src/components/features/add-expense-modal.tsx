"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Check, Wallet, AlertCircle } from "lucide-react";
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

  if (!isOpen) return null;

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
        showSuccess("Expense updated.", "Expense Updated");
      } else {
        await createExpenseMutation.mutateAsync(payload);
        showSuccess(`"${payload.description}" logged.`, "Expense Added");
      }
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to save the expense."));
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-destructive" />
            <h2 className="text-xl font-bold text-foreground">
              {isEditing ? "Edit Business Expense" : "Add Business Expense"}
            </h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" type="button">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Expense Date *</label>
              <Input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                required
                className="bg-background border-input text-foreground"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-10 px-3 rounded-md bg-background border border-input text-foreground text-sm focus:border-destructive focus:outline-none"
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Description *</label>
            <Input
              placeholder="e.g. Nayatel Monthly Internet Bill"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              required
              className="bg-background border-input text-foreground"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Vendor / Company</label>
              <Input
                placeholder="e.g. Nayatel / Adobe / AWS"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                maxLength={255}
                className="bg-background border-input text-foreground"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full h-10 px-3 rounded-md bg-background border border-input text-foreground text-sm focus:border-destructive focus:outline-none"
              >
                <option value="bank_transfer">Bank Transfer</option>
                <option value="credit_card">Credit Card</option>
                <option value="cash">Cash</option>
                <option value="e_wallet">E-Wallet</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Amount *</label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="4500"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="bg-background border-input text-foreground font-mono"
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full h-10 px-3 rounded-md bg-background border border-input text-foreground text-sm focus:border-destructive focus:outline-none"
              >
                <option value="PKR">PKR (Rs.)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>
          </div>

          {currency !== "PKR" && (
            <p className="text-[11px] text-muted-foreground">
              Converted to PKR at the current market rate when saved.
            </p>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} variant="destructive">
              <Check className="mr-1.5 h-4 w-4" />
              {isPending ? "Saving..." : isEditing ? "Update Expense" : "Save Expense"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
