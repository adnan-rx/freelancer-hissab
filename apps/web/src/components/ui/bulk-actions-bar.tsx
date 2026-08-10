"use client";

import { Trash2, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface BulkActionsBarProps {
  count: number;
  onDelete: () => void;
  onClear: () => void;
  isDeleting?: boolean;
  label?: string;
}

/** Sticky-ish bar shown above a table's header row once one or more rows are selected. */
export function BulkActionsBar({ count, onDelete, onClear, isDeleting, label = "item" }: BulkActionsBarProps) {
  if (count === 0) return null;

  return (
    <div className="flex items-center justify-between gap-3 px-6 py-3 border-b border-border bg-primary/5">
      <p className="text-sm font-medium text-foreground">
        {count} {label}
        {count === 1 ? "" : "s"} selected
      </p>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onClear} disabled={isDeleting}>
          <X className="h-3.5 w-3.5 mr-1" /> Clear
        </Button>
        <Button variant="destructive" size="sm" onClick={onDelete} disabled={isDeleting}>
          {isDeleting ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
          )}
          Delete Selected
        </Button>
      </div>
    </div>
  );
}
