"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Toast, type ToastKind } from "@/components/ui/toast";

export type { ToastKind };

export interface ToastInput {
  type?: ToastKind;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastItem {
  id: number;
  type: ToastKind;
  title?: string;
  message: string;
  duration: number;
}

interface ToastContextValue {
  showToast: (toast: ToastInput) => void;
  showSuccess: (message: string, title?: string) => void;
  showError: (message: string, title?: string) => void;
  showWarning: (message: string, title?: string) => void;
  showInfo: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** Beyond this, older toasts drop off rather than filling the viewport. */
const MAX_VISIBLE = 4;

/**
 * Mounted once in the root layout, outside every route's component tree.
 * Toasts used to be page-local `useState`, so a success toast raised right
 * before `router.push()` (e.g. after creating an invoice) unmounted with the
 * page that raised it and was never seen. A provider above the router fixes
 * that structurally: the toast now belongs to the layout, not the page.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((toast: ToastInput) => {
    const id = ++idRef.current;
    setToasts((prev) =>
      [
        ...prev,
        {
          id,
          type: toast.type ?? "info",
          title: toast.title,
          message: toast.message,
          duration: toast.duration ?? 6000,
        },
      ].slice(-MAX_VISIBLE),
    );
  }, []);

  const showSuccess = useCallback(
    (message: string, title?: string) => showToast({ type: "success", message, title }),
    [showToast],
  );
  const showError = useCallback(
    (message: string, title?: string) => showToast({ type: "error", message, title }),
    [showToast],
  );
  const showWarning = useCallback(
    (message: string, title?: string) => showToast({ type: "warning", message, title }),
    [showToast],
  );
  const showInfo = useCallback(
    (message: string, title?: string) => showToast({ type: "info", message, title }),
    [showToast],
  );

  return (
    <ToastContext.Provider value={{ showToast, showSuccess, showError, showWarning, showInfo }}>
      {children}
      {/* One viewport, one position: top-right on desktop, full-width top on
          phones where a right-anchored card would clip. Newest sits on top. */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex flex-col-reverse items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:w-[26rem] sm:max-w-[calc(100vw-2rem)] sm:items-stretch sm:p-6">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto w-full animate-slide-in-right">
            <Toast type={t.type} title={t.title} message={t.message} duration={t.duration} onClose={() => dismiss(t.id)} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
