"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { useAuthStore } from '@/stores/auth.store';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Wait for Zustand to hydrate from localStorage before checking auth
    const unsub = useAuthStore.persist.onFinishHydration(() => {
      setHasHydrated(true);
    });
    // In case hydration already finished before this effect ran
    if (useAuthStore.persist.hasHydrated()) {
      setHasHydrated(true);
    }
    return unsub;
  }, []);

  useEffect(() => {
    if (hasHydrated && !isAuthenticated) {
      router.push('/login');
    }
  }, [hasHydrated, isAuthenticated, router]);

  // The drawer sits above the page on phones, so the page behind it must not
  // scroll while it's open.
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isMobileMenuOpen]);

  // Rendering nothing until hydration made the app flash blank on every load.
  // A shell in the final layout's shape reads as "loading", not as broken.
  if (!hasHydrated) {
    return (
      <div className="flex h-full overflow-hidden">
        <div className="hidden w-[16rem] shrink-0 border-r border-border bg-card md:block" />
        <div className="flex flex-1 flex-col">
          <div className="h-16 shrink-0 border-b border-border bg-card" />
          <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8">
            <Skeleton className="h-8 w-56" />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-lg" />
              ))}
            </div>
            <Skeleton className="h-80 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden bg-background text-foreground print:h-auto print:overflow-visible print:bg-white">
      <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden print:overflow-visible">
        <Header onMenuClick={() => setIsMobileMenuOpen(true)} />
        {/* `relative` is load-bearing: it makes this the containing block for
            absolutely positioned descendants. `sr-only` is position:absolute, so
            without it every visually-hidden label or chart data-table below the
            fold resolves against the document instead of this scroller, escapes
            the overflow clip, and stretches document.scrollHeight — which shows
            up as a tall band of blank page under the app. */}
        <main
          id="main-content"
          className="thin-scrollbar relative flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8 print:overflow-visible print:m-0 print:bg-white print:p-0"
        >
          <div className="mx-auto w-full max-w-[80rem]">{children}</div>
        </main>
      </div>
    </div>
  );
}
