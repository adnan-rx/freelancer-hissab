import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * Status pills. Pill shape is reserved for badges alone; everything else in the
 * app uses the 8/10/14px radius scale. Tinted surface + deep text so each state
 * clears WCAG AA against white without shouting.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium leading-5 transition-colors [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-brand-100 bg-brand-50 text-brand-800",
        neutral: "border-border bg-muted text-muted-foreground",
        secondary: "border-border bg-muted text-foreground",
        success: "border-success/15 bg-success-surface text-success",
        warning: "border-warning/15 bg-warning-surface text-warning",
        destructive: "border-destructive/15 bg-destructive-surface text-destructive",
        info: "border-info/15 bg-info-surface text-info",
        outline: "border-border-strong bg-card text-foreground",
        solid: "border-transparent bg-primary text-primary-foreground",
      },
      size: {
        default: "px-2.5 py-0.5 text-xs",
        sm: "px-2 py-0 text-2xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Renders a leading status dot in the badge's own colour. */
  dot?: boolean;
}

function Badge({ className, variant, size, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot && <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  )
}

export { Badge, badgeVariants }
