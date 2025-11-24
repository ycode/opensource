'use client';

import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { useEditorStore } from '@/stores/useEditorStore';
import { useCollectionsStore } from '@/stores/useCollectionsStore';

/**
 * Custom hook for managing editor URL state
 * Handles routing for pages, collections, and components with semantic routes
 */

export type EditorRouteType = 'page' | 'layers' | 'collection' | 'collections-base' | 'component' | null;
export type PageSettingsTab = 'general' | 'seo' | 'custom-code';
export type EditorTab = 'layers' | 'pages' | 'cms';

interface EditorUrlState {
  type: EditorRouteType;
  resourceId: string | null;
  itemId?: string | null; // r_id or 'new' for collection items
  isEditing?: boolean; // For page edit mode (replaces page-edit type)
  tab: PageSettingsTab | null;
  page: number | null; // For collection pagination
  pageSize?: number | null; // For collection items per page
  search?: string | null; // For collection search
  sidebarTab: EditorTab; // Inferred from route type
  view?: 'desktop' | 'tablet' | 'mobile' | null; // Viewport mode
  rightTab?: 'design' | 'settings' | null; // Right sidebar tab
  layerId?: string | null; // Selected layer ID
}

export function useEditorUrl() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Parse current URL to determine state
  const urlState = useMemo((): EditorUrlState => {
    // Match new patterns:
    // - /ycode/layers/[id] → layer editing
    // - /ycode/pages/[id] → page view (with optional ?edit query param for settings)
    // - /ycode/collections → base collections view (no ID)
    // - /ycode/collections/[id] → specific collection view (with optional ?new or ?edit=itemId query params)
    // - /ycode/components/[id] → component editing
    
    const layersMatch = pathname?.match(/^\/ycode\/layers\/([^/]+)$/);
    const pageMatch = pathname?.match(/^\/ycode\/pages\/([^/]+)$/);
    const collectionsBaseMatch = pathname?.match(/^\/ycode\/collections$/);
    const collectionMatch = pathname?.match(/^\/ycode\/collections\/([^/]+)$/);
    const componentMatch = pathname?.match(/^\/ycode\/components\/([^/]+)$/);

    if (layersMatch) {
      const viewParam = searchParams?.get('view');
      const rightTabParam = searchParams?.get('tab');
      const layerParam = searchParams?.get('layer');
      
      return {
        type: 'layers',
        resourceId: layersMatch[1],
        tab: null,
        page: null,
        sidebarTab: 'layers', // Inferred: layers route shows layers sidebar
        view: viewParam as 'desktop' | 'tablet' | 'mobile' | null,
        rightTab: rightTabParam as 'design' | 'settings' | null,
        layerId: layerParam,
      };
    }

    if (pageMatch) {
      const editParam = searchParams?.has('edit');
      const viewParam = searchParams?.get('view');
      const rightTabParam = searchParams?.get('tab');
      const layerParam = searchParams?.get('layer');
      
      return {
        type: 'page',
        resourceId: pageMatch[1],
        isEditing: editParam,
        tab: null,
        page: null,
        sidebarTab: 'pages', // Inferred: pages route shows pages sidebar
        view: viewParam as 'desktop' | 'tablet' | 'mobile' | null,
        rightTab: rightTabParam as 'design' | 'settings' | null,
        layerId: layerParam,
      };
    }

    if (collectionsBaseMatch) {
      return {
        type: 'collections-base',
        resourceId: null,
        tab: null,
        page: null,
        sidebarTab: 'cms', // Inferred: collections show CMS sidebar
      };
    }

    if (collectionMatch) {
      const pageParam = searchParams?.get('page');
      const limitParam = searchParams?.get('limit');
      const searchParam = searchParams?.get('search');
      const newParam = searchParams?.has('new');
      const editParam = searchParams?.get('edit');
      
      return {
        type: 'collection',
        resourceId: collectionMatch[1],
        itemId: newParam ? 'new' : (editParam || null),
        tab: null,
        page: pageParam ? parseInt(pageParam, 10) : null,
        pageSize: limitParam ? parseInt(limitParam, 10) : null,
        search: searchParam || null,
        sidebarTab: 'cms', // Inferred: collections show CMS sidebar
      };
    }

    if (componentMatch) {
      const rightTabParam = searchParams?.get('tab');
      const layerParam = searchParams?.get('layer');
      
      return {
        type: 'component',
        resourceId: componentMatch[1],
        tab: null,
        page: null,
        sidebarTab: 'layers', // Inferred: components show layers sidebar
        rightTab: rightTabParam as 'design' | 'settings' | null,
        layerId: layerParam,
      };
    }

    // For /ycode base route
    return {
      type: null,
      resourceId: null,
      tab: null,
      page: null,
      sidebarTab: 'layers', // Default
    };
  }, [pathname, searchParams]);

  // Navigation helpers
  const navigateToLayers = useCallback(
    (pageId: string, view?: string, rightTab?: string, layerId?: string) => {
      const params = new URLSearchParams();
      if (view) params.set('view', view);
      if (rightTab) params.set('tab', rightTab);
      if (layerId) params.set('layer', layerId);
      const query = params.toString();
      router.push(`/ycode/layers/${pageId}${query ? `?${query}` : ''}`);
    },
    [router]
  );

  const navigateToPage = useCallback(
    (pageId: string, view?: string, rightTab?: string, layerId?: string) => {
      const params = new URLSearchParams();
      if (view) params.set('view', view);
      if (rightTab) params.set('tab', rightTab);
      if (layerId) params.set('layer', layerId);
      const query = params.toString();
      router.push(`/ycode/pages/${pageId}${query ? `?${query}` : ''}`);
    },
    [router]
  );

  const navigateToPageEdit = useCallback(
    (pageId: string, tab?: PageSettingsTab) => {
      // Tab parameter is ignored - tabs are handled client-side
      router.push(`/ycode/pages/${pageId}?edit`);
    },
    [router]
  );

  const navigateToPageLayers = useCallback(
    (pageId: string) => {
      // Alias for navigateToLayers for backwards compatibility
      navigateToLayers(pageId);
    },
    [navigateToLayers]
  );

  const navigateToCollection = useCallback(
    (collectionId: string, page?: number, search?: string, pageSize?: number) => {
      const params = new URLSearchParams();
      if (page && page > 1) {
        params.set('page', page.toString());
      }
      if (search) {
        params.set('search', search);
      }
      // Always include limit if provided (even if it's the default 25)
      if (pageSize !== undefined) {
        params.set('limit', pageSize.toString());
      }
      const query = params.toString();
      router.push(`/ycode/collections/${collectionId}${query ? `?${query}` : ''}`);
    },
    [router]
  );

  const navigateToCollections = useCallback(() => {
    router.push('/ycode/collections');
  }, [router]);

  const navigateToCollectionItem = useCallback(
    (collectionId: string, itemRId: string) => {
      router.push(`/ycode/collections/${collectionId}?edit=${itemRId}`);
    },
    [router]
  );

  const navigateToNewCollectionItem = useCallback(
    (collectionId: string) => {
      router.push(`/ycode/collections/${collectionId}?new`);
    },
    [router]
  );

  const navigateToComponent = useCallback(
    (componentId: string, rightTab?: string, layerId?: string) => {
      const params = new URLSearchParams();
      if (rightTab) params.set('tab', rightTab);
      if (layerId) params.set('layer', layerId);
      const query = params.toString();
      router.push(`/ycode/components/${componentId}${query ? `?${query}` : ''}`);
    },
    [router]
  );

  const navigateToEditor = useCallback(() => {
    router.push('/ycode');
  }, [router]);

  const updateQueryParams = useCallback(
    (params: { view?: string; tab?: string; layer?: string }) => {
      const searchParams = new URLSearchParams(window.location.search);
      
      if (params.view !== undefined) {
        if (params.view) searchParams.set('view', params.view);
        else searchParams.delete('view');
      }
      if (params.tab !== undefined) {
        if (params.tab) searchParams.set('tab', params.tab);
        else searchParams.delete('tab');
      }
      if (params.layer !== undefined) {
        if (params.layer) searchParams.set('layer', params.layer);
        else searchParams.delete('layer');
      }
      
      const query = searchParams.toString();
      router.replace(`${pathname}${query ? `?${query}` : ''}`);
    },
    [router, pathname]
  );

  return {
    // Current state
    urlState, // Export full state object
    routeType: urlState.type,
    resourceId: urlState.resourceId,
    tab: urlState.tab,
    page: urlState.page,
    sidebarTab: urlState.sidebarTab,
    
    // Navigation functions
    navigateToLayers,
    navigateToPage,
    navigateToPageEdit,
    navigateToPageLayers, // Alias for navigateToLayers
    navigateToCollection,
    navigateToCollections,
    navigateToCollectionItem,
    navigateToNewCollectionItem,
    navigateToComponent,
    navigateToEditor,
    updateQueryParams,
  };
}

