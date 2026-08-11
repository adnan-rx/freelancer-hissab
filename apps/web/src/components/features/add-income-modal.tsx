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
import { useCreateIncome, useUpdateIncome } from "@/hooks/use-income";
import { useClients } from "@/hooks/use-clients";
import { useExchangeRate } from "@/hooks/use-exchange-rate";
import { apiErrorMessage, formatPKR } from "@/lib/utils";
import { useToast } from "@/providers/toast-provider";

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
  const { showSuccess } = useToast();
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
        showSuccess("Income entry updated.", "Income updated");
      } else {
        await createIncomeMutation.mutateAsync(payload);
        showSuccess(`"${payload.description}" logged.`, "Income added");
      }
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to save the income entry."));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit income entry" : "Log income"}</DialogTitle>
          <DialogDescription>
            Foreign or local — the PKR value is worked out from the rate on the day it arrived.
          </DialogDescription>
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
              <Field label="Date received" htmlFor="inc-date" required>
                <Input
                  id="inc-date"
                  type="date"
                  value={receivedAt}
                  onChange={(e) => setReceivedAt(e.target.value)}
                  required
                />
              </Field>

              <Field label="Platform" htmlFor="inc-platform">
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger id="inc-platform">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upwork">Upwork escrow</SelectItem>
                    <SelectItem value="fiverr">Fiverr orders</SelectItem>
                    <SelectItem value="direct">Direct (bank / Wise)</SelectItem>
                    <SelectItem value="freelancer">Freelancer.com</SelectItem>
                    <SelectItem value="other">Local PKR client</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field label="Description" htmlFor="inc-desc" required>
              <Input
                id="inc-desc"
                placeholder="Web development milestone payment"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                required
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Client" htmlFor="inc-client" hint="Optional — links this payment to a client.">
                <Select value={clientId || "none"} onValueChange={(v) => setClientId(v === "none" ? "" : v)}>
                  <SelectTrigger id="inc-client">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No client</SelectItem>
                    {clientsList.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Amount" htmlFor="inc-amount" required>
                  <Input
                    id="inc-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="1000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    className="font-mono tabular-nums"
                  />
                </Field>
                <Field label="Currency" htmlFor="inc-currency">
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger id="inc-currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                      <SelectItem value="PKR">PKR (Rs)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </div>

            {previewPKR !== null && (
              <div className="flex items-center justify-between gap-3 rounded-md border border-brand-200 bg-brand-50 px-3 py-2.5">
                <span className="text-sm font-medium text-brand-800">Converts to</span>
                <span className="text-right">
                  <span className="block font-mono text-sm font-semibold tabular-nums text-brand-900">
                    {formatPKR(previewPKR)}
                  </span>
                  {isForeign && liveRate && (
                    <span className="block font-mono text-2xs tabular-nums text-brand-700">
                      at {liveRate.toFixed(2)} PKR/{currency}
                    </span>
                  )}
                </span>
              </div>
            )}

            <div className="space-y-4 rounded-md border border-border bg-muted/50 p-4">
              <p className="text-sm font-medium text-foreground">Remittance evidence</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="SBP purpose code" htmlFor="inc-sbp">
                  <Input
                    id="inc-sbp"
                    value={sbpPurposeCode}
                    onChange={(e) => setSbpPurposeCode(e.target.value)}
                    className="font-mono"
                    placeholder="9100"
                  />
                </Field>

                <Field
                  label="Bank PRC reference"
                  htmlFor="inc-prc"
                  hint={isForeign ? "Required before you can file export income." : undefined}
                >
                  <Input
                    id="inc-prc"
                    value={prcReferenceNumber}
                    onChange={(e) => setPrcReferenceNumber(e.target.value)}
                    className="font-mono"
                    placeholder="PRC-2026-X1"
                  />
                </Field>
              </div>
              {isForeign && !prcReferenceNumber.trim() && (
                <p className="rounded-md border border-warning/15 bg-warning-surface px-3 py-2 text-xs leading-relaxed text-warning">
                  Export income without a PRC reference gets flagged on your filing readiness score.
                </p>
              )}
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="animate-spin" />}
              {isEditing ? "Save changes" : "Log income"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
