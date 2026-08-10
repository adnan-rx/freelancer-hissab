"use client";

import { Bell, Menu } from 'lucide-react';
import { Button } from '../ui/button';
import { useState } from 'react';
import { Toast } from '../ui/toast';

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
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
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            className="md:hidden text-muted-foreground hover:text-foreground"
            onClick={onMenuClick}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex items-center gap-4">
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
