import Link from "next/link";
import { Check } from "lucide-react";
import { Logo } from "@/components/layout/logo";

const PROOF_POINTS = [
  "USD, EUR and GBP converted to PKR at the rate on the day you were paid",
  "Section 154A export tax and wealth statement worked out from your own records",
  "A filing package you can hand to your tax consultant",
];

/**
 * Split shell for sign-in and registration. The form owns the left half at
 * every size; the brand panel is a desktop-only companion so phones get a
 * single, uncluttered column.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-[100dvh] lg:grid-cols-2">
      <div className="flex flex-col px-5 py-8 sm:px-8">
        <Link
          href="/"
          className="self-start rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
        >
          <Logo />
        </Link>
        <main id="main-content" className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </main>
        <p className="text-center text-xs text-muted-foreground">
          © 2026 FreelancerHisab ·{" "}
          <Link href="/" className="underline-offset-4 hover:text-foreground hover:underline">
            Back to home
          </Link>
        </p>
      </div>

      <aside className="relative hidden overflow-hidden bg-primary p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-center lg:gap-12">
        {/* One quiet radial lift so the panel isn't a flat block of colour. */}
        <div
          className="pointer-events-none absolute -right-24 -top-24 size-[28rem] rounded-full bg-brand-700/60 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative">
          <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-brand-300">
            Built for Pakistani freelancers
          </p>
          <h2 className="mt-5 max-w-md text-3xl font-semibold leading-[1.15] tracking-[-0.02em] text-balance">
            Every remittance, expense and invoice in one ledger your tax year understands.
          </h2>
        </div>

        <ul className="relative space-y-4">
          {PROOF_POINTS.map((point) => (
            <li key={point} className="flex items-start gap-3 text-sm leading-relaxed text-brand-100">
              <span
                className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-700"
                aria-hidden="true"
              >
                <Check className="size-3" strokeWidth={2.5} />
              </span>
              {point}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
