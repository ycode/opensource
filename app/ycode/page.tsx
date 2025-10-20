'use client';

/**
 * YCode Builder Main Page
 * 
 * Three-panel editor layout inspired by modern design tools
 */

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useEditorStore } from '../../stores/useEditorStore';
import { usePagesStore } from '../../stores/usePagesStore';
import { useAuthStore } from '../../stores/useAuthStore';
import LeftSidebar from './components/LeftSidebar';
import CenterCanvas from './components/CenterCanvas';
import RightSidebar from './components/RightSidebar';
import UpdateNotification from '../../components/UpdateNotification';
import type { Layer } from '../../types';

export default function YCodeBuilder() {
  const router = useRouter();
  const { signOut, user } = useAuthStore();
  const { selectedLayerId, setSelectedLayerId, currentPageId, setCurrentPageId, undo, redo, canUndo, canRedo, pushHistory } = useEditorStore();
  const { updateLayer, draftsByPageId, deleteLayer, saveDraft, loadPages, loadDraft, initDraft } = usePagesStore();
  const pages = usePagesStore((state) => state.pages);
  const [copiedLayer, setCopiedLayer] = useState<Layer | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showPageDropdown, setShowPageDropdown] = useState(false);
  const [viewportMode, setViewportMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [zoom, setZoom] = useState(100);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastLayersRef = useRef<string>('');
  const previousPageIdRef = useRef<string | null>(null);
  const pageDropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  // Login state (when not authenticated)
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(null);

    const { signIn } = useAuthStore.getState();
    const result = await signIn(loginEmail, loginPassword);

    if (result.error) {
      setLoginError(result.error);
      setIsLoggingIn(false);
    }
    // If successful, user state will update and component will re-render with builder
  };

  // Load pages on mount
  useEffect(() => {
    loadPages();
  }, [loadPages]);

  // Set current page to "Home" page by default, or first page if Home doesn't exist
  useEffect(() => {
    if (!currentPageId && pages.length > 0) {
      // Try to find "Home" page first (by slug or title)
      const homePage = pages.find(p => 
        p.slug?.toLowerCase() === 'home' || p.title?.toLowerCase() === 'home'
      );
      const defaultPage = homePage || pages[0];
      
      setCurrentPageId(defaultPage.id);
      
      // Load or initialize draft for this page
      if (!draftsByPageId[defaultPage.id]) {
        loadDraft(defaultPage.id).catch(() => {
          // If no draft exists, initialize with empty layers
          initDraft(defaultPage, []);
        });
      }
    }
  }, [currentPageId, pages, setCurrentPageId, draftsByPageId, loadDraft, initDraft]);

  // Handle undo
  const handleUndo = () => {
    if (!canUndo()) return;
    
    const historyEntry = undo();
    if (historyEntry && historyEntry.pageId === currentPageId) {
      const { draftsByPageId } = usePagesStore.getState();
      const draft = draftsByPageId[currentPageId];
      if (draft) {
        // Restore layers from history
        updateLayer(currentPageId, draft.layers[0]?.id || 'root', {});
        // Update entire layers array
        draft.layers = historyEntry.layers;
      }
    }
  };

  // Handle redo
  const handleRedo = () => {
    if (!canRedo()) return;
    
    const historyEntry = redo();
    if (historyEntry && historyEntry.pageId === currentPageId) {
      const { draftsByPageId } = usePagesStore.getState();
      const draft = draftsByPageId[currentPageId];
      if (draft) {
        // Restore layers from history
        draft.layers = historyEntry.layers;
      }
    }
  };

  // Get selected layer
  const selectedLayer = useMemo(() => {
    if (!currentPageId || !selectedLayerId) return null;
    const draft = draftsByPageId[currentPageId];
    if (!draft) return null;
    const stack: Layer[] = [...draft.layers];
    while (stack.length) {
      const node = stack.shift()!;
      if (node.id === selectedLayerId) return node;
      if (node.children) stack.push(...node.children);
    }
    return null;
  }, [currentPageId, selectedLayerId, draftsByPageId]);

  // Copy layer
  const copyLayer = () => {
    if (selectedLayer) {
      setCopiedLayer(JSON.parse(JSON.stringify(selectedLayer)));
      // Show toast notification
      console.log('Layer copied!');
    }
  };

  // Paste layer
  const pasteLayer = () => {
    if (!copiedLayer || !currentPageId) return;
    
    // Deep clone and generate new IDs
    const generateNewIds = (layer: Layer): Layer => {
      const newLayer = {
        ...layer,
        id: `layer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      };
      if (newLayer.children) {
        newLayer.children = newLayer.children.map(generateNewIds);
      }
      return newLayer;
    };

    const newLayer = generateNewIds(copiedLayer);
    const { addLayer } = usePagesStore.getState();
    
    // Add as sibling to selected layer or to root
    addLayer(currentPageId, null, newLayer.type);
    
    // Update the newly added layer with copied properties
    setTimeout(() => {
      const draft = draftsByPageId[currentPageId];
      const lastLayer = draft?.layers[draft.layers.length - 1];
      if (lastLayer) {
        updateLayer(currentPageId, lastLayer.id, {
          classes: newLayer.classes,
          content: newLayer.content,
          src: newLayer.src,
          children: newLayer.children,
        });
      }
    }, 100);

    console.log('Layer pasted!');
  };

  // Delete selected layer
  const deleteSelectedLayer = () => {
    if (selectedLayerId && currentPageId) {
      deleteLayer(currentPageId, selectedLayerId);
      setSelectedLayerId(null);
    }
  };

  // Immediate save function (bypasses debouncing)
  const saveImmediately = useCallback(async (pageId: string) => {
    // Clear any pending debounced save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    setIsSaving(true);
    setHasUnsavedChanges(false);
    try {
      await saveDraft(pageId);
      setLastSaved(new Date());
    } catch (error) {
      console.error('Save failed:', error);
      setHasUnsavedChanges(true);
      throw error; // Re-throw for caller to handle
    } finally {
      setIsSaving(false);
    }
  }, [saveDraft]);

  // Debounced autosave function
  const debouncedSave = useCallback((pageId: string) => {
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for 2 seconds
    saveTimeoutRef.current = setTimeout(async () => {
      setIsSaving(true);
      setHasUnsavedChanges(false);
      try {
        await saveDraft(pageId);
        setLastSaved(new Date());
      } catch (error) {
        console.error('Autosave failed:', error);
        setHasUnsavedChanges(true); // Restore unsaved flag on error
      } finally {
        setIsSaving(false);
      }
    }, 2000);
  }, [saveDraft]);

  // Save before navigating to a different page
  useEffect(() => {
    const handlePageChange = async () => {
      // If we have a previous page with unsaved changes, save it immediately
      if (previousPageIdRef.current && 
          previousPageIdRef.current !== currentPageId && 
          hasUnsavedChanges) {
        try {
          await saveImmediately(previousPageIdRef.current);
        } catch (error) {
          console.error('Failed to save before navigation:', error);
        }
      }
      
      // Update the ref to track current page
      previousPageIdRef.current = currentPageId;
    };

    handlePageChange();
  }, [currentPageId, hasUnsavedChanges, saveImmediately]);

  // Watch for draft changes and trigger autosave
  useEffect(() => {
    if (!currentPageId || !draftsByPageId[currentPageId]) {
      return;
    }

    const draft = draftsByPageId[currentPageId];
    const currentLayersJSON = JSON.stringify(draft.layers);

    // Only trigger save if layers actually changed
    if (lastLayersRef.current && lastLayersRef.current !== currentLayersJSON) {
      setHasUnsavedChanges(true);
      debouncedSave(currentPageId);
    }

    // Update the ref for next comparison
    lastLayersRef.current = currentLayersJSON;

    // Cleanup timeout on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [currentPageId, draftsByPageId, debouncedSave]);

  // Warn before closing browser with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

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
  }, [showPageDropdown]);

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
  }, [showUserDropdown]);

  // Get current page
  const currentPage = useMemo(() => {
    if (!Array.isArray(pages)) return undefined;
    return pages.find(p => p.id === currentPageId);
  }, [pages, currentPageId]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInputFocused = document.activeElement?.tagName === 'INPUT' || 
                             document.activeElement?.tagName === 'TEXTAREA';

      // Undo: Cmd/Ctrl + Z
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        if (!isInputFocused) {
          e.preventDefault();
          handleUndo();
        }
      }

      // Redo: Cmd/Ctrl + Shift + Z
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
        if (!isInputFocused) {
          e.preventDefault();
          handleRedo();
        }
      }
      
      // Copy: Cmd/Ctrl + C
      if ((e.metaKey || e.ctrlKey) && e.key === 'c' && selectedLayerId) {
        if (!isInputFocused) {
          e.preventDefault();
          copyLayer();
        }
      }
      
      // Paste: Cmd/Ctrl + V
      if ((e.metaKey || e.ctrlKey) && e.key === 'v' && copiedLayer) {
        if (!isInputFocused) {
          e.preventDefault();
          pasteLayer();
        }
      }

      // Delete: Delete or Backspace
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedLayerId) {
        if (!isInputFocused) {
          e.preventDefault();
          deleteSelectedLayer();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedLayerId, selectedLayer, copiedLayer, currentPageId]);

  // Show login form if not authenticated
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black p-4">
        <div className="bg-zinc-900 p-8 rounded-2xl shadow-2xl max-w-md w-full border border-zinc-800">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center mx-auto mb-4">
              <span className="text-gray-900 font-bold text-2xl">Y</span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              YCode Builder
            </h1>
            <p className="text-zinc-400">
              Sign in to access the visual builder
            </p>
          </div>

          {loginError && (
            <div className="bg-red-950 border border-red-800 text-red-400 px-4 py-3 rounded-lg mb-6">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-zinc-300 mb-2">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="you@example.com"
                disabled={isLoggingIn}
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-zinc-300 mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
                disabled={isLoggingIn}
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full bg-white hover:bg-zinc-200 text-black font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoggingIn ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-zinc-500">
              First time here?{' '}
              <a href="/welcome" className="text-blue-400 hover:text-blue-300">
                Complete setup
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated - show builder
  return (
    <div className="h-screen flex flex-col bg-zinc-950 text-white">
      {/* Update Notification Banner */}
      <UpdateNotification />
      
      {/* Top Header Bar */}
      <header className="h-14 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4">
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
          <div className="flex items-center gap-1 bg-zinc-800 rounded p-1">
            <button
              onClick={() => setViewportMode('desktop')}
              className={`px-3 py-1.5 text-xs rounded transition-colors ${
                viewportMode === 'desktop'
                  ? 'bg-zinc-700 text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Desktop View"
            >
              🖥️
            </button>
            <button
              onClick={() => setViewportMode('tablet')}
              className={`px-3 py-1.5 text-xs rounded transition-colors ${
                viewportMode === 'tablet'
                  ? 'bg-zinc-700 text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Tablet View"
            >
              📱
            </button>
            <button
              onClick={() => setViewportMode('mobile')}
              className={`px-3 py-1.5 text-xs rounded transition-colors ${
                viewportMode === 'mobile'
                  ? 'bg-zinc-700 text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Mobile View"
            >
              📱
            </button>
          </div>

          {/* Viewport Width */}
          <span className="text-xs text-zinc-400">
            {viewportMode === 'desktop' ? '1200px' : viewportMode === 'tablet' ? '768px' : '375px'}
          </span>

          {/* Zoom Controls */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">{zoom}%</span>
            <div className="flex flex-col">
              <button
                onClick={() => setZoom(Math.min(zoom + 10, 200))}
                className="w-3 h-3 flex items-center justify-center hover:bg-zinc-800 rounded text-zinc-400"
              >
                <svg className="w-2 h-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                </svg>
              </button>
              <button
                onClick={() => setZoom(Math.max(zoom - 10, 25))}
                className="w-3 h-3 flex items-center justify-center hover:bg-zinc-800 rounded text-zinc-400"
              >
                <svg className="w-2 h-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Right: User & Actions */}
        <div className="flex items-center gap-3">
          {/* Save Status Indicator */}
          <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
            {isSaving ? (
              <>
                {/* Saving - Blue Spinner */}
                <svg className="animate-spin h-4 w-4 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-xs text-blue-400 font-medium">Saving...</span>
              </>
            ) : hasUnsavedChanges ? (
              <>
                {/* Unsaved - Orange Warning */}
                <svg className="h-4 w-4 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9 7a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1zm1 4a1 1 0 00-1 1v3a1 1 0 102 0v-3a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span className="text-xs text-orange-400 font-medium">Unsaved</span>
              </>
            ) : lastSaved ? (
              <>
                {/* Saved - Green Check */}
                <svg className="h-4 w-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-xs text-green-500 font-medium">Saved</span>
              </>
            ) : (
              <>
                {/* No status yet */}
                <svg className="h-4 w-4 text-zinc-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 100-12 6 6 0 000 12z" clipRule="evenodd" />
                </svg>
                <span className="text-xs text-zinc-500 font-medium">Ready</span>
              </>
            )}
          </div>

          {/* View Public Page */}
          <a
            href={currentPage ? `/${currentPage.slug}` : '/'}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors"
            title="View published page"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </a>

          <button 
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
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isPublishing ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Publishing...
              </>
            ) : (
              'Publish'
            )}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Pages & Layers */}
        <LeftSidebar
          selectedLayerId={selectedLayerId}
          onLayerSelect={setSelectedLayerId}
          currentPageId={currentPageId}
          onPageSelect={setCurrentPageId}
        />

        {/* Center Canvas - Preview */}
        <CenterCanvas
          selectedLayerId={selectedLayerId}
          currentPageId={currentPageId}
          viewportMode={viewportMode}
          zoom={zoom}
        />

        {/* Right Sidebar - Properties */}
        <RightSidebar
          selectedLayerId={selectedLayerId}
          onLayerUpdate={(layerId, updates) => {
            if (currentPageId) {
              updateLayer(currentPageId, layerId, updates);
            }
          }}
        />
      </div>

      {/* Update Notification */}
      <UpdateNotification />
    </div>
  );
}