/**
 * Combined actions hook - convenience methods that update both state AND URL
 * Use these for normal user interactions where you want both to happen
 * 
 * For edge cases (initial load, back/forward), use the individual store methods directly
 */
export function useEditorActions() {
  const { navigateToLayers, navigateToPage, navigateToPageEdit, navigateToPageLayers, navigateToCollection, navigateToCollections, navigateToCollectionItem, navigateToNewCollectionItem, navigateToComponent, updateQueryParams, urlState } = useEditorUrl();
  const { setCurrentPageId } = useEditorStore();
  const { setSelectedCollectionId } = useCollectionsStore();
  const { setEditingComponentId } = useEditorStore();

  // Combined action: Open page (updates state + URL)
  const openPage = useCallback(
    (pageId: string, view?: string, rightTab?: string, layerId?: string) => {
      setCurrentPageId(pageId);
      navigateToPage(pageId, view, rightTab, layerId);
    },
    [setCurrentPageId, navigateToPage]
  );

  // Combined action: Open page in edit mode (updates state + URL)
  const openPageEdit = useCallback(
    (pageId: string, view?: string, rightTab?: string, layerId?: string, tab?: PageSettingsTab) => {
      setCurrentPageId(pageId);
      navigateToPageEdit(pageId, tab);
    },
    [setCurrentPageId, navigateToPageEdit]
  );

  // Combined action: Open page in layers mode (updates state + URL)
  const openPageLayers = useCallback(
    (pageId: string, view?: string, rightTab?: string, layerId?: string) => {
      setCurrentPageId(pageId);
      navigateToPageLayers(pageId);
    },
    [setCurrentPageId, navigateToPageLayers]
  );

  // Combined action: Open a collection (updates state + URL)
  const openCollection = useCallback(
    (collectionId: string, page?: number, search?: string, pageSize?: number) => {
      setSelectedCollectionId(collectionId);
      navigateToCollection(collectionId, page, search, pageSize);
    },
    [setSelectedCollectionId, navigateToCollection]
  );

  // Combined action: Open collection item for editing (URL only, state managed by CMS)
  const openCollectionItem = useCallback(
    (collectionId: string, itemRId: string) => {
      navigateToCollectionItem(collectionId, itemRId);
    },
    [navigateToCollectionItem]
  );

  // Combined action: Open new collection item creation (URL only, state managed by CMS)
  const openNewCollectionItem = useCallback(
    (collectionId: string) => {
      navigateToNewCollectionItem(collectionId);
    },
    [navigateToNewCollectionItem]
  );

  // Combined action: Open component edit mode (updates state + URL)
  const openComponent = useCallback(
    (componentId: string, returnPageId: string | null, rightTab?: string, layerId?: string) => {
      setEditingComponentId(componentId, returnPageId);
      navigateToComponent(componentId, rightTab, layerId);
    },
    [setEditingComponentId, navigateToComponent]
  );

  return {
    // ✅ URL state
    urlState,
    updateQueryParams,

    // ✅ Convenience methods (state + URL)
    openPage,
    openPageEdit,
    openPageLayers,
    openCollection,
    openCollectionItem,
    openNewCollectionItem,
    openComponent,

    // ✅ Individual methods for edge cases
    setCurrentPageId,        // State only
    setSelectedCollectionId, // State only
    setEditingComponentId,   // State only
    navigateToLayers,        // URL only
    navigateToPage,          // URL only
    navigateToPageEdit,      // URL only
    navigateToPageLayers,    // URL only
    navigateToCollection,    // URL only
    navigateToCollections,   // URL only
    navigateToCollectionItem,    // URL only
    navigateToNewCollectionItem, // URL only
    navigateToComponent,     // URL only
  };
}
