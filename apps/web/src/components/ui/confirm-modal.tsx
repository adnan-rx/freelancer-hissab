"use client";

import { AlertTriangle, Trash2, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "destructive" | "warning";
  isLoading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Are you sure?",
  description = "This action cannot be undone.",
  confirmText = "Confirm Delete",
  cancelText = "Cancel",
  variant = "destructive",
  isLoading = false,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
        <div className="flex items-start justify-between p-6 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${
              variant === "destructive" 
                ? "bg-rose-500/10 border-rose-500/30 text-rose-400" 
                : "bg-amber-500/10 border-amber-500/30 text-amber-400"
            }`}>
              {variant === "destructive" ? <Trash2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">{title}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{description}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            type="button"
            className="text-slate-400 hover:text-slate-100 p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 bg-slate-950/40 flex justify-end gap-3">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onClose} 
            disabled={isLoading}
            className="border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
          >
            {cancelText}
          </Button>
          <Button 
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={variant === "destructive" ? "bg-rose-600 hover:bg-rose-500 text-white font-semibold shadow-lg shadow-rose-600/20" : "bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold"}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...
              </>
            ) : (
              confirmText
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
