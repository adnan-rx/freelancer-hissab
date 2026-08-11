"use client";

import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export type ToastKind = "error" | "success" | "info" | "warning";

export interface ToastProps {
  type?: ToastKind;
  title?: string;
  message: string;
  onClose: () => void;
  duration?: number;
}

/**
 * One notification appearance for every kind: white card, hairline border,
 * a coloured rail and icon chip carrying the semantics. Solid-colour toasts
 * read as alarms; this reads as the product talking.
 * Stacking and screen position are owned by ToastProvider's viewport.
 */
const TONE = {
  success: {
    rail: "bg-success",
    chip: "bg-success-surface text-success",
    Icon: CheckCircle2,
    defaultTitle: "Saved",
  },
  error: {
    rail: "bg-destructive",
    chip: "bg-destructive-surface text-destructive",
    Icon: AlertCircle,
    defaultTitle: "Something went wrong",
  },
  warning: {
    rail: "bg-warning",
    chip: "bg-warning-surface text-warning",
    Icon: AlertTriangle,
    defaultTitle: "Check this",
  },
  info: {
    rail: "bg-info",
    chip: "bg-info-surface text-info",
    Icon: Info,
    defaultTitle: "Notice",
  },
} as const;

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

  const { rail, chip, Icon, defaultTitle } = TONE[type] ?? TONE.info;

  return (
    <div
      role={type === "error" ? "alert" : "status"}
      aria-live={type === "error" ? "assertive" : "polite"}
      className="relative flex w-full items-start gap-3 overflow-hidden rounded-lg border border-border bg-card p-4 pl-[1.125rem] shadow-pop"
    >
      <span className={cn("absolute inset-y-0 left-0 w-1", rail)} aria-hidden="true" />

      <span className={cn("mt-px flex size-7 shrink-0 items-center justify-center rounded-sm", chip)} aria-hidden="true">
        <Icon className="size-4" />
      </span>

      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm font-semibold leading-tight text-foreground">{title || defaultTitle}</p>
        <p className="break-words text-sm leading-relaxed text-muted-foreground">{message}</p>
      </div>

      <button
        onClick={onClose}
        type="button"
        aria-label="Dismiss notification"
        className="-mr-1 -mt-1 shrink-0 rounded-sm p-1.5 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
      >
        <X className="size-4" />
      </button>

      {duration > 0 && (
        <span
          className={cn("absolute inset-x-0 bottom-0 h-0.5 origin-left opacity-30", rail)}
          style={{ animation: `toast-timer ${duration}ms linear forwards` }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
