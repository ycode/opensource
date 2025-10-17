'use client';

import { create } from 'zustand';
import type { Layer, Page, PageVersion } from '../types';
import { pagesApi, pageVersionsApi } from '../lib/api';

interface PagesState {
  pages: Page[];
  draftsByPageId: Record<string, PageVersion>;
  isLoading: boolean;
  error: string | null;
}

interface PagesActions {
  setPages: (pages: Page[]) => void;
  loadPages: () => Promise<void>;
  loadDraft: (pageId: string) => Promise<void>;
  initDraft: (page: Page, initialLayers?: Layer[]) => void;
  updateLayerClasses: (pageId: string, layerId: string, classes: string) => void;
  saveDraft: (pageId: string) => Promise<void>;
  publishPage: (pageId: string) => Promise<void>;
  setError: (error: string | null) => void;
  addLayer: (pageId: string, parentLayerId: string | null, layerType: Layer['type']) => void;
  deleteLayer: (pageId: string, layerId: string) => void;
  updateLayer: (pageId: string, layerId: string, updates: Partial<Layer>) => void;
}

type PagesStore = PagesState & PagesActions;

function updateLayerInTree(tree: Layer[], layerId: string, updater: (l: Layer) => Layer): Layer[] {
  return tree.map((node) => {
    if (node.id === layerId) {
      return updater(node);
    }
    if (node.children && node.children.length > 0) {
      return { ...node, children: updateLayerInTree(node.children, layerId, updater) };
    }
    return node;
  });
}

