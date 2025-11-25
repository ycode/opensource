'use client';

import React, { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import HeaderBar from '@/app/ycode/components/HeaderBar';
import { useAuthStore } from '@/stores/useAuthStore';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

const SETTINGS_ITEMS = [
  { id: 'general', label: 'General', path: '/settings/general' },
  { id: 'redirects', label: 'Redirects', path: '/settings/redirects' },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuthStore();
  const [showPageDropdown, setShowPageDropdown] = useState(false);

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <HeaderBar
        user={user}
        signOut={signOut}
        showPageDropdown={showPageDropdown}
        setShowPageDropdown={setShowPageDropdown}
        currentPage={undefined}
        currentPageId={null}
        pages={[]}
        setCurrentPageId={() => {}}
        zoom={100}
        setZoom={() => {}}
        isSaving={false}
        hasUnsavedChanges={false}
        lastSaved={null}
        isPublishing={false}
        setIsPublishing={() => {}}
        saveImmediately={async () => {}}
        activeTab="pages"
        publishCount={0}
        onPublishSuccess={() => {}}
      />

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
    </div>
  );
}
