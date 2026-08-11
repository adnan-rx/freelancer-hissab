"use client";

import * as React from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  indeterminate?: boolean;
}

/**
 * 16px box with a 40px invisible hit area so it stays tappable in dense table
 * rows without changing the row's visual rhythm.
 */
export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, indeterminate, checked, disabled, ...props }, ref) => {
    const innerRef = React.useRef<HTMLInputElement>(null);
    React.useImperativeHandle(ref, () => innerRef.current as HTMLInputElement);
    React.useEffect(() => {
      if (innerRef.current) innerRef.current.indeterminate = !!indeterminate;
    }, [indeterminate]);

    return (
      <span
        className={cn(
          "relative inline-flex size-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors duration-150 ease-smooth",
          checked || indeterminate
            ? "border-primary bg-primary"
            : "border-border-strong bg-card hover:border-brand-400",
          "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/70 has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background",
          disabled && "cursor-not-allowed opacity-45",
          className
        )}
      >
        <input
          ref={innerRef}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          className="absolute -inset-3 h-auto w-auto cursor-pointer opacity-0 disabled:cursor-not-allowed"
          {...props}
        />
        {indeterminate ? (
          <Minus className="pointer-events-none size-3 text-primary-foreground" strokeWidth={3} />
        ) : checked ? (
          <Check className="pointer-events-none size-3 text-primary-foreground" strokeWidth={3} />
        ) : null}
      </span>
    );
  }
);
Checkbox.displayName = "Checkbox";
