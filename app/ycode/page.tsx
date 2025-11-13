'use client';

/**
 * YCode Builder Main Page
 *
 * Three-panel editor layout inspired by modern design tools
 */

// 1. React/Next.js
import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';

// 2. Internal components
import CenterCanvas from './components/CenterCanvas';
import CMS from './components/CMS';
import HeaderBar from './components/HeaderBar';
import LeftSidebar from './components/LeftSidebar';
import RightSidebar from './components/RightSidebar';
import UpdateNotification from '@/components/UpdateNotification';
import MigrationChecker from '@/components/MigrationChecker';

// 3. Hooks
// useCanvasCSS removed - now handled by iframe with Tailwind JIT CDN

// 4. Stores
import { useAuthStore } from '@/stores/useAuthStore';
import { useClipboardStore } from '@/stores/useClipboardStore';
import { useEditorStore } from '@/stores/useEditorStore';
import { usePagesStore } from '@/stores/usePagesStore';
import { useComponentsStore } from '@/stores/useComponentsStore';
import { useLayerStylesStore } from '@/stores/useLayerStylesStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import { useAssetsStore } from '@/stores/useAssetsStore';

// 6. Utils/lib
import { findHomepage } from '@/lib/page-utils';
import { findLayerById, getClassesString, removeLayerById } from '@/lib/layer-utils';
import { pagesApi, collectionsApi } from '@/lib/api';

// 5. Types
import type { Layer } from '@/types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertTitle } from '@/components/ui/alert';

