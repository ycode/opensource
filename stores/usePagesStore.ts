'use client';

import { create } from 'zustand';
import type { Layer, Page, PageLayers, PageFolder } from '../types';
import { pagesApi, pageLayersApi, foldersApi } from '../lib/api';
import { getTemplate, getBlockName } from '../lib/templates/blocks';
import { cloneDeep } from 'lodash';
import { canHaveChildren } from '../lib/layer-utils';
import { getDescendantFolderIds } from '../lib/page-utils';
import { extractPublishedCSS } from '../lib/extract-published-css';
import { updateLayersWithStyle, detachStyleFromLayers } from '../lib/layer-style-utils';

interface PagesState {
  pages: Page[];
  folders: PageFolder[];
  draftsByPageId: Record<string, PageLayers>;
  isLoading: boolean;
  error: string | null;
}

interface PagesActions {
  setPages: (pages: Page[]) => void;
  setFolders: (folders: PageFolder[]) => void;
  loadPages: () => Promise<void>;
  loadFolders: () => Promise<void>;
  loadDraft: (pageId: string) => Promise<void>;
  createPage: (pageData: Omit<Page, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'publish_key'>) => Promise<{ success: boolean; data?: Page; error?: string; tempId?: string }>;
  updatePage: (pageId: string, updates: Partial<Page>) => Promise<{ success: boolean; error?: string }>;
  deletePage: (pageId: string, currentPageId?: string | null) => Promise<{ success: boolean; error?: string; currentPageDeleted?: boolean; nextPageId?: string | null }>;
  createFolder: (folderData: Omit<PageFolder, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'publish_key'>) => Promise<{ success: boolean; data?: PageFolder; error?: string; tempId?: string }>;
  deleteFolder: (folderId: string, currentPageId?: string | null) => Promise<{ success: boolean; error?: string; currentPageAffected?: boolean; nextPageId?: string | null; deletedPageIds?: string[] }>;
  initDraft: (page: Page, initialLayers?: Layer[]) => void;
  updateLayerClasses: (pageId: string, layerId: string, classes: string) => void;
  saveDraft: (pageId: string) => Promise<void>;
  setError: (error: string | null) => void;
  addLayer: (pageId: string, parentLayerId: string | null, layerType: Layer['type']) => void;
  addLayerFromTemplate: (pageId: string, parentLayerId: string | null, templateId: string) => { newLayerId: string; parentToExpand: string | null } | null;
  deleteLayer: (pageId: string, layerId: string) => void;
  deleteLayers: (pageId: string, layerIds: string[]) => void; // New batch delete
  updateLayer: (pageId: string, layerId: string, updates: Partial<Layer>) => void;
  moveLayer: (pageId: string, layerId: string, targetParentId: string | null, targetIndex: number) => boolean;
  setDraftLayers: (pageId: string, layers: Layer[]) => void;
  copyLayer: (pageId: string, layerId: string) => Layer | null;
  copyLayers: (pageId: string, layerIds: string[]) => Layer[]; // New batch copy
  duplicateLayer: (pageId: string, layerId: string) => void;
  duplicateLayers: (pageId: string, layerIds: string[]) => void; // New batch duplicate
  pasteAfter: (pageId: string, targetLayerId: string, layerToPaste: Layer) => void;
  pasteInside: (pageId: string, targetLayerId: string, layerToPaste: Layer) => void;

