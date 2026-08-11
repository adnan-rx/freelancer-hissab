import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Wordmark. The mark is the FH monogram whose crossbar rises into an arrow —
 * the growth cue the whole product is about, carried by the letters themselves.
 */
export function Logo({ className, showWordmark = true }: { className?: string; showWordmark?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <Image
        src="/logo-mark.png"
        alt=""
        width={512}
        height={349}
        priority
        className="h-9 w-auto shrink-0"
      />
      {showWordmark && (
        <span className="text-[0.9375rem] font-semibold leading-tight tracking-[-0.02em] text-foreground">
          Freelancer<span className="text-brand-600">Hisab</span>
        </span>
      )}
    </span>
  );
}
