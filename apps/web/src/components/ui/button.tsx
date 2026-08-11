import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * One button system for the whole app.
 * Shape: rounded-md (10px) at every size — controls never mix radii.
 * Feedback: colour shift on hover, 1px press on :active, brand focus ring.
 */
const buttonVariants = cva(
  // Disabled solid buttons drop to a neutral fill rather than a faded brand:
  // white text at 45% over pale green read as unfinished, not as "off".
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-[background-color,color,box-shadow,border-color,transform] duration-150 ease-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none active:translate-y-px [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-xs hover:bg-brand-800 disabled:bg-muted disabled:text-subtle disabled:shadow-none",
        destructive:
          "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90 disabled:bg-muted disabled:text-subtle disabled:shadow-none",
        outline:
          "border border-border-strong bg-card text-foreground shadow-xs hover:bg-muted hover:border-border-strong disabled:opacity-50",
        secondary:
          "border border-brand-100 bg-secondary text-secondary-foreground hover:bg-brand-100 disabled:opacity-50",
        ghost:
          "text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50",
        link:
          "text-primary underline-offset-4 hover:underline active:translate-y-0 disabled:opacity-50",
      },
      size: {
        default: "h-10 px-4 text-sm [&_svg]:size-4",
        sm: "h-8 px-3 text-xs [&_svg]:size-3.5",
        lg: "h-11 px-6 text-sm [&_svg]:size-4",
        icon: "h-10 w-10 p-0 [&_svg]:size-4",
        "icon-sm": "h-8 w-8 p-0 [&_svg]:size-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<any>, {
        className: cn(buttonVariants({ variant, size, className }), (children.props as any)?.className),
        ref,
        ...props,
      });
    }
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      >
        {children}
      </button>
    );
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