  // Layer Style actions
  updateStyleOnLayers: (styleId: string, newClasses: string, newDesign?: Layer['design']) => void;
  detachStyleFromAllLayers: (styleId: string) => void;
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

/**
 * Reorder pages and folders together within each parent/depth group after deletion
 * Ensures no gaps in the order sequence
 * Mimics backend reorderSiblings logic
 */
function reorderPagesAndFoldersTogether(
  pages: Page[],
  folders: PageFolder[]
): { pages: Page[]; folders: PageFolder[] } {
  // Group items by parent_id AND depth (matching backend logic)
  const groupsByParentAndDepth = new Map<string, { pages: Page[]; folders: PageFolder[] }>();

  // Helper to create group key
  const getGroupKey = (parentId: string | null, depth: number) => `${parentId || 'root'}:${depth}`;

  // Group pages
  for (const page of pages) {
    const key = getGroupKey(page.page_folder_id, page.depth);
    if (!groupsByParentAndDepth.has(key)) {
      groupsByParentAndDepth.set(key, { pages: [], folders: [] });
    }
    groupsByParentAndDepth.get(key)!.pages.push(page);
  }

  // Group folders
  for (const folder of folders) {
    const key = getGroupKey(folder.page_folder_id, folder.depth);
    if (!groupsByParentAndDepth.has(key)) {
      groupsByParentAndDepth.set(key, { pages: [], folders: [] });
    }
    groupsByParentAndDepth.get(key)!.folders.push(folder);
  }

  const reorderedPages: Page[] = [];
  const reorderedFolders: PageFolder[] = [];

  // Reorder each group (pages and folders together)
  for (const [groupKey, group] of groupsByParentAndDepth) {
    // Combine pages and folders with type markers
    const combined = [
      ...group.pages.map(p => ({ item: p, type: 'page' as const, order: p.order || 0 })),
      ...group.folders.map(f => ({ item: f, type: 'folder' as const, order: f.order || 0 })),
    ];

    // Sort by current order
    combined.sort((a, b) => a.order - b.order);

    // Reassign sequential order values to all items (0, 1, 2, ...)
    combined.forEach((entry, index) => {
      if (entry.type === 'page') {
        reorderedPages.push({ ...entry.item, order: index } as Page);
      } else {
        reorderedFolders.push({ ...entry.item, order: index } as PageFolder);
      }
    });
  }

  return { pages: reorderedPages, folders: reorderedFolders };
}

function findLayerInTree(tree: Layer[], layerId: string): Layer | null {
  for (const node of tree) {
    if (node.id === layerId) return node;
    if (node.children) {
      const found = findLayerInTree(node.children, layerId);
      if (found) return found;
    }
  }
  return null;
}

export const usePagesStore = create<PagesStore>((set, get) => ({
  pages: [],
  folders: [],
  draftsByPageId: {},
  isLoading: false,
  error: null,

  setPages: (pages) => set({ pages }),
  setFolders: (folders) => set({ folders }),

  loadPages: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await pagesApi.getAll();
      if (response.error) {
        console.error('[usePagesStore.loadPages] Error loading pages:', response.error);
        set({ error: response.error, isLoading: false });
        return;
      }
      const pages = response.data || [];

      // Note: Default homepage with draft layers is created during migrations (20250101000002_create_page_layers_table.ts)

      set({ pages, isLoading: false });
    } catch (error) {
      console.error('[usePagesStore.loadPages] Exception loading pages:', error);
      set({ error: 'Failed to load pages', isLoading: false });
    }
  },

  loadFolders: async () => {
    console.log('[usePagesStore.loadFolders] Starting...');
    set({ isLoading: true, error: null });
    try {
      console.log('[usePagesStore.loadFolders] Fetching folders...');
      const response = await foldersApi.getAll();
      if (response.error) {
        console.error('[usePagesStore.loadFolders] Error loading folders:', response.error);
        set({ error: response.error, isLoading: false });
        return;
      }
      const folders = response.data || [];
      console.log('[usePagesStore.loadFolders] Fetched folders:', folders.length);
      set({ folders, isLoading: false });
    } catch (error) {
      console.error('[usePagesStore.loadFolders] Exception loading folders:', error);
      set({ error: 'Failed to load folders', isLoading: false });
    }
  },

  loadDraft: async (pageId) => {
    // Check if we already have a draft with unsaved changes
    const existingDraft = get().draftsByPageId[pageId];

    set({ isLoading: true, error: null });
    try {
      const response = await pageLayersApi.getDraft(pageId);
      if (response.error) {
        set({ error: response.error, isLoading: false });
        return;
      }
      if (response.data) {
        // If we had local changes, we need to decide what to do
        // For now, we'll prefer server data when explicitly loading (e.g., page switch)
        // but log a warning if we're overwriting local changes
        if (existingDraft &&
            JSON.stringify(existingDraft.layers) !== JSON.stringify(response.data.layers)) {
          console.warn('⚠️ loadDraft: Overwriting local changes with server data');
        }

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
    const draft: PageLayers = {
      id: `draft-${page.id}`,
      page_id: page.id,
      layers: initialLayers,
      is_published: false,
      publish_key: page.publish_key,
      created_at: new Date().toISOString(),
      deleted_at: null,
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

    // Capture the layers we're about to save
    const layersBeingSaved = draft.layers;

    set({ isLoading: true, error: null });
    try {
      // Extract CSS from Tailwind JIT for published pages
      const generatedCSS = await extractPublishedCSS(draft.layers);

      const response = await pageLayersApi.updateDraft(
        pageId,
        draft.layers,
        generatedCSS
      );

      if (response.error) {
        set({ error: response.error, isLoading: false });
        return;
      }
      if (response.data) {
        // IMPORTANT: Only update state if layers haven't changed since we started saving
        // This prevents race conditions where new changes are overwritten by stale server data
        const currentDraft = get().draftsByPageId[pageId];
        const currentLayersJSON = JSON.stringify(currentDraft?.layers || []);
        const savedLayersJSON = JSON.stringify(layersBeingSaved);

        if (currentLayersJSON === savedLayersJSON) {
          // Safe to update - no changes made during save
          set((state) => ({
            draftsByPageId: { ...state.draftsByPageId, [pageId]: response.data! },
            isLoading: false,
          }));
        } else {
          // Layers changed during save - keep local changes, but update metadata
          console.warn('⚠️ Layers changed during save - keeping local changes');
          set((state) => ({
            draftsByPageId: {
              ...state.draftsByPageId,
              [pageId]: {
                ...response.data!,
                layers: currentDraft!.layers, // Keep current layers, not server's
              }
            },
            isLoading: false,
          }));
        }
      }
    } catch (error) {
      console.error('Failed to save draft:', error);
      set({ error: 'Failed to save draft', isLoading: false });
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
        publish_key: page.publish_key,
        created_at: new Date().toISOString(),
        deleted_at: null,
      };
    }

    const newLayer: Layer = {
      id: `layer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: layerType,
      classes: '',
      content: getDefaultContent(layerType),
      children: layerType === 'container' ? [] : undefined,
    };

    // Set classes after ID is assigned
    newLayer.classes = getDefaultClasses(layerType, newLayer.id);

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

  addLayerFromTemplate: (pageId, parentLayerId, templateId) => {
    const { draftsByPageId, pages } = get();
    let draft = draftsByPageId[pageId];

    // Initialize draft if it doesn't exist
    if (!draft) {
      const page = pages.find(p => p.id === pageId);
      if (!page) return null;

      draft = {
        id: `draft-${pageId}`,
        page_id: pageId,
        layers: [],
        is_published: false,
        publish_key: page.publish_key,
        created_at: new Date().toISOString(),
        deleted_at: null,
      };
    }

    // Get the template and block info
    const template = getTemplate(templateId);
    if (!template) {
      console.error(`Template ${templateId} not found`);
      return null;
    }

    const displayName = getBlockName(templateId);

    // Set the display name for the root layer
    const normalizeLayer = (layer: Layer, isRoot: boolean = true): Layer => {
      const normalized = { ...layer };

      if (isRoot && displayName) {
        normalized.customName = displayName;
      }

      // Recursively normalize children
      if (normalized.children) {
        normalized.children = normalized.children.map(child => normalizeLayer(child, false));
      }

      // Ensure classes is a string
      if (Array.isArray(normalized.classes)) {
        normalized.classes = normalized.classes.join(' ');
      }

      return normalized;
    };

    const newLayer = normalizeLayer(template, true);
    const newLayerId = newLayer.id;

    let newLayers: Layer[];
    let parentToExpand: string | null = null;

    if (! parentLayerId) {
      // Add to root
      newLayers = [...draft.layers, newLayer];
    } else {
      // Find the parent layer and its parent
      const findLayerWithParent = (tree: Layer[], id: string, parent: Layer | null = null): { layer: Layer; parent: Layer | null } | null => {
        for (const node of tree) {
          if (node.id === id) return { layer: node, parent };
          if (node.children) {
            const found = findLayerWithParent(node.children, id, node);
            if (found) return found;
          }
        }
        return null;
      };

      const result = findLayerWithParent(draft.layers, parentLayerId);

      // Check if parent can have children
      if (result && !canHaveChildren(result.layer)) {

        // If parent exists (not root level), insert after the selected layer
        if (result.parent) {
          newLayers = updateLayerInTree(draft.layers, result.parent.id, (grandparent) => {
            const children = grandparent.children || [];
            const selectedIndex = children.findIndex(c => c.id === parentLayerId);
            const newChildren = [...children];
            newChildren.splice(selectedIndex + 1, 0, newLayer);
            return { ...grandparent, children: newChildren };
          });
          // Expand the parent of the selected layer (grandparent)
          parentToExpand = result.parent.id;
        } else {
          // Selected layer is at root level, insert after it
          const selectedIndex = draft.layers.findIndex(l => l.id === parentLayerId);
          newLayers = [...draft.layers];
          newLayers.splice(selectedIndex + 1, 0, newLayer);
        }
      } else {
        // Add as child to parent
        newLayers = updateLayerInTree(draft.layers, parentLayerId, (parent) => ({
          ...parent,
          children: [...(parent.children || []), newLayer],
        }));
        // Expand the parent that we're adding into
        parentToExpand = parentLayerId;
      }
    }

    set({
      draftsByPageId: {
        ...draftsByPageId,
        [pageId]: { ...draft, layers: newLayers }
      }
    });

    return { newLayerId, parentToExpand };
  },

  deleteLayer: (pageId, layerId) => {
    const { draftsByPageId } = get();
    const draft = draftsByPageId[pageId];
    if (! draft) return;


    // Find layer by ID
    const findLayer = (tree: Layer[]): Layer | null => {
      for (const node of tree) {
        if (node.id === layerId) return node;

        if (node.children) {
          const found = findLayer(node.children);
          if (found) return found;
        }
      }
      return null;
    };

    const layerToDelete = findLayer(draft.layers);

    // Prevent deleting locked layers
    if (layerToDelete?.locked) {
      console.warn('Cannot delete locked layer');
      return;
    }


    // Helper: Remove from tree (supports both children and items)
    const removeFromTree = (tree: Layer[]): Layer[] => {
      return tree
        .filter(node => node.id !== layerId)
        .map(node => {
          if (!node.children) return node;
          return { ...node, children: removeFromTree(node.children) };
        });
    };

    const newLayers = removeFromTree(draft.layers);

    // Use functional update to ensure we're working with the latest state
    set((state) => ({
      draftsByPageId: {
        ...state.draftsByPageId,
        [pageId]: {
          ...state.draftsByPageId[pageId],
          layers: newLayers
        }
      }
    }));
  },

  deleteLayers: (pageId, layerIds) => {
    const { draftsByPageId } = get();
    const draft = draftsByPageId[pageId];
    if (!draft || layerIds.length === 0) return;


    // Filter out body and locked layers
    const validIds = new Set<string>();
    const findLayer = (tree: Layer[], id: string): Layer | null => {
      for (const node of tree) {
        if (node.id === id) return node;
        if (node.children) {
          const found = findLayer(node.children, id);
          if (found) return found;
        }
      }
      return null;
    };

    // Check each layer ID
    for (const layerId of layerIds) {
      if (layerId === 'body') continue; // Skip body
      const layer = findLayer(draft.layers, layerId);
      if (layer && !layer.locked) {
        validIds.add(layerId);
      }
    }

    if (validIds.size === 0) {
      console.warn('No valid layers to delete');
      return;
    }

    // Helper: Check if a node is a descendant of any in the delete set
    const isDescendantOfDeleted = (tree: Layer[], nodeId: string, deletedIds: Set<string>): boolean => {
      for (const node of tree) {
        if (deletedIds.has(node.id)) {
          // Check if nodeId is in this node's descendants
          const hasDescendant = (children: Layer[]): boolean => {
            for (const child of children) {
              if (child.id === nodeId) return true;
              if (child.children && hasDescendant(child.children)) return true;
            }
            return false;
          };
          if (node.children && hasDescendant(node.children)) return true;
        }
        if (node.children && isDescendantOfDeleted(node.children, nodeId, deletedIds)) {
          return true;
        }
      }
      return false;
    };

    // Remove parent-child duplicates (if parent is selected, don't separately delete children)
    const finalIds = new Set<string>();
    for (const id of validIds) {
      if (!isDescendantOfDeleted(draft.layers, id, validIds)) {
        finalIds.add(id);
      }
    }

    // Helper: Remove multiple IDs from tree
    const removeMultipleFromTree = (tree: Layer[]): Layer[] => {
      return tree
        .filter(node => !finalIds.has(node.id))
        .map(node => {
          if (!node.children) return node;
          return { ...node, children: removeMultipleFromTree(node.children) };
        });
    };

    const newLayers = removeMultipleFromTree(draft.layers);

    set((state) => ({
      draftsByPageId: {
        ...state.draftsByPageId,
        [pageId]: {
          ...state.draftsByPageId[pageId],
          layers: newLayers
        }
      }
    }));
  },

  updateLayer: (pageId, layerId, updates) => {

    const { draftsByPageId } = get();
    const draft = draftsByPageId[pageId];
    if (! draft) {
      console.warn('⚠️ [usePagesStore] No draft found for page:', pageId);
      return;
    }

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

  moveLayer: (pageId, layerId, targetParentId, targetIndex) => {
    const { draftsByPageId } = get();
    const draft = draftsByPageId[pageId];
    if (! draft) return false;

    // Helper: Find layer by ID in tree
    const findLayer = (layers: Layer[], id: string): Layer | null => {
      for (const layer of layers) {
        if (layer.id === id) return layer;
        if (layer.children) {
          const found = findLayer(layer.children, id);
          if (found) return found;
        }
      }
      return null;
    };

    // Helper: Check if targetId is a descendant of layerId (prevent circular nesting)
    const isDescendant = (parentId: string, childId: string): boolean => {
      const parent = findLayer(draft.layers, parentId);
      if (!parent || !parent.children) return false;

      for (const child of parent.children) {
        if (child.id === childId) return true;
        if (child.children && isDescendant(child.id, childId)) return true;
      }
      return false;
    };

    // Validation: Cannot move into self or descendants (circular reference)
    if (targetParentId === layerId || isDescendant(layerId, targetParentId || '')) {
      console.warn('Cannot create circular reference');
      return false;
    }

    // Validation: Target parent must be a container (if not null)
    if (targetParentId) {
      const targetParent = findLayer(draft.layers, targetParentId);
      if (!targetParent || targetParent.type !== 'container') {
        console.warn('Can only drop into container layers');
        return false;
      }
    }

    // Get the layer being moved
    const layerToMove = findLayer(draft.layers, layerId);
    if (!layerToMove) return false;

    // Helper: Remove layer from tree
    const removeLayer = (layers: Layer[]): Layer[] => {
      return layers
        .filter(node => node.id !== layerId)
        .map(node => ({
          ...node,
          children: node.children ? removeLayer(node.children) : undefined,
        }));
    };

    // Helper: Insert layer at specific position
    const insertLayer = (layers: Layer[], parentId: string | null, index: number, layer: Layer): Layer[] => {
      if (parentId === null) {
        // Insert at root level
        const newLayers = [...layers];
        newLayers.splice(index, 0, layer);
        return newLayers;
      }

      // Insert into parent's children
      return layers.map(node => {
        if (node.id === parentId) {
          const children = node.children || [];
          const newChildren = [...children];
          newChildren.splice(index, 0, layer);
          return { ...node, children: newChildren };
        }
        if (node.children) {
          return { ...node, children: insertLayer(node.children, parentId, index, layer) };
        }
        return node;
      });
    };

    // Remove layer from current position
    let newLayers = removeLayer(draft.layers);

    // Insert at new position
    newLayers = insertLayer(newLayers, targetParentId, targetIndex, layerToMove);

    set({
      draftsByPageId: {
        ...draftsByPageId,
        [pageId]: { ...draft, layers: newLayers }
      }
    });

    return true;
  },

  setDraftLayers: (pageId, layers) => {

    const { draftsByPageId } = get();
    const draft = draftsByPageId[pageId];
    if (!draft) {
      console.error('❌ SET DRAFT LAYERS: No draft found for page', pageId);
      return;
    }

    set({
      draftsByPageId: {
        ...draftsByPageId,
        [pageId]: { ...draft, layers },
      },
    });

  },

  copyLayer: (pageId, layerId) => {
    const { draftsByPageId } = get();
    const draft = draftsByPageId[pageId];
    if (!draft) return null;

    const findLayer = (layers: Layer[], id: string): Layer | null => {
      for (const layer of layers) {
        if (layer.id === id) return layer;
        if (layer.children) {
          const found = findLayer(layer.children, id);
          if (found) return found;
        }
      }
      return null;
    };

    const layer = findLayer(draft.layers, layerId);
    if (!layer) return null;

    // Deep clone the layer
    return cloneDeep(layer);
  },

  duplicateLayer: (pageId, layerId) => {
    const { draftsByPageId, copyLayer } = get();
    const draft = draftsByPageId[pageId];
    if (!draft) return;

    // Copy the layer
    const layerCopy = copyLayer(pageId, layerId);
    if (!layerCopy) return;

    // Regenerate IDs for the copy
    const regenerateIds = (layer: Layer): Layer => {
      const newId = `layer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      return {
        ...layer,
        id: newId,
        children: layer.children?.map(regenerateIds),
      };
    };

    const newLayer = regenerateIds(layerCopy);

    // Find parent and index of the original layer
    const findParentAndIndex = (
      layers: Layer[],
      targetId: string,
      parent: Layer | null = null,
      index: number = 0
    ): { parent: Layer | null; index: number } | null => {
      for (let i = 0; i < layers.length; i++) {
        const layer = layers[i];
        if (layer.id === targetId) {
          return { parent, index: i };
        }
        if (layer.children && layer.children.length > 0) {
          const found = findParentAndIndex(layer.children, targetId, layer, i);
          if (found) return found;
        }
      }
      return null;
    };

    const result = findParentAndIndex(draft.layers, layerId);
    if (!result) return;

    // Insert the duplicate after the original layer
    const insertAfter = (layers: Layer[], parentLayer: Layer | null, insertIndex: number): Layer[] => {
      if (parentLayer === null) {
        // Insert at root level
        const newLayers = [...layers];
        newLayers.splice(insertIndex + 1, 0, newLayer);
        return newLayers;
      }

      // Find and update the parent
      return layers.map(layer => {
        if (layer.id === parentLayer.id) {
          const children = [...(layer.children || [])];
          children.splice(insertIndex + 1, 0, newLayer);
          return { ...layer, children };
        }

        if (layer.children && layer.children.length > 0) {
          return { ...layer, children: insertAfter(layer.children, parentLayer, insertIndex) };
        }

        return layer;
      });
    };

    const newLayers = insertAfter(draft.layers, result.parent, result.index);

    // Use functional update to ensure latest state
    set((state) => ({
      draftsByPageId: {
        ...state.draftsByPageId,
        [pageId]: { ...state.draftsByPageId[pageId], layers: newLayers },
      },
    }));
  },

  copyLayers: (pageId, layerIds) => {
    const { copyLayer } = get();
    const layers: Layer[] = [];

    for (const layerId of layerIds) {
      if (layerId === 'body') continue; // Skip body
      const layer = copyLayer(pageId, layerId);
      if (layer) {
        layers.push(layer);
      }
    }

    return layers;
  },

  duplicateLayers: (pageId, layerIds) => {
    const { draftsByPageId, copyLayer } = get();
    const draft = draftsByPageId[pageId];
    if (!draft || layerIds.length === 0) return;


    // Filter out body and locked layers
    const validIds: string[] = [];
    const findLayer = (tree: Layer[], id: string): Layer | null => {
      for (const node of tree) {
        if (node.id === id) return node;
        if (node.children) {
          const found = findLayer(node.children, id);
          if (found) return found;
        }
      }
      return null;
    };

    // Check each layer ID
    for (const layerId of layerIds) {
      if (layerId === 'body') continue; // Skip body
      const layer = findLayer(draft.layers, layerId);
      if (layer && !layer.locked) {
        validIds.push(layerId);
      }
    }

    if (validIds.length === 0) {
      console.warn('No valid layers to duplicate');
      return;
    }

    // Regenerate IDs for a layer and its children
    const regenerateIds = (layer: Layer): Layer => {
      const newId = `layer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      return {
        ...layer,
        id: newId,
        children: layer.children?.map(regenerateIds),
      };
    };

    // Duplicate each layer
    let newLayers = draft.layers;
    for (const layerId of validIds) {
      const layerCopy = copyLayer(pageId, layerId);
      if (!layerCopy) continue;

      const newLayer = regenerateIds(layerCopy);

      // Find parent and index of the original layer
      const findParentAndIndex = (
        layers: Layer[],
        targetId: string,
        parent: Layer | null = null,
        index: number = 0
      ): { parent: Layer | null; index: number } | null => {
        for (let i = 0; i < layers.length; i++) {
          const layer = layers[i];
          if (layer.id === targetId) {
            return { parent, index: i };
          }
          if (layer.children && layer.children.length > 0) {
            const found = findParentAndIndex(layer.children, targetId, layer, i);
            if (found) return found;
          }
        }
        return null;
      };

      const result = findParentAndIndex(newLayers, layerId);
      if (!result) continue;

      // Insert the duplicate after the original layer
      const insertAfter = (layers: Layer[], parentLayer: Layer | null, insertIndex: number): Layer[] => {
        if (parentLayer === null) {
          // Insert at root level
          const updated = [...layers];
          updated.splice(insertIndex + 1, 0, newLayer);
          return updated;
        }

        // Find and update the parent
        return layers.map(layer => {
          if (layer.id === parentLayer.id) {
            const children = [...(layer.children || [])];
            children.splice(insertIndex + 1, 0, newLayer);
            return { ...layer, children };
          }

          if (layer.children && layer.children.length > 0) {
            return { ...layer, children: insertAfter(layer.children, parentLayer, insertIndex) };
          }

          return layer;
        });
      };

      newLayers = insertAfter(newLayers, result.parent, result.index);
    }


    // Use functional update to ensure latest state
    set((state) => ({
      draftsByPageId: {
        ...state.draftsByPageId,
        [pageId]: { ...state.draftsByPageId[pageId], layers: newLayers },
      },
    }));
  },

  pasteAfter: (pageId, targetLayerId, layerToPaste) => {
    const { draftsByPageId } = get();
    const draft = draftsByPageId[pageId];
    if (!draft) return;

    // Regenerate IDs for the pasted layer
    const regenerateIds = (layer: Layer): Layer => {
      const newId = `layer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      return {
        ...layer,
        id: newId,
        children: layer.children?.map(regenerateIds),
      };
    };

    const newLayer = regenerateIds(cloneDeep(layerToPaste));

    // Find parent and index of the target layer
    // Must check BOTH children AND items when both exist
    const findParentAndIndex = (
      layers: Layer[],
      targetId: string,
      parent: Layer | null = null,
      propertyName: 'children' | 'items' | null = null
    ): { parent: Layer | null; index: number; propertyName: 'children' | 'items' | null } | null => {
      for (let i = 0; i < layers.length; i++) {
        const layer = layers[i];

        if (layer.id === targetId) {
          return { parent, index: i, propertyName };
        }

        // Search only children array
        if (layer.children && layer.children.length > 0) {
          const found = findParentAndIndex(layer.children, targetId, layer, 'children');
          if (found) return found;
        }
      }

      return null;
    };

    const result = findParentAndIndex(draft.layers, targetLayerId);
    if (!result) {
      console.error('❌ TARGET LAYER NOT FOUND:', targetLayerId);
      return;
    }

    // Insert after the target layer
    const insertAfter = (
      layers: Layer[],
      parentLayer: Layer | null,
      insertIndex: number,
      targetPropertyName: 'children' | 'items' | null
    ): Layer[] => {
      if (parentLayer === null) {
        // Insert at root level
        const newLayers = [...layers];
        newLayers.splice(insertIndex + 1, 0, newLayer);
        return newLayers;
      }

      // Find and update the parent
      return layers.map(layer => {
        if (layer.id === parentLayer.id) {
          const children = [...(layer.children || [])];
          children.splice(insertIndex + 1, 0, newLayer);
          return { ...layer, children };
        }

        // Recursively search in children
        if (layer.children && layer.children.length > 0) {
          return { ...layer, children: insertAfter(layer.children, parentLayer, insertIndex, targetPropertyName) };
        }

        return layer;
      });
    };

    const newLayers = insertAfter(draft.layers, result.parent, result.index, result.propertyName);

    // Use functional update to ensure latest state
    set((state) => ({
      draftsByPageId: {
        ...state.draftsByPageId,
        [pageId]: { ...state.draftsByPageId[pageId], layers: newLayers },
      },
    }));
  },

  createPage: async (pageData) => {
    console.log('[usePagesStore.createPage] Starting...', pageData);

    const { pages, draftsByPageId } = get();

    // Generate temporary ID for optimistic update
    const tempId = `temp-page-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const tempPublishKey = `temp-${Date.now()}`;

    // Create temporary page object
    const tempPage: Page = {
      id: tempId,
      ...pageData,
      publish_key: tempPublishKey,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };

    // Create temporary draft with Body layer
    const tempDraft: PageLayers = {
      id: `draft-${tempId}`,
      page_id: tempId,
      layers: [{
        id: 'body',
        type: 'container' as const,
        classes: '',
        children: [],
        locked: true,
      }],
      is_published: false,
      publish_key: tempPublishKey,
      created_at: new Date().toISOString(),
      deleted_at: null,
    };

    // Optimistic update: Add to UI immediately
    set({
      pages: [...pages, tempPage],
      draftsByPageId: { ...draftsByPageId, [tempId]: tempDraft },
      isLoading: true,
      error: null
    });

    console.log('[usePagesStore.createPage] Optimistic UI update complete, calling API...');

    try {
      const response = await pagesApi.create(pageData);

      if (response.error) {
        console.error('[usePagesStore.createPage] Error:', response.error);
        // Rollback: Remove temp page
        set({
          pages: pages, // Original pages without temp
          draftsByPageId: draftsByPageId, // Original drafts without temp
          error: response.error,
          isLoading: false
        });
        return { success: false, error: response.error };
      }

      if (response.data) {
        // Replace temp page with real one from database
        const { pages: currentPages, draftsByPageId: currentDrafts } = get();
        const updatedPages = currentPages.map(p => p.id === tempId ? response.data! : p);

        // Replace temp draft with real one (keeping the same structure but with real ID)
        const updatedDrafts = { ...currentDrafts };
        delete updatedDrafts[tempId];
        updatedDrafts[response.data.id] = {
          ...tempDraft,
          id: `draft-${response.data.id}`,
          page_id: response.data.id,
          publish_key: response.data.publish_key,
        };

        set({
          pages: updatedPages,
          draftsByPageId: updatedDrafts,
          isLoading: false
        });

        console.log('[usePagesStore.createPage] Success - replaced temp ID with real ID');
        return { success: true, data: response.data, tempId };
      }

      return { success: false, error: 'No data returned' };
    } catch (error) {
      console.error('[usePagesStore.createPage] Exception:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to create page';
      // Rollback: Remove temp page
      set({
        pages: pages,
        draftsByPageId: draftsByPageId,
        error: errorMsg,
        isLoading: false
      });
      return { success: false, error: errorMsg };
    }
  },

  updatePage: async (pageId, updates) => {
    console.log('[usePagesStore.updatePage] Starting...', pageId, updates);
    set({ isLoading: true, error: null });

    try {
      const response = await pagesApi.update(pageId, updates);

      if (response.error) {
        console.error('[usePagesStore.updatePage] Error:', response.error);
        set({ error: response.error, isLoading: false });
        return { success: false, error: response.error };
      }

      if (response.data) {
        // Update page in local state
        const { pages } = get();
        const updatedPages = pages.map(p =>
          p.id === pageId ? response.data! : p
        );

        set({
          pages: updatedPages,
          isLoading: false
        });

        console.log('[usePagesStore.updatePage] Success');
        return { success: true };
      }

      return { success: false, error: 'No data returned' };
    } catch (error) {
      console.error('[usePagesStore.updatePage] Exception:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to update page';
      set({ error: errorMsg, isLoading: false });
      return { success: false, error: errorMsg };
    }
  },

  deletePage: async (pageId, currentPageId?: string | null) => {
    console.log('[usePagesStore.deletePage] Starting...', pageId);

    const { pages, folders, draftsByPageId } = get();

    // Find the page
    const pageToDelete = pages.find(p => p.id === pageId);
    if (!pageToDelete) {
      return { success: false, error: 'Page not found' };
    }

    // Check if page is locked
    if (pageToDelete.is_locked) {
      console.warn('Cannot delete this page: page is locked');
      return { success: false, error: 'This page is locked and cannot be deleted' };
    }

    const isCurrentPage = currentPageId === pageId;

    // Store original state for rollback
    const originalPages = pages;
    const originalFolders = folders;
    const originalDrafts = draftsByPageId;

    // Optimistic update: Remove from UI immediately
    const filteredPages = pages.filter(p => p.id !== pageId);

    // Reorder pages and folders together to eliminate gaps in the order sequence
    const { pages: updatedPages, folders: updatedFolders } = reorderPagesAndFoldersTogether(filteredPages, folders);

    const updatedDrafts = { ...draftsByPageId };
    delete updatedDrafts[pageId];

    set({
      pages: updatedPages,
      folders: updatedFolders,
      draftsByPageId: updatedDrafts,
      isLoading: true,
      error: null
    });

    console.log('[usePagesStore.deletePage] Optimistic UI update complete, calling API...');

    try {
      const response = await pagesApi.delete(pageId);

      if (response.error) {
        console.error('[usePagesStore.deletePage] Error:', response.error);
        // Rollback optimistic update
        set({
          pages: originalPages,
          folders: originalFolders,
          draftsByPageId: originalDrafts,
          error: response.error,
          isLoading: false
        });
        return { success: false, error: response.error };
      }

      set({ isLoading: false });
      console.log('[usePagesStore.deletePage] Success');

      // Determine next page to select if current was deleted
      let nextPageId: string | null = null;
      if (isCurrentPage && updatedPages.length > 0) {
        const homePage = updatedPages.find(p => p.is_locked && p.is_index && p.depth === 0);
        nextPageId = (homePage || updatedPages[0]).id;
      }

      return {
        success: true,
        currentPageDeleted: isCurrentPage,
        nextPageId,
      };
    } catch (error) {
      console.error('[usePagesStore.deletePage] Exception:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to delete page';
      // Rollback optimistic update
      set({
        pages: originalPages,
        folders: originalFolders,
        draftsByPageId: originalDrafts,
        error: errorMsg,
        isLoading: false
      });
      return { success: false, error: errorMsg };
    }
  },

  createFolder: async (folderData) => {
    console.log('[usePagesStore.createFolder] Starting...', folderData);

    const { folders } = get();

    // Generate temporary ID for optimistic update
    const tempId = `temp-folder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const tempPublishKey = `temp-${Date.now()}`;

    // Create temporary folder object
    const tempFolder: PageFolder = {
      id: tempId,
      ...folderData,
      publish_key: tempPublishKey,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };

    // Optimistic update: Add to UI immediately
    set({
      folders: [...folders, tempFolder],
      isLoading: true,
      error: null
    });

    console.log('[usePagesStore.createFolder] Optimistic UI update complete, calling API...');

    try {
      const response = await foldersApi.create(folderData);

      if (response.error) {
        console.error('[usePagesStore.createFolder] Error:', response.error);
        // Rollback: Remove temp folder
        set({
          folders: folders, // Original folders without temp
          error: response.error,
          isLoading: false
        });
        return { success: false, error: response.error };
      }

      if (response.data) {
        // Replace temp folder with real one from database
        const { folders: currentFolders } = get();
        const updatedFolders = currentFolders.map(f => f.id === tempId ? response.data! : f);

        set({
          folders: updatedFolders,
          isLoading: false
        });

        console.log('[usePagesStore.createFolder] Success - replaced temp ID with real ID');
        return { success: true, data: response.data, tempId };
      }

      return { success: false, error: 'No data returned' };
    } catch (error) {
      console.error('[usePagesStore.createFolder] Exception:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to create folder';
      // Rollback: Remove temp folder
      set({
        folders: folders,
        error: errorMsg,
        isLoading: false
      });
      return { success: false, error: errorMsg };
    }
  },

  deleteFolder: async (folderId, currentPageId?: string | null) => {
    console.log('[usePagesStore.deleteFolder] Starting...', folderId);

    const { folders, pages, draftsByPageId } = get();

    // Store original state for rollback
    const originalFolders = folders;
    const originalPages = pages;
    const originalDrafts = draftsByPageId;

    // Get all descendant folder IDs using the utility function
    const descendantFolderIds = getDescendantFolderIds(folderId, folders);
    const allFolderIds = [folderId, ...descendantFolderIds];

    console.log(`[usePagesStore.deleteFolder] Deleting folder and ${descendantFolderIds.length} descendants`);

    // Check if current page is affected
    const currentPage = currentPageId ? pages.find(p => p.id === currentPageId) : null;
    const isCurrentPageAffected = !!(currentPage && currentPage.page_folder_id && allFolderIds.includes(currentPage.page_folder_id));

    // Calculate what will be deleted
    const filteredFolders = folders.filter(f => !allFolderIds.includes(f.id));
    const deletedPageIds = pages.filter(p => p.page_folder_id && allFolderIds.includes(p.page_folder_id)).map(p => p.id);
    const filteredPages = pages.filter(p => !p.page_folder_id || !allFolderIds.includes(p.page_folder_id));

    // Reorder pages and folders together to eliminate gaps in the order sequence
    const { pages: updatedPages, folders: updatedFolders } = reorderPagesAndFoldersTogether(filteredPages, filteredFolders);

    // Remove drafts for deleted pages
    const updatedDrafts = { ...draftsByPageId };
    deletedPageIds.forEach(pageId => {
      delete updatedDrafts[pageId];
    });

    // Optimistic update: Remove from UI immediately
    set({
      folders: updatedFolders,
      pages: updatedPages,
      draftsByPageId: updatedDrafts,
      isLoading: true,
      error: null
    });

    console.log('[usePagesStore.deleteFolder] Optimistic UI update complete, calling API...');

    try {
      // Delete from API
      const response = await foldersApi.delete(folderId);

      if (response.error) {
        console.error('[usePagesStore.deleteFolder] Error:', response.error);
        // Rollback optimistic update
        set({
          folders: originalFolders,
          pages: originalPages,
          draftsByPageId: originalDrafts,
          error: response.error,
          isLoading: false
        });
        return { success: false, error: response.error };
      }

      set({ isLoading: false });
      console.log(`[usePagesStore.deleteFolder] Success - removed ${allFolderIds.length} folders and ${deletedPageIds.length} pages`);

      // Determine next page to select if current was affected
      let nextPageId: string | null = null;
      if (isCurrentPageAffected && updatedPages.length > 0) {
        const homePage = updatedPages.find(p => p.is_locked && p.is_index && p.depth === 0);
        nextPageId = (homePage || updatedPages[0]).id;
      }

      return {
        success: true,
        currentPageAffected: isCurrentPageAffected,
        nextPageId,
        deletedPageIds,
      };
    } catch (error) {
      console.error('[usePagesStore.deleteFolder] Exception:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to delete folder';
      // Rollback optimistic update
      set({
        folders: originalFolders,
        pages: originalPages,
        draftsByPageId: originalDrafts,
        error: errorMsg,
        isLoading: false
      });
      return { success: false, error: errorMsg };
    }
  },

  pasteInside: (pageId, targetLayerId, layerToPaste) => {
    const { draftsByPageId } = get();
    const draft = draftsByPageId[pageId];
    if (!draft) return;


    // Regenerate IDs for the pasted layer
    const regenerateIds = (layer: Layer): Layer => {
      const newId = `layer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      return {
        ...layer,
        id: newId,
        children: layer.children?.map(regenerateIds),
      };
    };

    const newLayer = regenerateIds(cloneDeep(layerToPaste));

    // Insert as last child of target layer
    const insertInside = (layers: Layer[]): Layer[] => {
      return layers.map(layer => {
        if (layer.id === targetLayerId) {
          const updated = { ...layer, children: [...(layer.children || []), newLayer] };
          return updated;
        }

        // Recursively search in children
        if (layer.children && layer.children.length > 0) {
          return { ...layer, children: insertInside(layer.children) };
        }

        return layer;
      });
    };

    const newLayers = insertInside(draft.layers);

    // Use functional update to ensure latest state
    set((state) => ({
      draftsByPageId: {
        ...state.draftsByPageId,
        [pageId]: { ...state.draftsByPageId[pageId], layers: newLayers },
      },
    }));

  },

  /**
   * Update all layers using a specific style across all pages
   * Used when a style is updated
   * Updates the classes/design on layers that have the style applied
   */
  updateStyleOnLayers: (styleId, newClasses, newDesign) => {
    const { draftsByPageId } = get();

    const updatedDrafts = { ...draftsByPageId };

    Object.keys(updatedDrafts).forEach(pageId => {
      const draft = updatedDrafts[pageId];
      updatedDrafts[pageId] = {
        ...draft,
        layers: updateLayersWithStyle(draft.layers, styleId, newClasses, newDesign),
      };
    });

    set({ draftsByPageId: updatedDrafts });
  },

  /**
   * Detach a style from all layers across all pages
   * Used when a style is deleted
   * Keeps current classes/design values but removes the style link
   */
  detachStyleFromAllLayers: (styleId) => {
    const { draftsByPageId } = get();

    const updatedDrafts = { ...draftsByPageId };

    Object.keys(updatedDrafts).forEach(pageId => {
      const draft = updatedDrafts[pageId];
      updatedDrafts[pageId] = {
        ...draft,
        layers: detachStyleFromLayers(draft.layers, styleId),
      };
    });

    set({ draftsByPageId: updatedDrafts });
  },
}));

// Helper functions for default layer values
function getDefaultClasses(type: Layer['type'], id?: string): string {
  if (id === 'body') return '';

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



