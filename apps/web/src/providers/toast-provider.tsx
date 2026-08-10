"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Toast } from "@/components/ui/toast";

export type ToastKind = "error" | "success" | "info";

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
}

const ToastContext = createContext<ToastContextValue | null>(null);

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
    setToasts((prev) => [
      ...prev,
      {
        id,
        type: toast.type ?? "info",
        title: toast.title,
        message: toast.message,
        duration: toast.duration ?? 6000,
      },
    ]);
  }, []);

  const showSuccess = useCallback(
    (message: string, title?: string) => showToast({ type: "success", message, title }),
    [showToast],
  );
  const showError = useCallback(
    (message: string, title?: string) => showToast({ type: "error", message, title }),
    [showToast],
  );

  return (
    <ToastContext.Provider value={{ showToast, showSuccess, showError }}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex w-full max-w-md flex-col-reverse gap-3 px-4 pointer-events-none sm:px-0">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
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
