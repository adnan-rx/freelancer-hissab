import * as React from "react"
import { cn } from "@/lib/utils"

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  /** Renders the error treatment; pair with a message below the field. */
  invalid?: boolean;
};

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, invalid, ...props }, ref) => {
    return (
      <input
        type={type}
        aria-invalid={invalid || undefined}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground shadow-xs transition-[border-color,box-shadow] duration-150 ease-smooth",
          "file:mr-3 file:rounded-sm file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs file:font-medium file:text-foreground",
          "placeholder:text-subtle",
          "hover:border-border-strong",
          "focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:ring-offset-0",
          "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
          "aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive/25",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

/** Multi-line sibling of Input — same border, focus and error treatment. */
const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(({ className, invalid, ...props }, ref) => (
  <textarea
    ref={ref}
    aria-invalid={invalid || undefined}
    className={cn(
      "flex min-h-[84px] w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm leading-relaxed text-foreground shadow-xs transition-[border-color,box-shadow] duration-150 ease-smooth",
      "placeholder:text-subtle hover:border-border-strong",
      "focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:ring-offset-0",
      "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
      "aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive/25",
      className
    )}
    {...props}
  />
))
Textarea.displayName = "Textarea"

export { Input, Textarea }
