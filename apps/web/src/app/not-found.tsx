import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-5 text-center">
      <Logo />
      <p className="mt-10 font-mono text-sm font-semibold tracking-[0.08em] text-brand-600">404</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-[-0.02em] text-foreground sm:text-3xl">
        This page doesn&apos;t exist
      </h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
        The link may be out of date, or the record it pointed to has been deleted.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button asChild>
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </div>
  );
}
