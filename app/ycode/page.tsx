'use client';

/**
 * YCode Builder Main Page
 *
 * Three-panel editor layout inspired by modern design tools
 */

// 1. React/Next.js
import { useEffect, useState, useMemo, useRef, useCallback } from 'react';

// 2. Internal components
import CenterCanvas from './components/CenterCanvas';
import CMS from './components/CMS';
import HeaderBar from './components/HeaderBar';
import LeftSidebar from './components/LeftSidebar';
import RightSidebar from './components/RightSidebar';
import UpdateNotification from '../../components/UpdateNotification';
import MigrationChecker from '../../components/MigrationChecker';

// 3. Hooks
// useCanvasCSS removed - now handled by iframe with Tailwind JIT CDN

// 4. Stores
import { useAuthStore } from '../../stores/useAuthStore';
import { useClipboardStore } from '../../stores/useClipboardStore';
import { useEditorStore } from '../../stores/useEditorStore';
import { usePagesStore } from '../../stores/usePagesStore';

// 6. Utils/lib
import { findLayerById, getClassesString } from '../../lib/layer-utils';

// 5. Types
import type { Layer } from '../../types';

export default function YCodeBuilder() {
  const { signOut, user } = useAuthStore();
  const { selectedLayerId, selectedLayerIds, setSelectedLayerId, setSelectedLayerIds, clearSelection, currentPageId, setCurrentPageId, activeBreakpoint, setActiveBreakpoint, undo, redo, canUndo, canRedo, pushHistory } = useEditorStore();
  const { updateLayer, draftsByPageId, deleteLayer, deleteLayers, saveDraft, loadPages, loadDraft, initDraft, copyLayer: copyLayerFromStore, copyLayers: copyLayersFromStore, duplicateLayer, duplicateLayers: duplicateLayersFromStore, pasteAfter } = usePagesStore();
  const { clipboardLayer, copyLayer: copyToClipboard, cutLayer: cutToClipboard, copyStyle: copyStyleToClipboard, pasteStyle: pasteStyleFromClipboard } = useClipboardStore();
  const pages = usePagesStore((state) => state.pages);
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

  // Sync viewportMode with activeBreakpoint in store
  useEffect(() => {
    setActiveBreakpoint(viewportMode);
  }, [viewportMode, setActiveBreakpoint]);

  // CSS generation now handled by Tailwind JIT CDN in iframe - no need for custom CSS generation

  // Migration state - BLOCKS builder until migrations complete
  const [migrationsComplete, setMigrationsComplete] = useState(false);

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

  // Load pages only after migrations complete
  useEffect(() => {
    if (migrationsComplete) {
      loadPages();
    }
  }, [loadPages, migrationsComplete]);

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

  // Auto-select Body layer when switching pages (not when draft updates)
  useEffect(() => {
    // Only select Body if the page ID actually changed
    if (currentPageId && currentPageId !== previousPageIdRef.current) {
      // Check if draft is loaded
      if (draftsByPageId[currentPageId]) {
        setSelectedLayerId('body');
      }
      // Update the ref to track this page
      previousPageIdRef.current = currentPageId;
    }
  }, [currentPageId, draftsByPageId, setSelectedLayerId]);

  // Keyboard shortcuts for layer operations
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // A - Toggle Element Library (when on layers tab)
      if (e.key === 'a' && activeTab === 'layers') {
        e.preventDefault();
        // Dispatch custom event to toggle ElementLibrary
        window.dispatchEvent(new CustomEvent('toggleElementLibrary'));
        return;
      }

      // Escape - Select parent layer (doesn't require a selected layer)
      if (e.key === 'Escape' && currentPageId && selectedLayerId) {
        e.preventDefault();

        // Find parent of currently selected layer
        const draft = draftsByPageId[currentPageId];
        if (!draft) return;

        const findParent = (layers: Layer[], targetId: string, parent: Layer | null = null): Layer | null => {
          for (const layer of layers) {
            if (layer.id === targetId) {
              return parent;
            }
            if (layer.children) {
              const found = findParent(layer.children, targetId, layer);
              if (found !== undefined) return found;
            }
          }
          return undefined as any;
        };

        const parentLayer = findParent(draft.layers, selectedLayerId);

        // If parent exists, select it. If no parent (root level), deselect
        if (parentLayer) {
          setSelectedLayerId(parentLayer.id);
        } else {
          // At root level or Body layer selected - deselect
          setSelectedLayerId(null);
        }

        return;
      }

      // Arrow Up/Down - Reorder layer within siblings
      if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && currentPageId && selectedLayerId) {
        e.preventDefault();

        const draft = draftsByPageId[currentPageId];
        if (!draft) return;

        const direction = e.key === 'ArrowUp' ? -1 : 1;

        // Find the layer, its parent, and its index within siblings
        const findLayerInfo = (
          layers: Layer[],
          targetId: string,
          parent: Layer | null = null
        ): { layer: Layer; parent: Layer | null; siblings: Layer[]; index: number } | null => {
          for (let i = 0; i < layers.length; i++) {
            const layer = layers[i];
            if (layer.id === targetId) {
              return { layer, parent, siblings: layers, index: i };
            }
            if (layer.children) {
              const found = findLayerInfo(layer.children, targetId, layer);
              if (found) return found;
            }
          }
          return null;
        };

        const info = findLayerInfo(draft.layers, selectedLayerId);
        if (!info) return;

        const { siblings, index } = info;
        const newIndex = index + direction;

        // Check bounds
        if (newIndex < 0 || newIndex >= siblings.length) {
          return;
        }

        // Swap the layers
        const reorderLayers = (layers: Layer[]): Layer[] => {
          return layers.map(layer => {
            // If this is the parent containing our siblings, reorder them
            if (info.parent && layer.id === info.parent.id) {
              const newChildren = [...(layer.children || [])];
              // Swap
              [newChildren[index], newChildren[newIndex]] = [newChildren[newIndex], newChildren[index]];
              return { ...layer, children: newChildren };
            }

            // Recursively process children
            if (layer.children) {
              return { ...layer, children: reorderLayers(layer.children) };
            }

            return layer;
          });
        };

        let newLayers: Layer[];

        // If at root level, reorder root array directly
        if (!info.parent) {
          newLayers = [...draft.layers];
          [newLayers[index], newLayers[newIndex]] = [newLayers[newIndex], newLayers[index]];
        } else {
          newLayers = reorderLayers(draft.layers);
        }

        // Update the layers
        const { setDraftLayers } = usePagesStore.getState();
        setDraftLayers(currentPageId, newLayers);

        return;
      }

      // Tab - Select next sibling layer
      if (e.key === 'Tab' && currentPageId && selectedLayerId) {
        e.preventDefault();

        const draft = draftsByPageId[currentPageId];
        if (!draft) return;

        // Find the layer, its parent, and its index within siblings
        const findLayerInfo = (
          layers: Layer[],
          targetId: string,
          parent: Layer | null = null
        ): { layer: Layer; parent: Layer | null; siblings: Layer[]; index: number } | null => {
          for (let i = 0; i < layers.length; i++) {
            const layer = layers[i];
            if (layer.id === targetId) {
              return { layer, parent, siblings: layers, index: i };
            }
            if (layer.children) {
              const found = findLayerInfo(layer.children, targetId, layer);
              if (found) return found;
            }
          }
          return null;
        };

        const info = findLayerInfo(draft.layers, selectedLayerId);
        if (!info) return;

        const { siblings, index } = info;

        // Check if there's a next sibling
        if (index + 1 < siblings.length) {
          const nextSibling = siblings[index + 1];
          setSelectedLayerId(nextSibling.id);
        }

        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedLayerId, currentPageId, draftsByPageId, setSelectedLayerId, activeTab]);

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

      // Save: Cmd/Ctrl + S
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault(); // Always prevent default browser save dialog
        if (currentPageId) {
          saveImmediately(currentPageId);
        }
      }

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

      // Copy: Cmd/Ctrl + C (supports multi-select)
      if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
        if (!isInputFocused && currentPageId) {
          e.preventDefault();
          if (selectedLayerIds.length > 1) {
            // Multi-select: copy all
            const layers = copyLayersFromStore(currentPageId, selectedLayerIds);
            // Store first layer in clipboard store for compatibility
            if (layers.length > 0) {
              copyToClipboard(layers[0], currentPageId);
            }
          } else if (selectedLayerId) {
            // Single select - use clipboard store
            const layer = copyLayerFromStore(currentPageId, selectedLayerId);
            if (layer) {
              copyToClipboard(layer, currentPageId);
            }
          }
        }
      }

      // Cut: Cmd/Ctrl + X (supports multi-select)
      if ((e.metaKey || e.ctrlKey) && e.key === 'x') {
        if (!isInputFocused && currentPageId) {
          e.preventDefault();
          if (selectedLayerIds.length > 1) {
            // Multi-select: cut all (copy then delete)
            const layers = copyLayersFromStore(currentPageId, selectedLayerIds);
            if (layers.length > 0) {
              // Store first layer in clipboard for compatibility
              cutToClipboard(layers[0], currentPageId);
              deleteLayers(currentPageId, selectedLayerIds);
              clearSelection();
            }
          } else if (selectedLayerId) {
            // Single select
            const layer = copyLayerFromStore(currentPageId, selectedLayerId);
            if (layer && layer.id !== 'body' && !layer.locked) {
              cutToClipboard(layer, currentPageId);
              deleteLayer(currentPageId, selectedLayerId);
              setSelectedLayerId(null);
            }
          }
        }
      }

      // Paste: Cmd/Ctrl + V
      if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
        if (!isInputFocused && currentPageId) {
          e.preventDefault();
          // Use clipboard store for paste (works with context menu)
          if (clipboardLayer && selectedLayerId) {
            pasteAfter(currentPageId, selectedLayerId, clipboardLayer);
          }
        }
      }

      // Duplicate: Cmd/Ctrl + D (supports multi-select)
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        if (!isInputFocused && currentPageId) {
          e.preventDefault();
          if (selectedLayerIds.length > 1) {
            // Multi-select: duplicate all
            duplicateLayersFromStore(currentPageId, selectedLayerIds);
          } else if (selectedLayerId) {
            // Single select
            duplicateLayer(currentPageId, selectedLayerId);
          }
        }
      }

      // Delete: Delete or Backspace (supports multi-select)
      if ((e.key === 'Delete' || e.key === 'Backspace')) {
        if (!isInputFocused && currentPageId) {
          e.preventDefault();
          if (selectedLayerIds.length > 1) {
            // Multi-select: delete all
            deleteLayers(currentPageId, selectedLayerIds);
            clearSelection();
          } else if (selectedLayerId) {
            // Single select
            deleteSelectedLayer();
          }
        }
      }

      // Copy Style: Option + Cmd + C
      if (e.altKey && e.metaKey && e.key === 'c') {
        if (!isInputFocused && currentPageId && selectedLayerId) {
          e.preventDefault();
          const draft = draftsByPageId[currentPageId];
          if (draft) {
            const layer = findLayerById(draft.layers, selectedLayerId);
            if (layer) {
              const classes = getClassesString(layer);
              copyStyleToClipboard(classes, layer.design, layer.styleId, layer.styleOverrides);
            }
          }
        }
      }

      // Paste Style: Option + Cmd + V
      if (e.altKey && e.metaKey && e.key === 'v') {
        if (!isInputFocused && currentPageId && selectedLayerId) {
          e.preventDefault();
          const style = pasteStyleFromClipboard();
          if (style) {
            updateLayer(currentPageId, selectedLayerId, {
              classes: style.classes,
              design: style.design,
              styleId: style.styleId,
              styleOverrides: style.styleOverrides,
            });
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedLayerId, selectedLayerIds, currentPageId, copyLayersFromStore, copyLayerFromStore, copyToClipboard, cutToClipboard, clipboardLayer, pasteAfter, duplicateLayersFromStore, duplicateLayer, deleteLayers, deleteLayer, clearSelection, setSelectedLayerId, saveImmediately, draftsByPageId, updateLayer, copyStyleToClipboard, pasteStyleFromClipboard]);

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
                autoComplete="current-password"
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

  // Check migrations first (BLOCKING) before showing builder
  if (!migrationsComplete) {
    return <MigrationChecker onComplete={() => setMigrationsComplete(true)} />;
  }

  // Authenticated - show builder (only after migrations complete)
  return (
    <>
      <div className="h-screen flex flex-col">
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
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Pages & Layers */}
        <LeftSidebar
          selectedLayerId={selectedLayerId}
          selectedLayerIds={selectedLayerIds}
          onLayerSelect={setSelectedLayerId}
          currentPageId={currentPageId}
          onPageSelect={setCurrentPageId}
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
          </>
        )}
      </div>
    </div>
    </>
  );
}
