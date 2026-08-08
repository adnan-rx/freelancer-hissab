"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Check, Wallet } from "lucide-react";
import { useCreateExpense } from "@/hooks/use-expenses";

export function AddExpenseModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const createExpenseMutation = useCreateExpense();

  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [vendor, setVendor] = useState("");
  const [category, setCategory] = useState("software");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("PKR");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return;

    try {
      await createExpenseMutation.mutateAsync({
        expenseDate,
        description: description || "Business Expense",
        vendor: vendor || undefined,
        category,
        amount: parseFloat(amount),
        currency,
      });
      onClose();
    } catch (err) {
      console.warn("Failed to create expense log", err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-destructive" />
            <h2 className="text-xl font-bold text-foreground">Add Business Expense</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
                <option value="software">Software & Subscriptions</option>
                <option value="internet">Internet & Fiber Broadband</option>
                <option value="equipment">Hardware & Laptops</option>
                <option value="office">Co-working & Office Rent</option>
                <option value="taxes">FBR Taxes & Accounting</option>
                <option value="other">Other Operational Expenses</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Description *</label>
            <Input 
              placeholder="e.g. Nayatel Monthly Internet Bill" 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
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
                className="bg-background border-input text-foreground"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Amount *</label>
                <Input 
                  type="number" 
                  step="0.01" 
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
                  className="w-full h-10 px-2 rounded-md bg-background border border-input text-foreground text-sm focus:border-destructive focus:outline-none"
                >
                  <option value="PKR">PKR (Rs.)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createExpenseMutation.isPending} variant="destructive">
              <Check className="mr-1.5 h-4 w-4" /> Save Expense
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
