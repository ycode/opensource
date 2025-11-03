'use client';

// 1. React/Next.js
import { useRef, useEffect, useState } from 'react';

// 2. External libraries
import { LogOut, Monitor, Moon, Sun } from 'lucide-react';

// 3. ShadCN UI
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

// 4. Stores
import { usePagesStore } from '../../../stores/usePagesStore';

// 5. Types
import type { Page } from '../../../types';
import type { User } from '@supabase/supabase-js';

interface HeaderBarProps {
  user: User | null;
  signOut: () => Promise<void>;
  showPageDropdown: boolean;
  setShowPageDropdown: (show: boolean) => void;
  currentPage: Page | undefined;
  currentPageId: string | null;
  pages: Page[];
  setCurrentPageId: (id: string) => void;
  zoom: number;
  setZoom: (zoom: number) => void;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  lastSaved: Date | null;
  isPublishing: boolean;
  setIsPublishing: (isPublishing: boolean) => void;
  saveImmediately: (pageId: string) => Promise<void>;
  activeTab: 'pages' | 'layers' | 'cms';
}

export default function HeaderBar({
  user,
  signOut,
  showPageDropdown,
  setShowPageDropdown,
  currentPage,
  currentPageId,
  pages,
  setCurrentPageId,
  zoom,
  setZoom,
  isSaving,
  hasUnsavedChanges,
  lastSaved,
  isPublishing,
  setIsPublishing,
  saveImmediately,
  activeTab,
}: HeaderBarProps) {
  const pageDropdownRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme') as 'system' | 'light' | 'dark' | null;
      return savedTheme || 'dark';
    }
    return 'dark';
  });

  // Apply theme to HTML element
  useEffect(() => {
    const root = document.documentElement;

    if (theme === 'system') {
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (systemPrefersDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    } else if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    localStorage.setItem('theme', theme);
  }, [theme]);

  // Close page dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pageDropdownRef.current && !pageDropdownRef.current.contains(event.target as Node)) {
        setShowPageDropdown(false);
      }
    };

    if (showPageDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showPageDropdown, setShowPageDropdown]);

  return (
    <header className="h-14 bg-background border-b flex items-center justify-between px-4">
      {/* Left: Logo & Page Selector */}
      <div className="flex items-center gap-2">
        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="secondary" size="sm"
              className="!size-8"
            >
              <div className="dark:text-white text-secondary-foreground">
                <svg
                  className="size-3.5 fill-current" viewBox="0 0 24 24"
                  version="1.1" xmlns="http://www.w3.org/2000/svg"
                >
                  <g
                    id="Symbols" stroke="none"
                    strokeWidth="1" fill="none"
                    fillRule="evenodd"
                  >
                    <g id="Sidebar" transform="translate(-30.000000, -30.000000)">
                      <g id="Ycode">
                        <g transform="translate(30.000000, 30.000000)">
                          <rect
                            id="Rectangle" x="0"
                            y="0" width="24"
                            height="24"
                          />
                          <path
                            id="CurrentFill" d="M11.4241533,0 L11.4241533,5.85877951 L6.024,8.978 L12.6155735,12.7868008 L10.951,13.749 L23.0465401,6.75101349 L23.0465401,12.6152717 L3.39516096,23.9856666 L3.3703726,24 L3.34318129,23.9827156 L0.96,22.4713365 L0.96,16.7616508 L3.36417551,18.1393242 L7.476,15.76 L0.96,11.9090099 L0.96,6.05375516 L11.4241533,0 Z"
                            className="fill-current"
                          />
                        </g>
                      </g>
                    </g>
                  </g>
                </svg>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Signed in as</DropdownMenuLabel>
            <DropdownMenuLabel className="font-normal text-muted-foreground">
              {user?.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                Theme
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as 'system' | 'light' | 'dark')}>
                  <DropdownMenuRadioItem value="system">
                    System
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="light">
                    Light
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="dark">
                    Dark
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={async () => {
                await signOut();
              }}
            >
              <LogOut />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

      </div>

      {/* Right: User & Actions */}
      <div className="flex items-center gap-4">
        {/* Save Status Indicator */}

        <div className="flex items-center justify-end w-[64px] text-xs text-white/50">
          {isSaving ? (
            <>
              <span>Saving</span>
            </>
          ) : hasUnsavedChanges ? (
            <>
              <span>Unsaved</span>
            </>
          ) : lastSaved ? (
            <>
              <span>Saved</span>
            </>
          ) : (
            <>
              <span>Ready</span>
            </>
          )}
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm">Publish</Button>
          </PopoverTrigger>
          <PopoverContent>
            <div className="flex flex-col gap-3">
              <div>
                <a
                  href={currentPage ? `/${currentPage.slug}` : '/'} target="_blank"
                  className="text-xs text-white/90 hover:underline decoration-white/50"
                >example.com</a>
              </div>
              <Button
                onClick={async () => {
                  if (!currentPageId) return;

                  setIsPublishing(true);
                  try {
                    // Save first if there are unsaved changes
                    if (hasUnsavedChanges) {
                      await saveImmediately(currentPageId);
                    }

                    // Then publish
                    const { publishPage } = usePagesStore.getState();
                    await publishPage(currentPageId);
                  } catch (error) {
                    console.error('Publish failed:', error);
                  } finally {
                    setIsPublishing(false);
                  }
                }}
                disabled={isPublishing || isSaving}
                size="sm"
                className="w-full"
              >
                {isPublishing ? ( <Spinner className="size-3" /> ) : ('Publish')}
              </Button>
            </div>
          </PopoverContent>
        </Popover>

      </div>
    </header>
  );
}

