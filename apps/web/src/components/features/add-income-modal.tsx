"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Check, DollarSign, AlertCircle } from "lucide-react";
import { useCreateIncome, useUpdateIncome } from "@/hooks/use-income";
import { useClients } from "@/hooks/use-clients";
import { useExchangeRate } from "@/hooks/use-exchange-rate";
import { apiErrorMessage, formatPKR } from "@/lib/utils";

interface AddIncomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Pass an existing income record to edit it instead of creating a new one. */
  income?: any | null;
}

export function AddIncomeModal({ isOpen, onClose, income }: AddIncomeModalProps) {
  const createIncomeMutation = useCreateIncome();
  const updateIncomeMutation = useUpdateIncome();
  const { data: clientsList = [] } = useClients();
  const isEditing = !!income?.id;

  const [receivedAt, setReceivedAt] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState("");
  const [platform, setPlatform] = useState("upwork");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [sbpPurposeCode, setSbpPurposeCode] = useState("9100");
  const [prcReferenceNumber, setPrcReferenceNumber] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: liveRate } = useExchangeRate(currency);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setReceivedAt(income?.receivedAt ? String(income.receivedAt).substring(0, 10) : new Date().toISOString().split("T")[0]);
    setDescription(income?.description || "");
    setClientId(income?.clientId || "");
    setPlatform(income?.platform || "upwork");
    setAmount(income?.amount ? String(income.amount) : "");
    setCurrency(income?.currency || "USD");
    setSbpPurposeCode(income?.sbpPurposeCode || "9100");
    setPrcReferenceNumber(income?.prcReferenceNumber || "");
  }, [isOpen, income]);

  if (!isOpen) return null;

  const isPending = createIncomeMutation.isPending || updateIncomeMutation.isPending;
  const parsedAmount = parseFloat(amount);
  const previewPKR =
    Number.isFinite(parsedAmount) && parsedAmount > 0 && liveRate ? parsedAmount * liveRate : null;
  const isForeign = currency !== "PKR";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!amount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }

    const payload = {
      receivedAt,
      description: description.trim() || "Direct Income Payment",
      clientId: clientId || undefined,
      platform,
      amount: parsedAmount,
      currency,
      sbpPurposeCode: sbpPurposeCode.trim() || undefined,
      prcReferenceNumber: prcReferenceNumber.trim() || undefined,
    };

    try {
      if (isEditing) {
        await updateIncomeMutation.mutateAsync({ id: income.id, ...payload });
      } else {
        await createIncomeMutation.mutateAsync(payload);
      }
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to save the income entry."));
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold text-foreground">
              {isEditing ? "Edit Income Entry" : "Log Manual Foreign / Local Income"}
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
              <label className="text-xs font-semibold text-foreground">Date Received *</label>
              <Input
                type="date"
                value={receivedAt}
                onChange={(e) => setReceivedAt(e.target.value)}
                required
                className="bg-background border-input text-foreground"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Platform / Channel</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full h-10 px-3 rounded-md bg-background border border-input text-foreground text-sm focus:border-primary focus:outline-none"
              >
                <option value="upwork">Upwork Escrow</option>
                <option value="fiverr">Fiverr Orders</option>
                <option value="direct">Direct Bank Transfer / Wise</option>
                <option value="freelancer">Freelancer.com</option>
                <option value="other">Local PKR Client</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Transaction Description *</label>
            <Input
              placeholder="e.g. Web Development Milestone Payment"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              required
              className="bg-background border-input text-foreground"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Client Profile (Optional)</label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full h-10 px-3 rounded-md bg-background border border-input text-foreground text-sm focus:border-primary focus:outline-none"
              >
                <option value="">-- Select Client --</option>
                {clientsList.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.company || c.platform})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Amount *</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="1000"
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
                  className="w-full h-10 px-2 rounded-md bg-background border border-input text-foreground text-sm focus:border-primary focus:outline-none"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="PKR">PKR (Rs.)</option>
                </select>
              </div>
            </div>
          </div>

          {previewPKR !== null && (
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between text-xs">
              <span className="text-primary font-semibold">Converts to</span>
              <span className="font-bold text-primary font-mono">
                {formatPKR(previewPKR)}
                {isForeign && liveRate ? ` @ ${liveRate.toFixed(2)} PKR/${currency}` : ""}
              </span>
            </div>
          )}

          <div className="p-4 rounded-xl border border-border bg-muted/50 space-y-3">
            <h4 className="text-xs font-bold text-foreground">SBP PRC & Remittance Compliance</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground">SBP Purpose Code</label>
                <Input
                  value={sbpPurposeCode}
                  onChange={(e) => setSbpPurposeCode(e.target.value)}
                  className="bg-background border-input text-foreground text-xs font-mono"
                  placeholder="9100"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground">
                  Bank PRC Ref # {isForeign && <span className="text-amber-600">(needed to file)</span>}
                </label>
                <Input
                  value={prcReferenceNumber}
                  onChange={(e) => setPrcReferenceNumber(e.target.value)}
                  className="bg-background border-input text-foreground text-xs font-mono"
                  placeholder="PRC-2026-X1"
                />
              </div>
            </div>
            {isForeign && !prcReferenceNumber.trim() && (
              <p className="text-[11px] text-amber-600">
                Export income without a PRC reference will be flagged on your filing readiness score.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              <Check className="mr-1.5 h-4 w-4" />
              {isPending ? "Saving..." : isEditing ? "Update Income" : "Log Income Entry"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
