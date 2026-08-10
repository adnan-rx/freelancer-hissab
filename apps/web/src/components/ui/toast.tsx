"use client";

import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { useEffect, useRef } from "react";

export interface ToastProps {
  type?: "error" | "success" | "info";
  title?: string;
  message: string;
  onClose: () => void;
  duration?: number;
}

export function Toast({ type = "error", title, message, onClose, duration = 6000 }: ToastProps) {
  // onClose is almost always a fresh inline function from the caller, so it must not
  // sit in the effect's deps — otherwise any parent re-render while the toast is open
  // restarts the timer and the toast can get stuck on screen indefinitely.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => onCloseRef.current(), duration);
      return () => clearTimeout(timer);
    }
  }, [duration]);

  const defaultTitle = { error: "Submission Error", success: "Success", info: "Notice" }[type];
  const style = {
    error: "bg-destructive/90 border-destructive/40 text-destructive-foreground",
    success: "bg-primary/90 border-primary/40 text-primary-foreground",
    info: "bg-foreground/90 border-foreground/40 text-background",
  }[type];
  const Icon = { error: AlertCircle, success: CheckCircle2, info: Info }[type];

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-start gap-3 max-w-md p-4 rounded-xl border shadow-2xl backdrop-blur-md transition-all animate-in slide-in-from-bottom-5 ${style}`}>
      <Icon className="h-5 w-5 shrink-0 mt-0.5" />
      <div className="flex-1 space-y-1">
        <h4 className="text-sm font-bold tracking-wide">
          {title || defaultTitle}
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
