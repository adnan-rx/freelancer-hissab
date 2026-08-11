"use client";

import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

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

/**
 * Built on the shared Dialog so it inherits the app's focus trap, Escape
 * handling and scroll lock instead of being a second hand-rolled modal.
 */
export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Are you sure?",
  description = "This action cannot be undone.",
  confirmText = "Delete",
  cancelText = "Cancel",
  variant = "destructive",
  isLoading = false,
}: ConfirmModalProps) {
  const isDestructive = variant === "destructive";
  const Icon = isDestructive ? Trash2 : AlertTriangle;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isLoading && onClose()}>
      <DialogContent className="sm:max-w-md" hideClose>
        <div className="flex items-start gap-4 px-5 py-6 sm:px-6">
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-md",
              isDestructive ? "bg-destructive-surface text-destructive" : "bg-warning-surface text-warning"
            )}
            aria-hidden="true"
          >
            <Icon className="size-5" />
          </span>
          <div className="min-w-0 space-y-1.5">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
            {cancelText}
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            variant={isDestructive ? "destructive" : "default"}
            className={cn(!isDestructive && "bg-warning text-warning-foreground hover:bg-warning/90")}
          >
            {isLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Working…
              </>
            ) : (
              confirmText
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