export default function YCodeBuilder() {
  const { signOut, user } = useAuthStore();
  const { selectedLayerId, selectedLayerIds, setSelectedLayerId, clearSelection, currentPageId, setCurrentPageId, activeBreakpoint, setActiveBreakpoint, undo, redo, canUndo, canRedo, editingComponentId } = useEditorStore();
  const { updateLayer, draftsByPageId, deleteLayer, deleteLayers, saveDraft, copyLayer: copyLayerFromStore, copyLayers: copyLayersFromStore, duplicateLayer, duplicateLayers: duplicateLayersFromStore, pasteAfter, setDraftLayers, loadPages } = usePagesStore();
  const { clipboardLayer, copyLayer: copyToClipboard, cutLayer: cutToClipboard, copyStyle: copyStyleToClipboard, pasteStyle: pasteStyleFromClipboard } = useClipboardStore();
  const componentIsSaving = useComponentsStore((state) => state.isSaving);
  const pages = usePagesStore((state) => state.pages);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showPageDropdown, setShowPageDropdown] = useState(false);
  const [viewportMode, setViewportMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [zoom, setZoom] = useState(100);
  const [activeTab, setActiveTab] = useState<'pages' | 'layers' | 'cms'>('layers');
  const [publishCount, setPublishCount] = useState(0);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastLayersByPageRef = useRef<Map<string, string>>(new Map());
  const previousPageIdRef = useRef<string | null>(null);

  // Combined saving state - either page or component
  const isCurrentlySaving = editingComponentId ? componentIsSaving : isSaving;

  // Helper: Get current layers (from page or component)
  const getCurrentLayers = useCallback((): Layer[] => {
    if (editingComponentId) {
      const { componentDrafts } = useComponentsStore.getState();
      return componentDrafts[editingComponentId] || [];
    }
    if (currentPageId) {
      const draft = draftsByPageId[currentPageId];
      return draft ? draft.layers : [];
    }
    return [];
  }, [editingComponentId, currentPageId, draftsByPageId]);

  // Helper: Update current layers (page or component)
  const updateCurrentLayers = useCallback((newLayers: Layer[]) => {
    if (editingComponentId) {
      const { updateComponentDraft } = useComponentsStore.getState();
      updateComponentDraft(editingComponentId, newLayers);
    } else if (currentPageId) {
      setDraftLayers(currentPageId, newLayers);
    }
  }, [editingComponentId, currentPageId, setDraftLayers]);

  // Sync viewportMode with activeBreakpoint in store
  useEffect(() => {
    setActiveBreakpoint(viewportMode);
  }, [viewportMode, setActiveBreakpoint]);

  // Migration state - BLOCKS builder until migrations complete
  const [migrationsComplete, setMigrationsComplete] = useState(false);

  // Generate initial CSS if draft_css is empty (one-time check after data loads)
  const initialCssCheckRef = useRef(false);
  const settingsLoaded = useSettingsStore((state) => state.settings.length > 0);

  useEffect(() => {
    // Wait for all initial data to be loaded
    if (!migrationsComplete || Object.keys(draftsByPageId).length === 0 || !settingsLoaded) {
      return;
    }

    // On initial load, check if draft_css exists in settings
    if (!initialCssCheckRef.current) {
      initialCssCheckRef.current = true;
      const { getSettingByKey } = useSettingsStore.getState();
      const existingDraftCSS = getSettingByKey('draft_css');

      // If draft_css exists and is not empty, skip initial generation
      if (existingDraftCSS && existingDraftCSS.trim().length > 0) {
        console.log('[Editor] draft_css already exists, skipping initial generation');
        return;
      }

      // Generate initial CSS if it doesn't exist
      console.log('[Editor] draft_css is empty, generating initial CSS');
      const generateInitialCSS = async () => {
        try {
          const { generateAndSaveCSS } = await import('@/lib/client/cssGenerator');

          // Collect layers from ALL pages for comprehensive CSS generation
          const allLayers: Layer[] = [];
          Object.values(draftsByPageId).forEach(draft => {
            if (draft.layers) {
              allLayers.push(...draft.layers);
            }
          });

          await generateAndSaveCSS(allLayers);
        } catch (error) {
          console.error('[Editor] Failed to generate initial CSS:', error);
        }
      };

      generateInitialCSS();
    }
  }, [draftsByPageId, migrationsComplete, settingsLoaded]);

  // Add overflow-hidden to body when builder is mounted
  useEffect(() => {
    document.body.classList.add('overflow-hidden');
    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, []);

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

  // Load all data in one request after migrations complete
  const initialLoadRef = useRef(false);

  useEffect(() => {
    if (migrationsComplete && pages.length === 0 && !initialLoadRef.current) {
      initialLoadRef.current = true;

      // Load everything in one unified request
      const loadInitialData = async () => {
        try {
          const { editorApi } = await import('@/lib/api');
          const response = await editorApi.init();

          if (response.error) {
            console.error('[Editor] Error loading initial data:', response.error);
            return;
          }

          if (response.data) {
            // Set all data in stores
            const { setPagesAndDrafts, setFolders } = usePagesStore.getState();
            const { setComponents } = useComponentsStore.getState();
            const { setStyles } = useLayerStylesStore.getState();
            const { setSettings } = useSettingsStore.getState();
            const { loadAssets } = useAssetsStore.getState();

            setPagesAndDrafts(response.data.pages, response.data.drafts);
            setFolders(response.data.folders || []);
            setComponents(response.data.components);
            setStyles(response.data.styles);
            setSettings(response.data.settings);
            loadAssets();
          }
        } catch (error) {
          console.error('[Editor] Error loading initial data:', error);
        }
      };

      loadInitialData();

      // Load publish counts
      loadPublishCounts();
    }
  }, [migrationsComplete, pages.length]);

  // Load publish counts
  const loadPublishCounts = async () => {
    try {
      const [pagesResponse, collectionsResponse] = await Promise.all([
        pagesApi.getUnpublished(),
        collectionsApi.getPublishableCounts(),
      ]);

      const unpublishedPagesCount = pagesResponse.data?.length || 0;
      const collectionCounts = collectionsResponse.data || {};
      const collectionItemsCount = Object.values(collectionCounts).reduce((sum, count) => sum + count, 0);

      setPublishCount(unpublishedPagesCount + collectionItemsCount);
    } catch (error) {
      console.error('Failed to load publish counts:', error);
    }
  };

  // Set current page to homepage by default, or first page if homepage doesn't exist
  useEffect(() => {
    if (!currentPageId && pages.length > 0) {
      // Find homepage (is_index=true, page_folder_id=null)
      const homePage = findHomepage(pages);
      const defaultPage = homePage || pages[0];

      setCurrentPageId(defaultPage.id);
      setSelectedLayerId('body');
    }
  }, [currentPageId, pages, setCurrentPageId, setSelectedLayerId]);

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

      // Escape - Select parent layer
      if (e.key === 'Escape' && (currentPageId || editingComponentId) && selectedLayerId) {
        e.preventDefault();

        const layers = getCurrentLayers();
        if (!layers.length) return;

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

        const parentLayer = findParent(layers, selectedLayerId);

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
      if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && (currentPageId || editingComponentId) && selectedLayerId) {
        e.preventDefault();

        const layers = getCurrentLayers();
        if (!layers.length) return;

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

        const info = findLayerInfo(layers, selectedLayerId);
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
          newLayers = [...layers];
          [newLayers[index], newLayers[newIndex]] = [newLayers[newIndex], newLayers[index]];
        } else {
          newLayers = reorderLayers(layers);
        }

        updateCurrentLayers(newLayers);

        return;
      }

      // Tab - Select next sibling layer
      if (e.key === 'Tab' && (currentPageId || editingComponentId) && selectedLayerId) {
        e.preventDefault();

        const layers = getCurrentLayers();
        if (!layers.length) return;

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

        const info = findLayerInfo(layers, selectedLayerId);
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
  }, [selectedLayerId, currentPageId, editingComponentId, draftsByPageId, setSelectedLayerId, activeTab, getCurrentLayers, updateCurrentLayers]);

  // Handle undo
  const handleUndo = useCallback(() => {
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
  }, [canUndo, undo, currentPageId, updateLayer]);

  // Handle redo
  const handleRedo = useCallback(() => {
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
  }, [canRedo, redo, currentPageId]);

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

  // Find the next layer to select after deletion
  // Priority: next sibling > previous sibling > parent
  const findNextLayerToSelect = (layers: Layer[], layerIdToDelete: string): string | null => {
    // Helper to find layer with its parent and siblings
    const findLayerContext = (
      tree: Layer[],
      targetId: string,
      parent: Layer | null = null
    ): { layer: Layer; parent: Layer | null; siblings: Layer[] } | null => {
      for (let i = 0; i < tree.length; i++) {
        const node = tree[i];

        if (node.id === targetId) {
          return { layer: node, parent, siblings: tree };
        }

        if (node.children) {
          const found = findLayerContext(node.children, targetId, node);
          if (found) return found;
        }
      }
      return null;
    };

    const context = findLayerContext(layers, layerIdToDelete);
    if (!context) return null;

    const { parent, siblings } = context;
    const currentIndex = siblings.findIndex(s => s.id === layerIdToDelete);

    // Try next sibling
    if (currentIndex < siblings.length - 1) {
      return siblings[currentIndex + 1].id;
    }

    // Try previous sibling
    if (currentIndex > 0) {
      return siblings[currentIndex - 1].id;
    }

    // Fall back to parent
    if (parent) {
      return parent.id;
    }

    // If no parent and no siblings, try to find any other layer
    const allLayers = layers.filter(l => l.id !== layerIdToDelete);
    if (allLayers.length > 0) {
      return allLayers[0].id;
    }

    return null;
  };

  // Delete selected layer
  const deleteSelectedLayer = useCallback(() => {
    if (!selectedLayerId) return;

    // Find the next layer to select before deleting
    const layers = getCurrentLayers();
    const nextLayerId = findNextLayerToSelect(layers, selectedLayerId);

    if (editingComponentId) {
      // Delete from component draft
      const newLayers = removeLayerById(layers, selectedLayerId);
      updateCurrentLayers(newLayers);
      setSelectedLayerId(nextLayerId);
    } else if (currentPageId) {
      // Delete from page
      deleteLayer(currentPageId, selectedLayerId);
      setSelectedLayerId(nextLayerId);
    }
  }, [selectedLayerId, editingComponentId, currentPageId, getCurrentLayers, updateCurrentLayers, deleteLayer, setSelectedLayerId]);

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
          setHasUnsavedChanges(false); // Clear unsaved flag after successful save
        } catch (error) {
          console.error('Failed to save before navigation:', error);
        }
      } else if (previousPageIdRef.current !== currentPageId) {
        // Switching to a different page without unsaved changes - clear the flag
        setHasUnsavedChanges(false);
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
    const lastLayersJSON = lastLayersByPageRef.current.get(currentPageId);

    // Only trigger save if layers actually changed for THIS page
    if (lastLayersJSON && lastLayersJSON !== currentLayersJSON) {
      setHasUnsavedChanges(true);
      debouncedSave(currentPageId);
    }

    // Update the ref for next comparison (store per page)
    lastLayersByPageRef.current.set(currentPageId, currentLayersJSON);

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

  // Exit component edit mode handler
  const handleExitComponentEditMode = useCallback(async () => {
    const { editingComponentId, returnToPageId, setEditingComponentId } = useEditorStore.getState();
    const { saveComponentDraft, clearComponentDraft, componentDrafts, getComponentById, saveTimeouts } = useComponentsStore.getState();
    const { updateComponentOnLayers } = usePagesStore.getState();

    if (!editingComponentId) return;

    // Clear any pending auto-save timeout to avoid duplicate saves
    if (saveTimeouts[editingComponentId]) {
      clearTimeout(saveTimeouts[editingComponentId]);
    }

    // Immediately save component draft (ensures all changes are persisted)
    await saveComponentDraft(editingComponentId);

    // Get the updated component to get its layers
    const updatedComponent = getComponentById(editingComponentId);
    if (updatedComponent) {
      // Update all instances across pages with the new layers
      await updateComponentOnLayers(editingComponentId, updatedComponent.layers);
    }

    // Clear component draft
    clearComponentDraft(editingComponentId);

    // Return to previous page
    if (returnToPageId) {
      setCurrentPageId(returnToPageId);
    }

    // Exit edit mode
    setEditingComponentId(null, null);

    // Clear selection
    setSelectedLayerId(null);
  }, [setCurrentPageId, setSelectedLayerId]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInputFocused = document.activeElement?.tagName === 'INPUT' ||
                             document.activeElement?.tagName === 'TEXTAREA';

      // Save: Cmd/Ctrl + S
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault(); // Always prevent default browser save dialog
        if (editingComponentId) {
          // Component save is automatic via store, no manual save needed
          return;
        }
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
        if (!isInputFocused && (currentPageId || editingComponentId)) {
          e.preventDefault();
          if (selectedLayerIds.length > 1) {
            // Multi-select: delete all
            if (editingComponentId) {
              // Delete multiple from component
              const layers = getCurrentLayers();
              let newLayers = layers;
              for (const layerId of selectedLayerIds) {
                newLayers = removeLayerById(newLayers, layerId);
              }
              updateCurrentLayers(newLayers);
              clearSelection();
            } else if (currentPageId) {
              deleteLayers(currentPageId, selectedLayerIds);
              clearSelection();
            }
          } else if (selectedLayerId) {
            // Single select
            deleteSelectedLayer();
          }
        }
      }

      // Copy Style: Option + Cmd + C
      if (e.altKey && e.metaKey && e.key === 'c') {
        if (!isInputFocused && (currentPageId || editingComponentId) && selectedLayerId) {
          e.preventDefault();
          const layers = getCurrentLayers();
          const layer = findLayerById(layers, selectedLayerId);
          if (layer) {
            const classes = getClassesString(layer);
            copyStyleToClipboard(classes, layer.design, layer.styleId, layer.styleOverrides);
          }
        }
      }

      // Paste Style: Option + Cmd + V
      if (e.altKey && e.metaKey && e.key === 'v') {
        if (!isInputFocused && (currentPageId || editingComponentId) && selectedLayerId) {
          e.preventDefault();
          const style = pasteStyleFromClipboard();
          if (style) {
            if (editingComponentId) {
              // Update style in component
              const layers = getCurrentLayers();
              const updateLayerStyle = (layers: Layer[]): Layer[] => {
                return layers.map(layer => {
                  if (layer.id === selectedLayerId) {
                    return {
                      ...layer,
                      classes: style.classes,
                      design: style.design,
                      styleId: style.styleId,
                      styleOverrides: style.styleOverrides,
                    };
                  }
                  if (layer.children) {
                    return { ...layer, children: updateLayerStyle(layer.children) };
                  }
                  return layer;
                });
              };
              updateCurrentLayers(updateLayerStyle(layers));
            } else if (currentPageId) {
              updateLayer(currentPageId, selectedLayerId, {
                classes: style.classes,
                design: style.design,
                styleId: style.styleId,
                styleOverrides: style.styleOverrides,
              });
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedLayerId, selectedLayerIds, currentPageId, editingComponentId, copyLayersFromStore, copyLayerFromStore, copyToClipboard, cutToClipboard, clipboardLayer, pasteAfter, duplicateLayersFromStore, duplicateLayer, deleteLayers, deleteLayer, clearSelection, setSelectedLayerId, saveImmediately, draftsByPageId, updateLayer, copyStyleToClipboard, pasteStyleFromClipboard, deleteSelectedLayer, handleUndo, handleRedo, getCurrentLayers, updateCurrentLayers]);

  // Show login form if not authenticated
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-950 py-10">

        <svg
          className="size-5 fill-current absolute bottom-10"
          viewBox="0 0 24 24"
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

        <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-1 duration-700" style={{ animationFillMode: 'both' }}>

          <form onSubmit={handleLogin} className="flex flex-col gap-6">

            {loginError && (
              <Alert variant="destructive">
                <AlertTitle>{loginError}</AlertTitle>
              </Alert>
            )}

            <Field>
              <Label htmlFor="email">
                Email
              </Label>
              <Input
                type="email"
                id="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={isLoggingIn}
                required
              />
            </Field>

            <Field>
              <Label htmlFor="password">
                Password
              </Label>
              <Input
                type="password"
                id="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isLoggingIn}
                autoComplete="current-password"
                required
              />
            </Field>

            <Button
              type="submit"
              size="sm"
              disabled={isLoggingIn}
            >
              {isLoggingIn ? <Spinner /> : 'Sign In'}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <p className="text-xs text-white/50">
              First time here?{' '}
              <Link href="/welcome" className="text-white/80">
                Complete setup
              </Link>
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
        isSaving={isCurrentlySaving}
        hasUnsavedChanges={hasUnsavedChanges}
        lastSaved={lastSaved}
        isPublishing={isPublishing}
        setIsPublishing={setIsPublishing}
        saveImmediately={saveImmediately}
        activeTab={activeTab}
        onExitComponentEditMode={handleExitComponentEditMode}
        publishCount={publishCount}
        onPublishSuccess={() => {
          loadPublishCounts();
          loadPages();
        }}
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
                // If editing component, update component draft
                if (editingComponentId) {
                  const { componentDrafts, updateComponentDraft } = useComponentsStore.getState();
                  const layers = componentDrafts[editingComponentId] || [];

                  // Find and update layer in tree
                  const updateLayerInTree = (tree: Layer[]): Layer[] => {
                    return tree.map(layer => {
                      if (layer.id === layerId) {
                        return { ...layer, ...updates };
                      }
                      if (layer.children) {
                        return { ...layer, children: updateLayerInTree(layer.children) };
                      }
                      return layer;
                    });
                  };

                  const updatedLayers = updateLayerInTree(layers);
                  updateComponentDraft(editingComponentId, updatedLayers);
                } else if (currentPageId) {
                  // Regular page mode
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
