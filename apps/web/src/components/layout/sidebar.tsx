"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Home, Users, FileText, DollarSign, PieChart, Settings, LogOut, Wallet, ArrowRightLeft, HelpCircle, X, ShieldCheck, Calculator, Landmark } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api-client';

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Clients', href: '/clients', icon: Users },
  { name: 'Invoices', href: '/invoices', icon: FileText },
  { name: 'Transactions', href: '/transactions', icon: ArrowRightLeft },
  { name: 'Income', href: '/income', icon: DollarSign },
  { name: 'Expenses', href: '/expenses', icon: Wallet },
  { name: 'Reports', href: '/reports', icon: PieChart },
  { name: 'Wealth', href: '/wealth', icon: Landmark },
  { name: 'Tax Simulator', href: '/tax-simulator', icon: Calculator },
  { name: 'Filing Simulator', href: '/filing', icon: ShieldCheck },
  { name: 'User Guide', href: '/guide', icon: HelpCircle },
  { name: 'Settings', href: '/settings', icon: Settings },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      // Revokes the refresh token server-side. This used to be skipped
      // entirely: the httpOnly cookie was never cleared by the browser
      // either, so the session stayed valid until it naturally expired.
      await apiClient.post('/auth/logout');
    } catch {
      // Best-effort: proceed with the local logout regardless — the user's
      // own view of "am I logged in" must not depend on network conditions.
    } finally {
      logout();
      router.push('/login');
    }
  };

  // Close sidebar on route change only — isOpen/onClose are read via refs so
  // this doesn't also re-fire on every re-render that hands in a fresh
  // onClose closure (the parent doesn't memoize it).
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (isOpenRef.current) {
      onCloseRef.current?.();
    }
  }, [pathname]);

  // No fabricated fallback identity: if the store hasn't hydrated yet this
  // briefly shows a neutral placeholder rather than a fake person's name and
  // email as though they were the signed-in user.
  const userName = user?.name || "Your Account";
  const userEmail = user?.email || "";
  const userInitials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()
    : "—";

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside className={cn(
        "print:hidden fixed md:static inset-y-0 left-0 z-50 flex flex-col w-64 border-r border-border bg-background h-full px-4 py-6 shrink-0 transition-transform duration-300 ease-in-out",
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="flex items-center justify-between gap-3 mb-8 px-2">
          <div className="flex items-center gap-3">
            <div className="bg-primary text-primary-foreground p-2 rounded-xl font-bold text-lg shadow-sm">
              Rs
            </div>
            <h1 className="text-xl font-extrabold tracking-tight text-foreground">
              Freelancer<span className="text-primary">Hisab</span>
            </h1>
          </div>
          {/* Mobile Close Button */}
          <button 
            onClick={onClose}
            className="md:hidden text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden pb-4 mt-2 no-scrollbar">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3.5 py-2 rounded-2xl text-sm transition-all",
                  isActive
                    ? "bg-primary/10 text-primary font-bold shadow-sm"
                    : "text-muted-foreground font-medium hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <div className={cn(
                  "flex items-center justify-center rounded-xl p-1.5 transition-colors",
                  isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
                )}>
                  <item.icon className="h-4 w-4" strokeWidth={isActive ? 2.5 : 2} />
                </div>
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-border pt-4 shrink-0">
          <div className="flex items-center gap-3 px-3 py-2 bg-secondary/30 rounded-xl border border-border/50">
            <div className="w-9 h-9 rounded-lg bg-secondary border border-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
              {userInitials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{userName}</p>
              <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
            </div>
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              title="Sign out"
              className="text-muted-foreground hover:text-destructive transition-colors p-1 shrink-0 disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
