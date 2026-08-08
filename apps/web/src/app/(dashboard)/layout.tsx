"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { useAuthStore } from '@/stores/auth.store';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [hasHydrated, setHasHydrated] = useState(false);

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

  // Don't render anything until hydration is complete to avoid flash
  if (!hasHydrated) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-50 print:h-auto print:overflow-visible print:bg-white">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden print:overflow-visible">
        <Header />
        <main className="flex-1 overflow-y-auto p-6 bg-slate-950 print:p-0 print:m-0 print:bg-white print:overflow-visible">
          {children}
        </main>
      </div>
    </div>
  );
}

