'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

const SETTINGS_ITEMS = [
  { id: 'general', label: 'General', path: '/ycode/settings/general' },
  { id: 'users', label: 'Users', path: '/ycode/settings/users' },
  { id: 'redirects', label: 'Redirects', path: '/ycode/settings/redirects' },
  { id: 'email', label: 'Email', path: '/ycode/settings/email' },
  { id: 'templates', label: 'Templates', path: '/ycode/settings/templates' },
  { id: 'updates', label: 'Updates', path: '/ycode/settings/updates' },
];

interface SettingsContentProps {
  children: React.ReactNode;
}

export default function SettingsContent({ children }: SettingsContentProps) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left Sidebar */}
      <div className="w-60 border-r flex flex-col px-4">
        <header className="py-5 flex justify-between">
          <span className="font-medium">Settings</span>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-0">
            {SETTINGS_ITEMS.map((item) => {
              const isActive = pathname === item.path;

              return (
                <button
                  key={item.id}
                  onClick={() => router.push(item.path)}
                  className={cn(
                    'group relative flex items-center h-8 outline-none focus:outline-none rounded-lg cursor-pointer select-none w-full text-left px-2 text-xs',
                    'hover:bg-secondary/50',
                    isActive && 'bg-primary text-primary-foreground hover:bg-primary',
                    !isActive && 'text-secondary-foreground/80 dark:text-muted-foreground'
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
