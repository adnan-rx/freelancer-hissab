import { cn } from "@/lib/utils";

/**
 * Wordmark. The mark is a crescent-notched disc — the Pakistani cue rendered as
 * a geometric monogram rather than a flag, which is the whole brief in one glyph.
 */
export function Logo({ className, showWordmark = true }: { className?: string; showWordmark?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-xs">
        <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden="true" fill="none">
          <path
            d="M12 2.75a9.25 9.25 0 1 0 8.1 13.7A7.4 7.4 0 0 1 11.4 6.2a9.3 9.3 0 0 1 .6-3.45Z"
            fill="currentColor"
          />
          <path d="M17.6 4.1l.72 2.02 2.02.72-2.02.72-.72 2.02-.72-2.02-2.02-.72 2.02-.72.72-2.02Z" fill="currentColor" />
        </svg>
      </span>
      {showWordmark && (
        <span className="text-[0.9375rem] font-semibold leading-tight tracking-[-0.02em] text-foreground">
          Freelancer<span className="text-brand-600">Hisab</span>
        </span>
      )}
    </span>
  );
}
