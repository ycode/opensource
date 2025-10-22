'use client';

import { useRef, useEffect } from 'react';
import { usePagesStore } from '../../../stores/usePagesStore';
import type { Page } from '../../../types';
import type { User } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface HeaderBarProps {
  user: User | null;
  signOut: () => Promise<void>;
  showUserDropdown: boolean;
  setShowUserDropdown: (show: boolean) => void;
  showPageDropdown: boolean;
  setShowPageDropdown: (show: boolean) => void;
  currentPage: Page | undefined;
  currentPageId: string | null;
  pages: Page[];
  setCurrentPageId: (id: string) => void;
  viewportMode: 'desktop' | 'tablet' | 'mobile';
  setViewportMode: (mode: 'desktop' | 'tablet' | 'mobile') => void;
  zoom: number;
  setZoom: (zoom: number) => void;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  lastSaved: Date | null;
  isPublishing: boolean;
  setIsPublishing: (isPublishing: boolean) => void;
  saveImmediately: (pageId: string) => Promise<void>;
}

export default function HeaderBar({
  user,
  signOut,
  showUserDropdown,
  setShowUserDropdown,
  showPageDropdown,
  setShowPageDropdown,
  currentPage,
  currentPageId,
  pages,
  setCurrentPageId,
  viewportMode,
  setViewportMode,
  zoom,
  setZoom,
  isSaving,
  hasUnsavedChanges,
  lastSaved,
  isPublishing,
  setIsPublishing,
  saveImmediately,
}: HeaderBarProps) {
  const pageDropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);

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

  // Close user dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    };

    if (showUserDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showUserDropdown, setShowUserDropdown]);

  return (
    <header className="h-14 bg-neutral-950 border-b border-white/10 flex items-center justify-between px-4">
      {/* Left: Logo & Page Selector */}
      <div className="flex items-center gap-4">
        {/* User Menu */}
        <div className="relative" ref={userDropdownRef}>
          <button
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className="flex items-center gap-2 hover:bg-zinc-800 px-2 py-1 rounded transition-colors"
          >
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
              <span className="text-white font-bold text-sm">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-300">{user?.email || 'User'}</span>
              <svg className="w-4 h-4 text-zinc-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
          </button>

          {/* User Dropdown */}
          {showUserDropdown && (
            <div className="absolute top-full right-0 mt-2 w-48 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50">
              <div className="p-2">
                <div className="px-3 py-2 text-xs text-zinc-500 border-b border-zinc-700">
                  Signed in as
                </div>
                <div className="px-3 py-2 text-sm text-zinc-300 truncate border-b border-zinc-700">
                  {user?.email}
                </div>

                <button
                  onClick={async () => {
                    await signOut();
                    // No need to redirect - user state change will show login form
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-zinc-700 rounded transition-colors mt-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
        
        <div className="relative" ref={pageDropdownRef}>
          <button
            onClick={() => setShowPageDropdown(!showPageDropdown)}
            className="flex items-center gap-2 bg-zinc-800 px-3 py-1.5 rounded border border-zinc-700 hover:bg-zinc-750 transition-colors"
          >
            <svg className="w-4 h-4 text-zinc-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
            </svg>
            <span className="text-sm font-medium text-white">
              {currentPage?.title || 'Select Page'}
            </span>
            <svg className={`w-4 h-4 text-zinc-400 transition-transform ${showPageDropdown ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {showPageDropdown && (
            <div className="absolute top-full left-0 mt-2 w-64 bg-zinc-800 border border-zinc-700 rounded shadow-xl z-50 max-h-80 overflow-y-auto">
              <div className="p-2">
                <div className="text-xs font-semibold text-zinc-500 uppercase px-2 py-1 mb-1">
                  Pages
                </div>
                {pages.length === 0 ? (
                  <div className="px-2 py-3 text-sm text-zinc-500 text-center">
                    No pages yet
                  </div>
                ) : (
                  pages.map((page) => (
                    <button
                      key={page.id}
                      onClick={() => {
                        setCurrentPageId(page.id);
                        setShowPageDropdown(false);
                      }}
                      className={`w-full flex items-center gap-2 px-2 py-2 text-sm rounded transition-colors ${
                        page.id === currentPageId
                          ? 'bg-blue-600 text-white'
                          : 'text-zinc-300 hover:bg-zinc-700'
                      }`}
                    >
                      <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
                      </svg>
                      <span className="flex-1 text-left truncate">{page.title}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Center: Viewport Controls */}
      <div className="flex items-center gap-3">
        {/* Viewport Selector */}
        <Tabs value={viewportMode} onValueChange={(value) => setViewportMode(value as 'desktop' | 'tablet' | 'mobile')} >
          <TabsList className="w-[240px]">
            <TabsTrigger value="desktop" title="Desktop View">
              Desktop
            </TabsTrigger>
            <TabsTrigger value="tablet" title="Tablet View">
              Tablet
            </TabsTrigger>
            <TabsTrigger value="mobile" title="Mobile View">
              Phone
            </TabsTrigger>
          </TabsList>
        </Tabs>
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
          <PopoverTrigger>
            <Button size="sm">Publish</Button>
          </PopoverTrigger>
          <PopoverContent>
            <div className="flex flex-col gap-3">
              <div>
                <a href={currentPage ? `/${currentPage.slug}` : '/'} target="_blank" className="text-xs text-white/90 hover:underline decoration-white/50">example.com</a>
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
                {isPublishing ? ( <Spinner className="size-3"/> ) : ('Publish')}
              </Button>
            </div>
          </PopoverContent>
        </Popover>

      </div>
    </header>
  );
}

