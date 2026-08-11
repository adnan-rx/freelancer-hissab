"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  ArrowRightLeft,
  Calculator,
  DollarSign,
  FileText,
  HelpCircle,
  Home,
  Landmark,
  LogOut,
  PieChart,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { Logo } from '@/components/layout/logo';
import { useToast } from '@/providers/toast-provider';

/**
 * Twelve flat links was a wall. Grouping them by the question the user is
 * asking ("what did I earn", "what do I owe") makes the nav scannable without
 * changing a single route.
 */
const navGroups: { label: string; items: { name: string; href: string; icon: typeof Home }[] }[] = [
  {
    label: 'Overview',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: Home },
      { name: 'Reports', href: '/reports', icon: PieChart },
    ],
  },
  {
    label: 'Money in',
    items: [
      { name: 'Clients', href: '/clients', icon: Users },
      { name: 'Invoices', href: '/invoices', icon: FileText },
      { name: 'Income', href: '/income', icon: DollarSign },
      { name: 'Transactions', href: '/transactions', icon: ArrowRightLeft },
    ],
  },
  {
    label: 'Money out',
    items: [{ name: 'Expenses', href: '/expenses', icon: Wallet }],
  },
  {
    label: 'Tax & filing',
    items: [
      { name: 'Wealth', href: '/wealth', icon: Landmark },
      { name: 'Tax Simulator', href: '/tax-simulator', icon: Calculator },
      { name: 'Filing Simulator', href: '/filing', icon: ShieldCheck },
    ],
  },
  {
    label: 'Account',
    items: [
      { name: 'User Guide', href: '/guide', icon: HelpCircle },
      { name: 'Settings', href: '/settings', icon: Settings },
    ],
  },
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
  const { showInfo } = useToast();
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
      showInfo('You have been signed out.', 'Signed Out');
      router.replace('/login');
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

  // Escape closes the mobile drawer; without it the only way out is the X.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

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
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/25 backdrop-blur-[2px] animate-fade-in md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="Main navigation"
        className={cn(
          "print:hidden fixed inset-y-0 left-0 z-50 flex h-full w-[17rem] shrink-0 flex-col border-r border-border bg-card transition-transform duration-300 ease-smooth md:static md:w-[16rem] md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
          <Link
            href="/dashboard"
            className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
          >
            <Logo />
          </Link>
          <button
            onClick={onClose}
            className="-mr-1 rounded-sm p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 md:hidden"
            aria-label="Close navigation"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="thin-scrollbar flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="mb-1.5 px-3 text-2xs font-semibold uppercase tracking-[0.1em] text-subtle">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-150 ease-smooth",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70",
                          isActive
                            ? "bg-brand-50 font-medium text-brand-900"
                            : "font-normal text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        {isActive && (
                          <span
                            className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-brand-700"
                            aria-hidden="true"
                          />
                        )}
                        <item.icon
                          className={cn("size-[1.125rem] shrink-0", isActive ? "text-brand-700" : "text-subtle")}
                          strokeWidth={1.75}
                        />
                        <span className="truncate">{item.name}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-border p-3">
          <div className="flex items-center gap-3 rounded-md px-2 py-2">
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-50 text-xs font-semibold text-brand-800"
              aria-hidden="true"
            >
              {userInitials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">{userName}</span>
              {userEmail && <span className="block truncate text-xs text-muted-foreground">{userEmail}</span>}
            </span>
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              title="Sign out"
              aria-label="Sign out"
              className="shrink-0 rounded-sm p-2 text-muted-foreground transition-colors duration-150 hover:bg-destructive-surface hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 disabled:opacity-50"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
