"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Check, DollarSign, Plus } from "lucide-react";
import { useCreateIncome } from "@/hooks/use-income";
import { useClients } from "@/hooks/use-clients";

export function AddIncomeModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const createIncomeMutation = useCreateIncome();
  const { data: clientsList = [] } = useClients();

  const [receivedAt, setReceivedAt] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState("");
  const [platform, setPlatform] = useState("upwork");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [sbpPurposeCode, setSbpPurposeCode] = useState("9100");
  const [prcReferenceNumber, setPrcReferenceNumber] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return;

    try {
      await createIncomeMutation.mutateAsync({
        receivedAt,
        description: description || "Direct Income Payment",
        clientId: clientId || undefined,
        platform,
        amount: parseFloat(amount),
        currency,
        sbpPurposeCode,
        prcReferenceNumber: prcReferenceNumber || undefined,
      });
      onClose();
    } catch (err) {
      console.warn("Failed to create income log", err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-400" />
            <h2 className="text-xl font-bold text-slate-100">Log Manual Foreign / Local Income</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Date Received *</label>
              <Input 
                type="date" 
                value={receivedAt} 
                onChange={(e) => setReceivedAt(e.target.value)} 
                required 
                className="bg-slate-950 border-slate-800 text-slate-100"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Platform / Channel</label>
              <select 
                value={platform} 
                onChange={(e) => setPlatform(e.target.value)} 
                className="w-full h-10 px-3 rounded-md bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:border-emerald-500 focus:outline-none"
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
            <label className="text-xs font-semibold text-slate-300">Transaction Description *</label>
            <Input 
              placeholder="e.g. Web Development Milestone Payment" 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              required 
              className="bg-slate-950 border-slate-800 text-slate-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Client Profile (Optional)</label>
              <select 
                value={clientId} 
                onChange={(e) => setClientId(e.target.value)} 
                className="w-full h-10 px-3 rounded-md bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:border-emerald-500 focus:outline-none"
              >
                <option value="">-- Select Client --</option>
                {clientsList.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.company || c.platform})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Amount *</label>
                <Input 
                  type="number" 
                  step="0.01" 
                  placeholder="1000" 
                  value={amount} 
                  onChange={(e) => setAmount(e.target.value)} 
                  required 
                  className="bg-slate-950 border-slate-800 text-slate-100 font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Currency</label>
                <select 
                  value={currency} 
                  onChange={(e) => setCurrency(e.target.value)} 
                  className="w-full h-10 px-2 rounded-md bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:border-emerald-500 focus:outline-none"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="PKR">PKR (Rs.)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-3">
            <h4 className="text-xs font-bold text-slate-200">SBP PRC & Remittance Compliance</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-400">SBP Purpose Code</label>
                <Input 
                  value={sbpPurposeCode} 
                  onChange={(e) => setSbpPurposeCode(e.target.value)} 
                  className="bg-slate-900 border-slate-800 text-slate-100 text-xs font-mono"
                  placeholder="9100"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-400">Bank PRC Ref # (Optional)</label>
                <Input 
                  value={prcReferenceNumber} 
                  onChange={(e) => setPrcReferenceNumber(e.target.value)} 
                  className="bg-slate-900 border-slate-800 text-slate-100 text-xs font-mono"
                  placeholder="PRC-2026-X1"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <Button type="button" variant="outline" onClick={onClose} className="border-slate-800 bg-slate-950 text-slate-300">
              Cancel
            </Button>
            <Button type="submit" disabled={createIncomeMutation.isPending} className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold">
              <Check className="mr-1.5 h-4 w-4" /> Log Income Entry
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