export const usePagesStore = create<PagesStore>((set, get) => ({
  pages: [],
  draftsByPageId: {},
  isLoading: false,
  error: null,

  setPages: (pages) => set({ pages }),

  loadPages: async () => {
    console.log('[usePagesStore.loadPages] Starting...');
    set({ isLoading: true, error: null });
    try {
      console.log('[usePagesStore.loadPages] Fetching pages...');
      const response = await pagesApi.getAll();
      if (response.error) {
        console.error('[usePagesStore.loadPages] Error loading pages:', response.error);
        set({ error: response.error, isLoading: false });
        return;
      }
      const pages = response.data || [];
      console.log('[usePagesStore.loadPages] Fetched pages:', pages.length);
      
      // Auto-create a default "Home" page if none exist
      if (pages.length === 0) {
        console.log('[usePagesStore.loadPages] No pages found, creating default Home page...');
        try {
          const createResponse = await pagesApi.create({
            title: 'Home',
            slug: 'home',
            status: 'draft',
            published_version_id: null,
          });
          
          console.log('[usePagesStore.loadPages] Create response:', createResponse);
          
          if (createResponse.error) {
            console.error('[usePagesStore.loadPages] Error creating default page:', createResponse.error);
            set({ error: createResponse.error, isLoading: false });
            return;
          }
          
          if (createResponse.data) {
            console.log('[usePagesStore.loadPages] Default Home page created successfully:', createResponse.data);
            set({ pages: [createResponse.data], isLoading: false });
            return;
          }
          
          console.error('[usePagesStore.loadPages] Create succeeded but no data returned');
        } catch (createError) {
          console.error('[usePagesStore.loadPages] Exception creating default page:', createError);
          set({ error: 'Failed to create default page', isLoading: false });
          return;
        }
      }
      
      console.log('[usePagesStore.loadPages] Setting pages:', pages.length);
      set({ pages, isLoading: false });
    } catch (error) {
      console.error('[usePagesStore.loadPages] Exception loading pages:', error);
      set({ error: 'Failed to load pages', isLoading: false });
    }
  },

  loadDraft: async (pageId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await pageVersionsApi.getDraft(pageId);
      if (response.error) {
        set({ error: response.error, isLoading: false });
        return;
      }
      if (response.data) {
        set((state) => ({
          draftsByPageId: { ...state.draftsByPageId, [pageId]: response.data! },
          isLoading: false,
        }));
      }
    } catch (error) {
      set({ error: 'Failed to load draft', isLoading: false });
    }
  },

  initDraft: (page, initialLayers = []) => {
    const draft: PageVersion = {
      id: `draft-${page.id}`,
      page_id: page.id,
      layers: initialLayers,
      is_published: false,
      created_at: new Date().toISOString(),
    };
    set((state) => ({ draftsByPageId: { ...state.draftsByPageId, [page.id]: draft } }));
  },

  updateLayerClasses: (pageId, layerId, classes) => {
    const { draftsByPageId } = get();
    const draft = draftsByPageId[pageId];
    if (! draft) return;
    const newLayers = updateLayerInTree(draft.layers, layerId, (l) => ({ ...l, classes }));
    set({ draftsByPageId: { ...draftsByPageId, [pageId]: { ...draft, layers: newLayers } } });
  },

  saveDraft: async (pageId) => {
    const { draftsByPageId } = get();
    const draft = draftsByPageId[pageId];
    if (! draft) return;

    set({ isLoading: true, error: null });
    try {
      const response = await pageVersionsApi.updateDraft(pageId, draft.layers);
      if (response.error) {
        set({ error: response.error, isLoading: false });
        return;
      }
      if (response.data) {
        set((state) => ({
          draftsByPageId: { ...state.draftsByPageId, [pageId]: response.data! },
          isLoading: false,
        }));
      }
    } catch (error) {
      set({ error: 'Failed to save draft', isLoading: false });
    }
  },

  publishPage: async (pageId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await pageVersionsApi.publish(pageId);
      if (response.error) {
        set({ error: response.error, isLoading: false });
        return;
      }
      // Reload pages to update published status
      await get().loadPages();
    } catch (error) {
      set({ error: 'Failed to publish page', isLoading: false });
    }
  },

  setError: (error) => set({ error }),

  addLayer: (pageId, parentLayerId, layerType) => {
    const { draftsByPageId, pages } = get();
    let draft = draftsByPageId[pageId];
    
    // Initialize draft if it doesn't exist
    if (!draft) {
      const page = pages.find(p => p.id === pageId);
      if (!page) return;
      
      draft = {
        id: `draft-${pageId}`,
        page_id: pageId,
        layers: [],
        is_published: false,
        created_at: new Date().toISOString(),
      };
    }

    const newLayer: Layer = {
      id: `layer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: layerType,
      classes: getDefaultClasses(layerType),
      content: getDefaultContent(layerType),
      children: layerType === 'container' ? [] : undefined,
    };

    let newLayers: Layer[];
    
    if (! parentLayerId) {
      // Add to root
      newLayers = [...draft.layers, newLayer];
    } else {
      // Add as child to parent
      newLayers = updateLayerInTree(draft.layers, parentLayerId, (parent) => ({
        ...parent,
        children: [...(parent.children || []), newLayer],
      }));
    }

    set({ 
      draftsByPageId: { 
        ...draftsByPageId, 
        [pageId]: { ...draft, layers: newLayers }
      } 
    });
  },

  deleteLayer: (pageId, layerId) => {
    const { draftsByPageId } = get();
    const draft = draftsByPageId[pageId];
    if (! draft) return;

    const removeFromTree = (tree: Layer[]): Layer[] => {
      return tree
        .filter(node => node.id !== layerId)
        .map(node => ({
          ...node,
          children: node.children ? removeFromTree(node.children) : undefined,
        }));
    };

    const newLayers = removeFromTree(draft.layers);
    set({ 
      draftsByPageId: { 
        ...draftsByPageId, 
        [pageId]: { ...draft, layers: newLayers } 
      } 
    });
  },

  updateLayer: (pageId, layerId, updates) => {
    const { draftsByPageId } = get();
    const draft = draftsByPageId[pageId];
    if (! draft) return;

    const newLayers = updateLayerInTree(draft.layers, layerId, (layer) => ({
      ...layer,
      ...updates,
    }));

    set({ 
      draftsByPageId: { 
        ...draftsByPageId, 
        [pageId]: { ...draft, layers: newLayers } 
      } 
    });
  },
}));

// Helper functions for default layer values
function getDefaultClasses(type: Layer['type']): string {
  switch (type) {
    case 'container':
      return 'flex flex-col gap-4 p-8';
    case 'text':
      return 'text-base text-gray-700';
    case 'heading':
      return 'text-3xl font-bold text-gray-900';
    case 'image':
      return 'w-full h-auto';
    default:
      return '';
  }
}

function getDefaultContent(type: Layer['type']): string | undefined {
  switch (type) {
    case 'text':
      return 'Edit this text...';
    case 'heading':
      return 'Heading';
    default:
      return undefined;
  }
}



