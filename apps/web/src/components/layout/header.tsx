"use client";

import { Bell, Search, Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

export function Header() {
  const { theme, setTheme } = useTheme();

  return (
    <header className="print:hidden h-16 border-b border-slate-800 bg-slate-950 flex items-center justify-between px-6">
      <div className="flex items-center w-96 gap-2">
        <Search className="h-4 w-4 text-slate-400" />
        <Input placeholder="Search invoices, clients..." className="border-0 bg-transparent focus-visible:ring-0 shadow-none h-9 text-slate-100 placeholder:text-slate-500" />
      </div>

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="text-slate-400 hover:text-slate-100">
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>
        <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-100">
          <Bell className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
