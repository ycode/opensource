'use client';

import { create } from 'zustand';
import type { Layer, Page, PageVersion } from '../types';
import { pagesApi, pageVersionsApi } from '../lib/api';
import { getTemplate, getBlockName } from '../lib/templates/blocks';
import { cloneDeep } from 'lodash';
import { canHaveChildren } from '../lib/layer-utils';
import { extractPublishedCSS } from '../lib/extract-published-css';

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

      // Note: Default homepage with draft version is created during migrations (20250101000002_create_page_versions_table.ts)

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
      // Extract CSS from Tailwind JIT for published pages
      const generatedCSS = await extractPublishedCSS(draft.layers);
      
      console.log('💾 Saving draft with extracted CSS:', {
        cssLength: generatedCSS?.length || 0,
        layersCount: draft.layers.length
      });
      
      const response = await pageVersionsApi.updateDraft(
        pageId, 
        draft.layers,
        generatedCSS
      );
      
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
      console.error('Failed to save draft:', error);
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
        created_at: new Date().toISOString(),
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
        console.log(`🔄 Cannot add child to ${result.layer.name || result.layer.type} - placing after selected layer instead`);

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

    console.log('🔴 DELETE LAYER:', { pageId, layerId });

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

    console.log('🎯 FOUND LAYER TO DELETE:', layerToDelete);

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
    console.log('✅ LAYERS AFTER DELETE:', newLayers);

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

    console.log('🔴 DELETE MULTIPLE LAYERS:', { pageId, layerIds });

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
    console.log('✅ LAYERS AFTER MULTI-DELETE:', { deleted: finalIds.size, remaining: newLayers.length });

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
    console.log('🏬 [usePagesStore] updateLayer called:', {
      pageId,
      layerId,
      updates,
    });
    
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
    
    console.log('✅ [usePagesStore] updateLayer completed, newLayers:', {
      layersCount: newLayers.length,
      updatedLayer: findLayerInTree(newLayers, layerId),
    });

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
    console.log('💾 SET DRAFT LAYERS called:', {
      pageId,
      layersCount: layers.length,
      layers: layers.map(l => ({ id: l.id, type: l.type }))
    });

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

    console.log('✅ SET DRAFT LAYERS: State updated successfully');
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

    console.log('📋 DUPLICATE MULTIPLE LAYERS:', { pageId, layerIds });

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

    console.log('✅ LAYERS AFTER MULTI-DUPLICATE:', { duplicated: validIds.length });

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

  pasteInside: (pageId, targetLayerId, layerToPaste) => {
    const { draftsByPageId } = get();
    const draft = draftsByPageId[pageId];
    if (!draft) return;

    console.log('🔵 PASTE INSIDE:', { pageId, targetLayerId, layerToPaste });

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
    console.log('🟢 NEW LAYER WITH IDS:', newLayer);

    // Insert as last child of target layer
    const insertInside = (layers: Layer[]): Layer[] => {
      return layers.map(layer => {
        if (layer.id === targetLayerId) {
          console.log('🎯 FOUND TARGET LAYER:', layer);
          const updated = { ...layer, children: [...(layer.children || []), newLayer] };
          console.log('✅ UPDATED LAYER:', updated);
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
    console.log('🔷 NEW LAYERS TREE:', JSON.stringify(newLayers, null, 2));

    // Use functional update to ensure latest state
    set((state) => ({
      draftsByPageId: {
        ...state.draftsByPageId,
        [pageId]: { ...state.draftsByPageId[pageId], layers: newLayers },
      },
    }));

    console.log('✅ PASTE INSIDE COMPLETE');
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



