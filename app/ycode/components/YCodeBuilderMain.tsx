'use client';

/**
 * YCode Builder Main Component
 *
 * Three-panel editor layout inspired by modern design tools
 *
 * This component is shared across ALL editor routes to prevent remounts:
 * - /ycode (base route)
 * - /ycode/pages/[id]/edit (page settings)
 * - /ycode/pages/[id]/layers (page layers)
 * - /ycode/collections/[id] (collections)
 * - /ycode/components/[id] (component editing)
 * - /ycode/settings (settings pages)
 * - /ycode/localization (localization pages)
 *
 * By using the same component instance everywhere, we prevent migration
 * checks and data reloads on every navigation.
 */

// 1. React/Next.js
import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// 2. Internal components
import CenterCanvas from '../components/CenterCanvas';
import CMS from '../components/CMS';
import HeaderBar from '../components/HeaderBar';
import LeftSidebar from '../components/LeftSidebar';
import RightSidebar from '../components/RightSidebar';
import SettingsContent from '../components/SettingsContent';
import LocalizationContent from '../components/LocalizationContent';
import UpdateNotification from '@/components/UpdateNotification';
import MigrationChecker from '@/components/MigrationChecker';
import BuilderLoading from '@/components/BuilderLoading';
import CollectionItemSheet from '../components/CollectionItemSheet';

// 3. Hooks
// useCanvasCSS removed - now handled by iframe with Tailwind JIT CDN
import { useEditorUrl } from '@/hooks/use-editor-url';

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
import { useMigrationStore } from '@/stores/useMigrationStore';

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

interface YCodeBuilderProps {
  children?: React.ReactNode;
}

