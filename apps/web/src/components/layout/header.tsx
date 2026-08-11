"use client";

import { Bell, Menu } from 'lucide-react';
import Link from 'next/link';
import { Button } from '../ui/button';
import { useToast } from '@/providers/toast-provider';
import { getCurrentTaxYear, taxYearLabel } from '@/lib/tax-year';
import { Logo } from '@/components/layout/logo';

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

  // Derived client-side from the Pakistani July–June convention, so this costs
  // no request on any page while still anchoring every figure below it.
  const currentYear = getCurrentTaxYear();

  return (
    <header className="print:hidden sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-card/85 px-4 backdrop-blur-md sm:px-6">
      <Button
        variant="ghost"
        size="icon-sm"
        className="md:hidden"
        onClick={onMenuClick}
        aria-label="Open navigation"
      >
        <Menu />
      </Button>

      <Link href="/dashboard" className="md:hidden">
        <Logo showWordmark={false} />
        <span className="sr-only">FreelancerHisab</span>
      </Link>

      {/* Every page has its own search/filter controls scoped to its own data
          (clients, invoices, transactions, ...); this bar used to duplicate
          that with a "Search anything" box that had no state, no handler, and
          no results — removed rather than leaving it visually functional but
          inert. */}
      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <span className="hidden items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground sm:inline-flex">
          <span className="size-1.5 rounded-full bg-brand-500" aria-hidden="true" />
          Tax year <span className="tabular text-foreground">{taxYearLabel(currentYear)}</span>
        </span>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleNotificationClick}
          aria-label="Notifications"
        >
          <Bell />
        </Button>
      </div>
    </header>
  );
}
