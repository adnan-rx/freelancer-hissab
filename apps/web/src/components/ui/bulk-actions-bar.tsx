"use client";

import { Loader2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface BulkActionsBarProps {
  count: number;
  onDelete: () => void;
  onClear: () => void;
  isDeleting?: boolean;
  label?: string;
  /** Extra bulk actions rendered before Delete. */
  children?: React.ReactNode;
}

/** Replaces the table toolbar while rows are selected, in every table. */
export function BulkActionsBar({ count, onDelete, onClear, isDeleting, label = "item", children }: BulkActionsBarProps) {
  if (count === 0) return null;

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="flex flex-col gap-3 border-b border-brand-100 bg-brand-50 px-5 py-3 animate-fade-in sm:flex-row sm:items-center sm:justify-between sm:px-6"
    >
      <p className="text-sm font-medium text-brand-900">
        <span className="tabular">{count}</span> {label}
        {count === 1 ? "" : "s"} selected
      </p>
      <div className="flex items-center gap-2">
        {children}
        <Button variant="ghost" size="sm" onClick={onClear} disabled={isDeleting}>
          <X /> Clear
        </Button>
        <Button variant="destructive" size="sm" onClick={onDelete} disabled={isDeleting}>
          {isDeleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
          Delete
        </Button>
      </div>
    </div>
  );
}
