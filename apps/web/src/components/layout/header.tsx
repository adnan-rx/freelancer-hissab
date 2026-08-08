"use client";

import { Bell, Search, Menu, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useState } from 'react';
import { Toast } from '../ui/toast';

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [toast, setToast] = useState<{ title: string; message: string } | null>(null);

  const handleNotificationClick = () => {
    setToast({
      title: "Notifications",
      message: "You have no new notifications at this time."
    });
  };

  return (
    <>
      <header className="print:hidden h-20 bg-background flex items-center justify-between px-8 sticky top-0 z-30">
        {!isMobileSearchOpen ? (
          <>
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                className="md:hidden text-muted-foreground hover:text-foreground"
                onClick={onMenuClick}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="hidden md:flex items-center w-[400px] gap-2 bg-muted/50 rounded-full px-4 border border-transparent focus-within:border-border focus-within:bg-background transition-colors h-11">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search anything..." className="border-0 bg-transparent focus-visible:ring-0 shadow-none h-full text-foreground placeholder:text-muted-foreground text-sm" />
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium bg-background px-1.5 py-0.5 rounded border border-border shadow-sm">
                  <span>⌘</span><span>F</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                className="md:hidden text-muted-foreground hover:text-foreground"
                onClick={() => setIsMobileSearchOpen(true)}
              >
                <Search className="h-5 w-5" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-muted-foreground hover:text-foreground relative"
                onClick={handleNotificationClick}
              >
                <Bell className="h-5 w-5" />
                <span className="absolute top-2 right-2.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background"></span>
              </Button>
            </div>
          </>
        ) : (
          <div className="flex items-center w-full gap-2 animate-in fade-in slide-in-from-top-2">
            <Search className="h-5 w-5 text-muted-foreground shrink-0" />
            <Input 
              autoFocus
              placeholder="Search invoices, clients..." 
              className="flex-1 border-0 bg-transparent focus-visible:ring-0 shadow-none h-10 text-foreground placeholder:text-muted-foreground text-base" 
            />
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-muted-foreground hover:text-foreground shrink-0"
              onClick={() => setIsMobileSearchOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        )}
      </header>
      
      {toast && (
        <Toast 
          type="info"
          title={toast.title}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}
