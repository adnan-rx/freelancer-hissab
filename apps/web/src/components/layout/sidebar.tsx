"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Home, Users, FileText, DollarSign, PieChart, Settings, LogOut, Wallet } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Clients', href: '/clients', icon: Users },
  { name: 'Invoices', href: '/invoices', icon: FileText },
  { name: 'Income', href: '/income', icon: DollarSign },
  { name: 'Expenses', href: '/expenses', icon: Wallet },
  { name: 'Reports', href: '/reports', icon: PieChart },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const userName = user?.name || "Ahmed Ali";
  const userEmail = user?.email || "ahmed.dev@example.com";
  const userInitials = userName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || "AA";

  return (
    <aside className="print:hidden flex flex-col w-64 border-r border-slate-800 bg-slate-950 h-screen px-4 py-6">
      <div className="flex items-center gap-3 mb-8 px-2">
        <div className="bg-emerald-500 text-slate-950 p-2 rounded-xl font-bold text-lg shadow-lg shadow-emerald-500/20">
          Rs
        </div>
        <h1 className="text-xl font-extrabold tracking-tight text-white">
          Freelancer<span className="text-emerald-400">Hisab</span>
        </h1>
      </div>
      
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                isActive 
                  ? "bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20" 
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive ? "text-emerald-400" : "text-slate-400")} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-slate-800 pt-4">
        <div className="flex items-center gap-3 px-3 py-2 bg-slate-900/60 rounded-xl border border-slate-800">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-xs">
            {userInitials}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-semibold text-slate-200 truncate">{userName}</p>
            <p className="text-xs text-slate-400 truncate">{userEmail}</p>
          </div>
          <button 
            onClick={handleLogout}
            title="Sign out"
            className="text-slate-400 hover:text-rose-400 transition-colors p-1"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
