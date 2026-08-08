"use client";

import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { useEffect } from "react";

export interface ToastProps {
  type?: "error" | "success" | "info";
  title?: string;
  message: string;
  onClose: () => void;
  duration?: number;
}

export function Toast({ type = "error", title, message, onClose, duration = 6000 }: ToastProps) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [onClose, duration]);

  const isError = type === "error";

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-start gap-3 max-w-md p-4 rounded-xl border shadow-2xl backdrop-blur-md transition-all animate-in slide-in-from-bottom-5 ${
      isError 
        ? "bg-destructive/90 border-destructive/40 text-destructive-foreground" 
        : "bg-primary/90 border-primary/40 text-primary-foreground"
    }`}>
      {isError ? (
        <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
      ) : (
        <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
      )}
      <div className="flex-1 space-y-1">
        <h4 className="text-sm font-bold tracking-wide">
          {title || (isError ? "Submission Error" : "Success")}
        </h4>
        <p className="text-xs leading-relaxed opacity-90">{message}</p>
      </div>
      <button 
        onClick={onClose} 
        type="button"
        className="p-1 rounded-lg hover:bg-black/10 text-current opacity-70 hover:opacity-100 transition-opacity"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
