"use client";

import * as React from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  indeterminate?: boolean;
}

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
          "relative inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-colors",
          checked || indeterminate ? "bg-primary border-primary" : "border-input bg-background",
          disabled && "opacity-50",
          className
        )}
      >
        <input
          ref={innerRef}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          {...props}
        />
        {indeterminate ? (
          <Minus className="h-3 w-3 text-primary-foreground pointer-events-none" />
        ) : checked ? (
          <Check className="h-3 w-3 text-primary-foreground pointer-events-none" />
        ) : null}
      </span>
    );
  }
);
Checkbox.displayName = "Checkbox";
