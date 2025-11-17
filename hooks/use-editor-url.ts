'use client';

import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { useEditorStore } from '@/stores/useEditorStore';
import { useCollectionsStore } from '@/stores/useCollectionsStore';

/**
 * Custom hook for managing editor URL state
 * Handles routing for pages, collections, and components with semantic routes
 */

export type EditorRouteType = 'page' | 'page-edit' | 'layers' | 'collection' | 'collection-item' | 'collections-base' | 'component' | null;
export type PageSettingsTab = 'general' | 'seo' | 'custom-code';
export type EditorTab = 'layers' | 'pages' | 'cms';

interface EditorUrlState {
  type: EditorRouteType;
  resourceId: string | null;
  itemId?: string | null; // r_id or 'new' for collection items
  tab: PageSettingsTab | null;
  page: number | null; // For collection pagination
  sidebarTab: EditorTab; // Inferred from route type
}

export function useEditorUrl() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Parse current URL to determine state
  const urlState = useMemo((): EditorUrlState => {
    // Match new patterns:
    // - /ycode/layers/[id] → layer editing
    // - /ycode/pages/[id] → page view
    // - /ycode/pages/[id]/edit → page settings (tabs handled client-side)
    // - /ycode/collections → base collections view (no ID)
    // - /ycode/collections/[id] → specific collection view
    // - /ycode/components/[id] → component editing
    
    const layersMatch = pathname?.match(/^\/ycode\/layers\/([^/]+)$/);
    const pageMatch = pathname?.match(/^\/ycode\/pages\/([^/]+)$/);
    const pageEditMatch = pathname?.match(/^\/ycode\/pages\/([^/]+)\/edit$/);
    const collectionsBaseMatch = pathname?.match(/^\/ycode\/collections$/);
    const collectionItemMatch = pathname?.match(/^\/ycode\/collections\/([^/]+)\/item\/([^/]+)$/);
    const collectionMatch = pathname?.match(/^\/ycode\/collections\/([^/]+)$/);
    const componentMatch = pathname?.match(/^\/ycode\/components\/([^/]+)$/);


    if (layersMatch) {
      return {
        type: 'layers',
        resourceId: layersMatch[1],
        tab: null,
        page: null,
        sidebarTab: 'layers', // Inferred: layers route shows layers sidebar
      };
    }

    if (pageMatch) {
      return {
        type: 'page',
        resourceId: pageMatch[1],
        tab: null,
        page: null,
        sidebarTab: 'pages', // Inferred: pages route shows pages sidebar
      };
    }

    if (pageEditMatch) {
      return {
        type: 'page-edit',
        resourceId: pageEditMatch[1],
        tab: null, // Tabs handled client-side, not in URL
        page: null,
        sidebarTab: 'pages', // Inferred: edit mode shows pages sidebar
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

    if (collectionItemMatch) {
      const pageParam = searchParams?.get('page');
      return {
        type: 'collection-item',
        resourceId: collectionItemMatch[1], // collectionId
        itemId: collectionItemMatch[2], // r_id or 'new'
        tab: null,
        page: pageParam ? parseInt(pageParam, 10) : null,
        sidebarTab: 'cms', // Inferred: collection items show CMS sidebar
      };
    }

    if (collectionMatch) {
      const pageParam = searchParams?.get('page');
      return {
        type: 'collection',
        resourceId: collectionMatch[1],
        tab: null,
        page: pageParam ? parseInt(pageParam, 10) : null,
        sidebarTab: 'cms', // Inferred: collections show CMS sidebar
      };
    }

    if (componentMatch) {
      return {
        type: 'component',
        resourceId: componentMatch[1],
        tab: null,
        page: null,
        sidebarTab: 'layers', // Inferred: components show layers sidebar
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
    (pageId: string) => {
      router.push(`/ycode/layers/${pageId}`);
    },
    [router]
  );

  const navigateToPage = useCallback(
    (pageId: string) => {
      router.push(`/ycode/pages/${pageId}`);
    },
    [router]
  );

  const navigateToPageEdit = useCallback(
    (pageId: string, tab?: PageSettingsTab) => {
      // Tab parameter is ignored - tabs are handled client-side
      router.push(`/ycode/pages/${pageId}/edit`);
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
    (collectionId: string, page?: number) => {
      const params = new URLSearchParams();
      if (page && page > 1) {
        params.set('page', page.toString());
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
      router.push(`/ycode/collections/${collectionId}/item/${itemRId}`);
    },
    [router]
  );

  const navigateToNewCollectionItem = useCallback(
    (collectionId: string) => {
      router.push(`/ycode/collections/${collectionId}/item/new`);
    },
    [router]
  );

  const navigateToComponent = useCallback(
    (componentId: string) => {
      router.push(`/ycode/components/${componentId}`);
    },
    [router]
  );

  const navigateToEditor = useCallback(() => {
    router.push('/ycode');
  }, [router]);

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
  };
}

/**
 * Combined actions hook - convenience methods that update both state AND URL
 * Use these for normal user interactions where you want both to happen
 * 
 * For edge cases (initial load, back/forward), use the individual store methods directly
 */
export function useEditorActions() {
  const { navigateToLayers, navigateToPage, navigateToPageEdit, navigateToPageLayers, navigateToCollection, navigateToCollections, navigateToCollectionItem, navigateToNewCollectionItem, navigateToComponent } = useEditorUrl();
  const { setCurrentPageId } = useEditorStore();
  const { setSelectedCollectionId } = useCollectionsStore();
  const { setEditingComponentId } = useEditorStore();

  // Combined action: Open page (updates state + URL)
  const openPage = useCallback(
    (pageId: string) => {
      setCurrentPageId(pageId);
      navigateToPage(pageId);
    },
    [setCurrentPageId, navigateToPage]
  );

  // Combined action: Open page in edit mode (updates state + URL)
  const openPageEdit = useCallback(
    (pageId: string, tab?: PageSettingsTab) => {
      setCurrentPageId(pageId);
      navigateToPageEdit(pageId, tab);
    },
    [setCurrentPageId, navigateToPageEdit]
  );

  // Combined action: Open page in layers mode (updates state + URL)
  const openPageLayers = useCallback(
    (pageId: string) => {
      setCurrentPageId(pageId);
      navigateToPageLayers(pageId);
    },
    [setCurrentPageId, navigateToPageLayers]
  );

  // Combined action: Open a collection (updates state + URL)
  const openCollection = useCallback(
    (collectionId: string, page?: number) => {
      setSelectedCollectionId(collectionId);
      navigateToCollection(collectionId, page);
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
    (componentId: string, returnPageId: string | null) => {
      setEditingComponentId(componentId, returnPageId);
      navigateToComponent(componentId);
    },
    [setEditingComponentId, navigateToComponent]
  );

  return {
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