export default function YCodeBuilder({ children }: YCodeBuilderProps = {} as YCodeBuilderProps) {
  const router = useRouter();
  const { routeType, resourceId, sidebarTab, navigateToLayers, urlState, updateQueryParams } = useEditorUrl();

  // Optimize store subscriptions - use selective selectors to prevent unnecessary re-renders
  const signOut = useAuthStore((state) => state.signOut);
  const user = useAuthStore((state) => state.user);
  const authInitialized = useAuthStore((state) => state.initialized);

  const selectedLayerId = useEditorStore((state) => state.selectedLayerId);
  const selectedLayerIds = useEditorStore((state) => state.selectedLayerIds);
  const setSelectedLayerId = useEditorStore((state) => state.setSelectedLayerId);
  const clearSelection = useEditorStore((state) => state.clearSelection);
  const currentPageId = useEditorStore((state) => state.currentPageId);
  const setCurrentPageId = useEditorStore((state) => state.setCurrentPageId);
  const activeBreakpoint = useEditorStore((state) => state.activeBreakpoint);
  const setActiveBreakpoint = useEditorStore((state) => state.setActiveBreakpoint);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const canUndo = useEditorStore((state) => state.canUndo);
  const canRedo = useEditorStore((state) => state.canRedo);
  const editingComponentId = useEditorStore((state) => state.editingComponentId);
  const builderDataPreloaded = useEditorStore((state) => state.builderDataPreloaded);
  const setBuilderDataPreloaded = useEditorStore((state) => state.setBuilderDataPreloaded);
  const collectionItemSheet = useEditorStore((state) => state.collectionItemSheet);
  const closeCollectionItemSheet = useEditorStore((state) => state.closeCollectionItemSheet);

  const updateLayer = usePagesStore((state) => state.updateLayer);
  const draftsByPageId = usePagesStore((state) => state.draftsByPageId);
  const deleteLayer = usePagesStore((state) => state.deleteLayer);
  const deleteLayers = usePagesStore((state) => state.deleteLayers);
  const saveDraft = usePagesStore((state) => state.saveDraft);
  const copyLayerFromStore = usePagesStore((state) => state.copyLayer);
  const copyLayersFromStore = usePagesStore((state) => state.copyLayers);
  const duplicateLayer = usePagesStore((state) => state.duplicateLayer);
  const duplicateLayersFromStore = usePagesStore((state) => state.duplicateLayers);
  const pasteAfter = usePagesStore((state) => state.pasteAfter);
  const setDraftLayers = usePagesStore((state) => state.setDraftLayers);
  const loadPages = usePagesStore((state) => state.loadPages);
  const pages = usePagesStore((state) => state.pages);

  const clipboardLayer = useClipboardStore((state) => state.clipboardLayer);
  const copyToClipboard = useClipboardStore((state) => state.copyLayer);
  const cutToClipboard = useClipboardStore((state) => state.cutLayer);
  const copyStyleToClipboard = useClipboardStore((state) => state.copyStyle);
  const pasteStyleFromClipboard = useClipboardStore((state) => state.pasteStyle);

  const componentIsSaving = useComponentsStore((state) => state.isSaving);
  const components = useComponentsStore((state) => state.components);

  const migrationsComplete = useMigrationStore((state) => state.migrationsComplete);
  const setMigrationsComplete = useMigrationStore((state) => state.setMigrationsComplete);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showPageDropdown, setShowPageDropdown] = useState(false);
  const [viewportMode, setViewportMode] = useState<'desktop' | 'tablet' | 'mobile'>(
    urlState.view || 'desktop'
  );
  const [publishCount, setPublishCount] = useState(0);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastLayersByPageRef = useRef<Map<string, string>>(new Map());
  const previousPageIdRef = useRef<string | null>(null);
  const hasInitializedLayerFromUrlRef = useRef(false);
  const lastUrlLayerIdRef = useRef<string | null>(null);
  const previousIsEditingRef = useRef<boolean | undefined>(undefined);

  // Sidebar tab is inferred from route type
  const activeTab = sidebarTab;

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

  // Check if Supabase is configured, redirect to setup if not
  const [supabaseConfigured, setSupabaseConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    const checkSupabaseConfig = async () => {
      try {
        const response = await fetch('/api/setup/status');
        const data = await response.json();

        if (!data.is_configured) {
          // Redirect to setup wizard
          router.push('/welcome');
          return;
        }

        setSupabaseConfigured(true);
      } catch (err) {
        console.error('Failed to check Supabase config:', err);
        // On error, redirect to setup to be safe
        router.push('/welcome');
      }
    };

    checkSupabaseConfig();
  }, [router]);

  // Sync viewportMode with activeBreakpoint in store
  useEffect(() => {
    setActiveBreakpoint(viewportMode);
  }, [viewportMode, setActiveBreakpoint]);

  // Track edit mode transitions to prevent effects from running during navigation
  const currentIsEditing = urlState.isEditing;
  const justExitedEditMode = previousIsEditingRef.current === true && currentIsEditing === false;

  // Update ref synchronously before effects run
  if (previousIsEditingRef.current !== currentIsEditing) {
    previousIsEditingRef.current = currentIsEditing;
  }

  // Sync viewport changes to URL (skip when in page settings mode or during edit mode transition)
  useEffect(() => {
    // Skip if we just transitioned away from edit mode - navigation already includes all params
    if (justExitedEditMode) {
      return;
    }

    if ((routeType === 'page' || routeType === 'layers') && !urlState.isEditing && urlState.view !== viewportMode) {
      updateQueryParams({ view: viewportMode });
    }
  }, [viewportMode, routeType, updateQueryParams, urlState.view, urlState.isEditing, justExitedEditMode]);

  // Reset layer initialization flag when route type changes
  useEffect(() => {
    // When switching between route types, reset initialization so new route can initialize properly
    hasInitializedLayerFromUrlRef.current = false;
    lastUrlLayerIdRef.current = null;
  }, [routeType]);

  // Initialize selected layer from URL on mount/navigation
  useEffect(() => {
    // Handle layer selection for pages and components
    const isPageOrLayersRoute = routeType === 'page' || routeType === 'layers';
    const isComponentRoute = routeType === 'component';

    if ((isPageOrLayersRoute || isComponentRoute) && urlState.layerId) {
      // For pages, wait for draft. For components, wait for component draft
      if (isPageOrLayersRoute && currentPageId) {
        const draft = draftsByPageId[currentPageId];
        if (!draft || !draft.layers) {
          return; // Draft not loaded yet, wait for next render
        }
      } else if (isComponentRoute && editingComponentId) {
        const componentDrafts = useComponentsStore.getState().componentDrafts;
        if (!componentDrafts[editingComponentId]) {
          return; // Component draft not loaded yet
        }
      } else {
        return; // Not ready yet
      }

      // Only set from URL if the URL layer ID actually changed (not from our own sync)
      if (urlState.layerId !== lastUrlLayerIdRef.current) {
        lastUrlLayerIdRef.current = urlState.layerId;

        // Validate that the layer exists in current page/component
        const layers = getCurrentLayers();
        const layerExists = findLayerById(layers, urlState.layerId);

        if (layerExists) {
          // Layer found - use it
          console.log('[Editor] Setting layer from URL:', urlState.layerId);
          setSelectedLayerId(urlState.layerId);
          hasInitializedLayerFromUrlRef.current = true;
        } else {
          // Layer not found - clear selection and update URL
          console.warn(`[Editor] Layer "${urlState.layerId}" not found, clearing selection`);
          setSelectedLayerId(null);
          hasInitializedLayerFromUrlRef.current = true;
          updateQueryParams({ layer: undefined });
          lastUrlLayerIdRef.current = null;
        }
      }
    } else if ((isPageOrLayersRoute || isComponentRoute) && !urlState.layerId) {
      // No layer in URL - mark as initialized so clicks will update URL from now on
      if (isPageOrLayersRoute && currentPageId) {
        const draft = draftsByPageId[currentPageId];
        if (draft && draft.layers) {
          // Once the draft is loaded, mark as initialized even without a layer param
          hasInitializedLayerFromUrlRef.current = true;
          lastUrlLayerIdRef.current = null;
        }
      } else if (isComponentRoute && editingComponentId) {
        const componentDrafts = useComponentsStore.getState().componentDrafts;
        if (componentDrafts[editingComponentId]) {
          // Once the component draft is loaded, mark as initialized
          hasInitializedLayerFromUrlRef.current = true;
          lastUrlLayerIdRef.current = null;
        }
      }
    }
  }, [urlState.layerId, resourceId, routeType, setSelectedLayerId, updateQueryParams, currentPageId, editingComponentId, draftsByPageId, getCurrentLayers]);

  // Sync selected layer to URL (but only after initialization from URL, skip when in page settings mode or during edit mode transition)
  useEffect(() => {
    // Skip if we just transitioned away from edit mode - navigation already includes all params
    if (justExitedEditMode) {
      return;
    }

    const isPageOrLayersRoute = routeType === 'page' || routeType === 'layers';
    const isComponentRoute = routeType === 'component';

    if ((isPageOrLayersRoute || isComponentRoute) && !urlState.isEditing && hasInitializedLayerFromUrlRef.current) {
      const layerParam = selectedLayerId || undefined;
      // Only update if the layer has actually changed from URL
      if (urlState.layerId !== layerParam) {
        updateQueryParams({ layer: layerParam });
        lastUrlLayerIdRef.current = layerParam || null;
      }
    }
  }, [selectedLayerId, routeType, updateQueryParams, urlState.layerId, urlState.isEditing, justExitedEditMode]);

  // Generate initial CSS if draft_css is empty (one-time check after data loads)
  const initialCssCheckRef = useRef(false);
  const settingsLoaded = useSettingsStore((state) => state.settings.length > 0);
  const draftsCount = Object.keys(draftsByPageId).length;

  useEffect(() => {
    // Early return if already checked - this must be the FIRST check
    if (initialCssCheckRef.current) {
      return;
    }

    // Wait for all initial data to be loaded
    if (!migrationsComplete || draftsCount === 0 || !settingsLoaded) {
      return;
    }

    // Mark as checked immediately to prevent re-runs, even if we return early below
    initialCssCheckRef.current = true;

    // On initial load, check if draft_css exists in settings
    const { getSettingByKey } = useSettingsStore.getState();
    const existingDraftCSS = getSettingByKey('draft_css');

    // If draft_css exists and is not empty, skip initial generation
    if (existingDraftCSS && existingDraftCSS.trim().length > 0) {
      // Don't log here - this is expected behavior and happens once
      return;
    }

    // Generate initial CSS if it doesn't exist
    console.log('[Editor] draft_css is empty, generating initial CSS');
    const generateInitialCSS = async () => {
      try {
        const { generateAndSaveCSS } = await import('@/lib/client/cssGenerator');

        // Collect layers from ALL pages for comprehensive CSS generation
        // Use current draftsByPageId from store at execution time
        const currentDrafts = usePagesStore.getState().draftsByPageId;
        const allLayers: Layer[] = [];
        Object.values(currentDrafts).forEach(draft => {
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
  }, [migrationsComplete, draftsCount, settingsLoaded]);

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

  // Track initial data load completion
  const initialLoadRef = useRef(false);

  useEffect(() => {
    if (migrationsComplete && !builderDataPreloaded && !initialLoadRef.current) {
      initialLoadRef.current = true;

      // Load everything in parallel using Promise.all
      const loadBuilderData = async () => {
        try {
          const { editorApi } = await import('@/lib/api');
          const response = await editorApi.init();

          if (response.error) {
            console.error('[Editor] Error loading initial data:', response.error);
            setBuilderDataPreloaded(true); // Allow UI to render even on error
            return;
          }

          if (response.data) {
            // Get store actions
            const { setPagesAndDrafts, setFolders } = usePagesStore.getState();
            const { setComponents } = useComponentsStore.getState();
            const { setStyles } = useLayerStylesStore.getState();
            const { setSettings } = useSettingsStore.getState();
            const { loadAssets } = useAssetsStore.getState();
            const { preloadCollectionsAndItems } = useCollectionsStore.getState();

            // Set synchronous data first
            setPagesAndDrafts(response.data.pages, response.data.drafts);
            setFolders(response.data.folders || []);
            setComponents(response.data.components);
            setStyles(response.data.styles);
            setSettings(response.data.settings);

            // Load async data in parallel
            const asyncTasks = [
              loadAssets(),
            ];

            // Add collections preloading if we have collections
            if (response.data.collections && response.data.collections.length > 0) {
              asyncTasks.push(preloadCollectionsAndItems(response.data.collections));
            }

            // Wait for all async tasks to complete
            await Promise.all(asyncTasks);

            // Mark data as preloaded - NOW UI can render
            setBuilderDataPreloaded(true);
          }
        } catch (error) {
          console.error('[Editor] Error loading builder data:', error);
          setBuilderDataPreloaded(true); // Allow UI to render even on error
        }
      };

      loadBuilderData();

      // Load publish counts (non-blocking)
      loadPublishCounts();
    }
  }, [migrationsComplete, builderDataPreloaded, setBuilderDataPreloaded]);

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

  // Handle URL-based navigation after data loads
  useEffect(() => {
    // For pages, wait for pages to load. For components, wait for components to load
    const isPagesRoute = routeType === 'layers' || routeType === 'page' || !routeType;
    const isComponentRoute = routeType === 'component';

    if (!migrationsComplete) return;
    if (isPagesRoute && pages.length === 0) return;
    if (isComponentRoute && components.length === 0) return;

    // Handle route types: layers, page, collection, collections-base, component
    if ((routeType === 'layers' || routeType === 'page') && resourceId) {
      const page = pages.find(p => p.id === resourceId);
      if (page && currentPageId !== resourceId) {
        setCurrentPageId(resourceId);
        // Only select body for layers mode if no layer is specified in URL
        if (routeType === 'layers' && !urlState.layerId) {
          setSelectedLayerId('body');
        }
      }
    } else if (routeType === 'collection' && resourceId) {
      const { setSelectedCollectionId } = useCollectionsStore.getState();
      setSelectedCollectionId(resourceId); // resourceId is already a UUID string
    } else if (routeType === 'collections-base') {
      // On base collections route, don't set a selected collection
      // The CMS component will show all collections or empty state
    } else if (routeType === 'component' && resourceId) {
      const { getComponentById, loadComponentDraft } = useComponentsStore.getState();
      const component = getComponentById(resourceId);
      if (component && editingComponentId !== resourceId) {
        const { setEditingComponentId } = useEditorStore.getState();
        // Use currentPageId if available, otherwise find homepage as fallback
        const returnPageId = currentPageId || (pages.length > 0 ? (findHomepage(pages)?.id || pages[0]?.id) : null);
        setEditingComponentId(resourceId, returnPageId);
        loadComponentDraft(resourceId);
      }
    } else if (!currentPageId && !routeType && pages.length > 0) {
      // No URL resource and no current page - set default page and redirect to layers
      const homePage = findHomepage(pages);
      const defaultPage = homePage || pages[0];
      setCurrentPageId(defaultPage.id);
      setSelectedLayerId('body');
      // Redirect to layers route for the default page with default params
      // navigateToLayers will automatically include view=desktop, tab=design, layer=body
      navigateToLayers(defaultPage.id);
    }
  }, [migrationsComplete, pages.length, components.length, routeType, resourceId, currentPageId, editingComponentId, pages, components, setCurrentPageId, setSelectedLayerId, navigateToLayers, urlState.layerId]);

  // Auto-select Body layer when switching pages (not when draft updates)
  useEffect(() => {
    // Only select Body if the page ID actually changed and no layer is specified in URL
    if (currentPageId && currentPageId !== previousPageIdRef.current) {
      // Update the ref to track this page FIRST
      previousPageIdRef.current = currentPageId;

      // Check if draft is loaded
      if (draftsByPageId[currentPageId] && !urlState.layerId) {
        setSelectedLayerId('body');
      }
      // If urlState.layerId exists, let the URL initialization effect handle it
    }
  }, [currentPageId, draftsByPageId, setSelectedLayerId, urlState.layerId]);

  // Handle undo
  const handleUndo = useCallback(() => {
    if (!canUndo()) return;

    const historyEntry = undo();
    if (historyEntry && historyEntry.pageId === currentPageId) {
      const draft = draftsByPageId[currentPageId];
      if (draft) {
        // Restore layers from history
        updateLayer(currentPageId, draft.layers[0]?.id || 'root', {});
        // Update entire layers array
        draft.layers = historyEntry.layers;
      }
    }
  }, [canUndo, undo, currentPageId, draftsByPageId, updateLayer]);

  // Handle redo
  const handleRedo = useCallback(() => {
    if (!canRedo()) return;

    const historyEntry = redo();
    if (historyEntry && historyEntry.pageId === currentPageId) {
      const draft = draftsByPageId[currentPageId];
      if (draft) {
        // Restore layers from history
        draft.layers = historyEntry.layers;
      }
    }
  }, [canRedo, redo, currentPageId, draftsByPageId]);

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
      // Check if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      const isInputFocused = target.tagName === 'INPUT' ||
                             target.tagName === 'TEXTAREA' ||
                             target.isContentEditable;

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

      // Layer-specific shortcuts (only work on layers tab)
      if (activeTab === 'layers') {
        // A - Toggle Element Library (when on layers tab and not typing)
        if (e.key === 'a' && !isInputFocused) {
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

        // Tab - Select next sibling layer (only when not in input)
        if (e.key === 'Tab' && !isInputFocused && (currentPageId || editingComponentId) && selectedLayerId) {
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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeTab,
    selectedLayerId,
    selectedLayerIds,
    currentPageId,
    editingComponentId,
    draftsByPageId,
    setSelectedLayerId,
    getCurrentLayers,
    updateCurrentLayers,
    copyLayersFromStore,
    copyLayerFromStore,
    copyToClipboard,
    cutToClipboard,
    clipboardLayer,
    pasteAfter,
    duplicateLayersFromStore,
    duplicateLayer,
    deleteLayers,
    deleteLayer,
    clearSelection,
    saveImmediately,
    updateLayer,
    copyStyleToClipboard,
    pasteStyleFromClipboard,
    deleteSelectedLayer,
    handleUndo,
    handleRedo
  ]);

  // Show loading screen while checking Supabase config
  if (supabaseConfigured === null) {
    return <BuilderLoading message="Checking configuration..." />;
  }

  // Show loading screen while checking authentication
  if (!authInitialized) {
    return <BuilderLoading message="Checking authentication..." />;
  }

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

  // Wait for builder data to be preloaded (BLOCKING) - prevents race conditions
  if (!builderDataPreloaded) {
    return <BuilderLoading message="Loading builder data..." />;
  }

  // Authenticated - show builder (only after migrations AND data preload complete)
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
        currentPage={routeType === 'settings' || routeType === 'localization' ? undefined : currentPage}
        currentPageId={routeType === 'settings' || routeType === 'localization' ? null : currentPageId}
        pages={routeType === 'settings' || routeType === 'localization' ? [] : pages}
        setCurrentPageId={routeType === 'settings' || routeType === 'localization' ? () => {} : setCurrentPageId}
        isSaving={routeType === 'settings' || routeType === 'localization' ? false : isCurrentlySaving}
        hasUnsavedChanges={routeType === 'settings' || routeType === 'localization' ? false : hasUnsavedChanges}
        lastSaved={routeType === 'settings' || routeType === 'localization' ? null : lastSaved}
        isPublishing={routeType === 'settings' || routeType === 'localization' ? false : isPublishing}
        setIsPublishing={routeType === 'settings' || routeType === 'localization' ? () => {} : setIsPublishing}
        saveImmediately={routeType === 'settings' || routeType === 'localization' ? async () => {} : saveImmediately}
        activeTab={routeType === 'settings' || routeType === 'localization' ? 'pages' : activeTab}
        onExitComponentEditMode={handleExitComponentEditMode}
        publishCount={routeType === 'settings' || routeType === 'localization' ? 0 : publishCount}
        onPublishSuccess={routeType === 'settings' || routeType === 'localization' ? () => {} : () => {
          loadPublishCounts();
          // No need to reload pages - publish already updates store state
        }}
        isSettingsRoute={routeType === 'settings' || routeType === 'localization'}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Settings Route - Render Settings Content */}
        {routeType === 'settings' ? (
          <SettingsContent>{children}</SettingsContent>
        ) : routeType === 'localization' ? (
          <LocalizationContent>{children}</LocalizationContent>
        ) : (
          <>
            {/* Left Sidebar - Pages & Layers */}
            <LeftSidebar
              selectedLayerId={selectedLayerId}
              selectedLayerIds={selectedLayerIds}
              onLayerSelect={setSelectedLayerId}
              currentPageId={currentPageId}
              onPageSelect={setCurrentPageId}
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
          </>
        )}
      </div>
    </div>

    {/* Collection Item Sheet - renders globally */}
    {(() => {
      return collectionItemSheet && (
        <CollectionItemSheet
          open={collectionItemSheet.open}
          onOpenChange={(open) => {
            if (!open) closeCollectionItemSheet();
          }}
          collectionId={collectionItemSheet.collectionId}
          itemId={collectionItemSheet.itemId}
          onSuccess={() => {
            // Close sheet after successful save
            closeCollectionItemSheet();
          }}
        />
      );
    })()}
    </>
  );
}
