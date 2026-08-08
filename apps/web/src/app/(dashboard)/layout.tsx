"use client";

import { useEffect } from 'react';
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

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

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
