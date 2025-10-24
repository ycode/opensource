'use client';

/**
 * YCode Builder Main Page
 * 
 * Three-panel editor layout inspired by modern design tools
 */

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useEditorStore } from '../../stores/useEditorStore';
import { usePagesStore } from '../../stores/usePagesStore';
import { useAuthStore } from '../../stores/useAuthStore';
import LeftSidebar from './components/LeftSidebar';
import CenterCanvas from './components/CenterCanvas';
import RightSidebar from './components/RightSidebar';
import HeaderBar from './components/HeaderBar';
import CMS from './components/CMS';
import UpdateNotification from '../../components/UpdateNotification';
import { RealtimeCursors } from '../../components/realtime-cursors';
import ActivityNotifications from '../../components/collaboration/ActivityNotifications';
import { useLayerLocks } from '../../hooks/use-layer-locks';
import { useLiveLayerUpdates } from '../../hooks/use-live-layer-updates';
import { useLivePageUpdates } from '../../hooks/use-live-page-updates';
import { useCollaborationPresenceStore, startLockExpirationCheck, startNotificationCleanup } from '../../stores/useCollaborationPresenceStore';
import type { Layer } from '../../types';

export default function YCodeBuilder() {
  const { signOut, user } = useAuthStore();
  const { selectedLayerId, setSelectedLayerId, currentPageId, setCurrentPageId, undo, redo, canUndo, canRedo, pushHistory } = useEditorStore();
  const { updateLayer, draftsByPageId, deleteLayer, saveDraft, loadPages, loadDraft, initDraft } = usePagesStore();
  const pages = usePagesStore((state) => state.pages);
  
  // Get user display name for cursor
  const userDisplayName = user?.email?.split('@')[0] || 'User';
  
  // Initialize collaboration features
  const layerLocks = useLayerLocks();
  const liveLayerUpdates = useLiveLayerUpdates(currentPageId);
  const livePageUpdates = useLivePageUpdates();
  const { currentUserId } = useCollaborationPresenceStore();
  
  // Layer selection handler with lock checking
  const handleLayerSelect = useCallback(async (layerId: string) => {
    if (!currentUserId) {
      console.warn('No current user ID, cannot select layer');
      return;
    }
    
    try {
      // Release lock on previously selected layer if different
      if (selectedLayerId && selectedLayerId !== layerId) {
        await layerLocks.releaseLock(selectedLayerId);
      }
      
      // Check if layer is locked by another user
      const isLocked = layerLocks.isLayerLocked(layerId);
      const canEdit = layerLocks.canEditLayer(layerId);
      
      if (isLocked && !canEdit) {
        return;
      }
      
      // Try to acquire lock and select layer
      const lockAcquired = await layerLocks.acquireLock(layerId);

      if (lockAcquired) {
        setSelectedLayerId(layerId);
      } else {
        console.warn(`[DEBUG] Failed to acquire lock for layer ${layerId}`);
      }
    } catch (error) {
      console.error(`[DEBUG] Error in handleLayerSelect:`, error);
    }
  }, [currentUserId, selectedLayerId, layerLocks, setSelectedLayerId]);

  // Page selection handler with lock release
  const handlePageSelect = useCallback(async (pageId: string) => {
    if (!currentUserId) return;
    
    console.log(`[PAGE-SELECT] Switching from page ${currentPageId} to page ${pageId}`);
    
    // Release all locks on the current page before switching
    if (currentPageId) {
      console.log(`[PAGE-SELECT] Releasing all locks on page ${currentPageId}`);
      await layerLocks.releaseAllLocks();
    }
    
    // Clear selected layer and switch page
    setSelectedLayerId(null);
    setCurrentPageId(pageId);
    
    console.log(`[PAGE-SELECT] Switched to page ${pageId}`);
  }, [currentUserId, currentPageId, layerLocks, setSelectedLayerId, setCurrentPageId]);

  // Layer deselection handler with lock release
  const handleLayerDeselect = useCallback(async () => {
    if (!currentUserId || !selectedLayerId) return;
    
    console.log(`Deselecting layer ${selectedLayerId} and releasing lock`);
    
    // Optimistically update UI immediately
    setSelectedLayerId(null);
    
    // Then release the lock (will broadcast to others)
    await layerLocks.releaseLock(selectedLayerId);
    console.log(`Lock released for layer ${selectedLayerId}`);
  }, [currentUserId, selectedLayerId, layerLocks, setSelectedLayerId]);
  
  const [copiedLayer, setCopiedLayer] = useState<Layer | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showPageDropdown, setShowPageDropdown] = useState(false);
  const [viewportMode, setViewportMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [zoom, setZoom] = useState(100);
  const [activeTab, setActiveTab] = useState<'pages' | 'layers' | 'cms'>('layers');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastLayersRef = useRef<string>('');
  const previousPageIdRef = useRef<string | null>(null);

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
  
  // Initialize collaboration services
  useEffect(() => {
    startLockExpirationCheck();
    startNotificationCleanup();
    
    return () => {
      // Cleanup will be handled by the store
    };
  }, []);


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
      // Broadcast the layer deletion to other users
      liveLayerUpdates.broadcastLayerDelete(currentPageId, selectedLayerId);
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
    <div className="h-screen flex flex-col bg-zinc-950 text-white relative">
      {/* Update Notification Banner */}
      <UpdateNotification />
      
      {/* Top Header Bar */}
      <HeaderBar
        user={user}
        signOut={signOut}
        showPageDropdown={showPageDropdown}
        setShowPageDropdown={setShowPageDropdown}
        currentPage={currentPage}
        currentPageId={currentPageId}
        pages={pages}
        setCurrentPageId={setCurrentPageId}
        zoom={zoom}
        setZoom={setZoom}
        isSaving={isSaving}
        hasUnsavedChanges={hasUnsavedChanges}
        lastSaved={lastSaved}
        isPublishing={isPublishing}
        setIsPublishing={setIsPublishing}
        saveImmediately={saveImmediately}
        activeTab={activeTab}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar - Pages & Layers */}
        <LeftSidebar
          selectedLayerId={selectedLayerId}
          onLayerSelect={handleLayerSelect}
          currentPageId={currentPageId}
          onPageSelect={handlePageSelect}
          livePageUpdates={livePageUpdates}
          liveLayerUpdates={liveLayerUpdates}
          onActiveTabChange={setActiveTab}
        />

        {/* Conditional Content Based on Active Tab */}
        {activeTab === 'cms' ? (
          <CMS />
        ) : (
          <>
            {/* Center Canvas - Preview */}
            <CenterCanvas
              selectedLayerId={selectedLayerId}
              currentPageId={currentPageId}
              viewportMode={viewportMode}
              setViewportMode={setViewportMode}
              zoom={zoom}
              onLayerSelect={handleLayerSelect}
              onLayerDeselect={handleLayerDeselect}
              liveLayerUpdates={liveLayerUpdates}
            />

            {/* Right Sidebar - Properties */}
            <RightSidebar
              selectedLayerId={selectedLayerId}
              onLayerUpdate={(layerId, updates) => {
                if (currentPageId) {
                  updateLayer(currentPageId, layerId, updates);
                  // Broadcast the update to other users
                  liveLayerUpdates.broadcastLayerUpdate(layerId, updates);
                }
              }}
              liveLayerUpdates={liveLayerUpdates}
              currentPageId={currentPageId}
            />
          </>
        )}

        {/* Realtime Cursors for Collaboration */}
        {user && currentPageId && (
          <RealtimeCursors 
            roomName={`page-${currentPageId}`} 
            username={userDisplayName} 
          />
        )}
      </div>

      {/* Collaboration Components */}
      {user && currentPageId && (
        <>
          {/* Activity Notifications */}
          <ActivityNotifications 
            position="bottom-right"
            maxNotifications={5}
            autoHide={true}
            hideDelay={5000}
          />
        </>
      )}

      {/* Update Notification */}
      <UpdateNotification />
    </div>
  );
}
