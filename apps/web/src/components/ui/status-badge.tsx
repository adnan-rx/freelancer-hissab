import { Badge, type BadgeProps } from "@/components/ui/badge";

/**
 * One mapping from invoice status to badge tone, shared by the list, the
 * detail view and the editor — so "paid" never looks different in two places.
 */
const INVOICE_STATUS: Record<string, BadgeProps["variant"]> = {
  paid: "success",
  overdue: "destructive",
  cancelled: "neutral",
  draft: "neutral",
  sent: "info",
  viewed: "info",
};

export function InvoiceStatusBadge({ status, className }: { status?: string; className?: string }) {
  const key = (status || "draft").toLowerCase();
  return (
    <Badge variant={INVOICE_STATUS[key] ?? "neutral"} dot className={`capitalize ${className ?? ""}`}>
      {key}
    </Badge>
  );
}
