"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Home, Users, FileText, DollarSign, PieChart, Settings, LogOut, Wallet, ArrowRightLeft, HelpCircle, X } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useEffect } from 'react';

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Clients', href: '/clients', icon: Users },
  { name: 'Invoices', href: '/invoices', icon: FileText },
  { name: 'Transactions', href: '/transactions', icon: ArrowRightLeft },
  { name: 'Income', href: '/income', icon: DollarSign },
  { name: 'Expenses', href: '/expenses', icon: Wallet },
  { name: 'Reports', href: '/reports', icon: PieChart },
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

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  // Close sidebar on route change
  useEffect(() => {
    if (isOpen && onClose) {
      onClose();
    }
  }, [pathname]);

  const userName = user?.name || "Ahmed Ali";
  const userEmail = user?.email || "ahmed.dev@example.com";
  const userInitials = userName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || "AA";

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

        <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden pb-4">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                  isActive
                    ? "bg-secondary text-primary font-semibold"
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                )}
              >
                <item.icon className={cn("h-5 w-5", isActive ? "text-primary" : "text-muted-foreground")} />
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
              title="Sign out"
              className="text-muted-foreground hover:text-destructive transition-colors p-1 shrink-0"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
