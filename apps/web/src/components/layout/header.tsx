"use client";

import { Bell, Menu } from 'lucide-react';
import { Button } from '../ui/button';
import { useToast } from '@/providers/toast-provider';

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { showToast } = useToast();

  const handleNotificationClick = () => {
    showToast({
      type: "info",
      title: "Notifications",
      message: "You have no new notifications at this time.",
    });
  };

  return (
    <header className="print:hidden h-20 bg-background flex items-center justify-between px-8 sticky top-0 z-30">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden text-muted-foreground hover:text-foreground"
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Every page has its own search/filter controls scoped to its own data
          (clients, invoices, transactions, ...); this bar used to duplicate
          that with a "Search anything" box that had no state, no handler, and
          no results — removed rather than leaving it visually functional but
          inert. */}
      <div className="ml-auto flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground"
          onClick={handleNotificationClick}
        >
          <Bell className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
