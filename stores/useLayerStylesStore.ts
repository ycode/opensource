/**
 * Layer Styles Store
 *
 * Global state management for layer styles
 * Layer styles are part of the page draft and get published when the page is published
 */

import { create } from 'zustand';
import type { Layer, LayerStyle } from '@/types';

/**
 * Affected entity when deleting a layer style
 */
interface LayerStyleAffectedEntity {
  type: 'page' | 'component';
  id: string;
  name: string;
  pageId?: string;
  previousLayers: Layer[];
  newLayers: Layer[];
}

/**
 * Result of delete operation
 */
interface DeleteResult {
  success: boolean;
  affectedEntities?: LayerStyleAffectedEntity[];
}

interface LayerStylesState {
  styles: LayerStyle[];
  isLoading: boolean;
  error: string | null;
}

interface LayerStylesActions {
  // Data loading
  setStyles: (styles: LayerStyle[]) => void;
  loadStyles: () => Promise<void>;

  // CRUD operations
  createStyle: (name: string, classes: string, design?: LayerStyle['design']) => Promise<LayerStyle | null>;
  updateStyle: (id: string, updates: Partial<Pick<LayerStyle, 'name' | 'classes' | 'design'>>) => Promise<void>;
  deleteStyle: (id: string) => Promise<DeleteResult>;

  // Restoration for undo/redo
  restoreLayerStyles: (styleIds: string[]) => Promise<void>;

  // Convenience actions
  renameStyle: (id: string, newName: string) => Promise<void>;
  getStyleById: (id: string) => LayerStyle | undefined;

  // State management
  setError: (error: string | null) => void;
  clearError: () => void;
}

type LayerStylesStore = LayerStylesState & LayerStylesActions;

export const useLayerStylesStore = create<LayerStylesStore>((set, get) => ({
  // Initial state
  styles: [],
  isLoading: false,
  error: null,

  // Set styles (used by unified init)
  setStyles: (styles) => set({ styles }),

  // Load all styles
  loadStyles: async () => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch('/api/layer-styles');
      const result = await response.json();

      if (result.error) {
        set({ error: result.error, isLoading: false });
        return;
      }

      set({ styles: result.data || [], isLoading: false });
    } catch (error) {
      console.error('Failed to load layer styles:', error);
      set({ error: 'Failed to load styles', isLoading: false });
    }
  },

  // Create a new style
  createStyle: async (name, classes, design) => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch('/api/layer-styles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          classes,
          design,
        }),
      });

      const result = await response.json();

      if (result.error) {
        set({ error: result.error, isLoading: false });
        return null;
      }

      const newStyle = result.data;
      set((state) => ({
        styles: [newStyle, ...state.styles],
        isLoading: false,
      }));

      return newStyle;
    } catch (error) {
      console.error('Failed to create layer style:', error);
      set({ error: 'Failed to create style', isLoading: false });
      return null;
    }
  },

  // Update a style
  updateStyle: async (id, updates) => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`/api/layer-styles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      const result = await response.json();

      if (result.error) {
        set({ error: result.error, isLoading: false });
        return;
      }

      const updatedStyle = result.data;
      set((state) => ({
        styles: state.styles.map((s) => (s.id === id ? updatedStyle : s)),
        isLoading: false,
      }));

      // Record version for undo/redo (async, non-blocking)
      import('@/lib/version-tracking').then(({ recordVersionViaApi }) => {
        recordVersionViaApi('layer_style', id, { classes: updatedStyle.classes, design: updatedStyle.design });
      }).catch((err) => {
        console.error('Failed to record style version:', err);
      });
    } catch (error) {
      console.error('Failed to update layer style:', error);
      set({ error: 'Failed to update style', isLoading: false });
    }
  },

  // Delete a style (soft delete with undo/redo support)
  deleteStyle: async (id) => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`/api/layer-styles/${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.error) {
        set({ error: result.error, isLoading: false });
        return { success: false };
      }

      const { layerStyle, affectedEntities } = result.data;

      // Remove the style from local store immediately after API success
      // Note: All subsequent operations use data from the API response, not from the store
      set((state) => ({
        styles: state.styles.filter((s) => s.id !== id),
        isLoading: false,
      }));

      // Update pages store and components store for affected entities
      // These operations are non-blocking - if they fail, the style is still deleted
      if (affectedEntities && affectedEntities.length > 0) {
        try {
          const { usePagesStore } = await import('./usePagesStore');
          const { useComponentsStore } = await import('./useComponentsStore');
          const pagesStore = usePagesStore.getState();
          const componentsStore = useComponentsStore.getState();

          for (const entity of affectedEntities) {
            if (entity.type === 'page' && entity.pageId) {
              // Update the page draft with new layers (style detached)
              const currentDraft = pagesStore.draftsByPageId[entity.pageId];
              if (currentDraft) {
                pagesStore.setDraftLayers(entity.pageId, entity.newLayers);
              }
            } else if (entity.type === 'component') {
              // Update component in local store
              useComponentsStore.setState((state) => ({
                components: state.components.map((c) =>
                  c.id === entity.id ? { ...c, layers: entity.newLayers } : c
                ),
              }));

              // Also update component draft if it's currently being edited
              const currentDraft = componentsStore.componentDrafts[entity.id];
              if (currentDraft) {
                componentsStore.updateComponentDraft(entity.id, entity.newLayers);
              }
            }
          }

          // Record undo/redo versions for affected entities
          const { recordVersionViaApi, initializeVersionTracking } = await import('@/lib/version-tracking');
          const { useEditorStore } = await import('./useEditorStore');

          // Get current editor state to check if any affected entity is currently being edited
          const editorState = useEditorStore.getState();
          const currentPageId = editorState.currentPageId;
          const editingComponentId = editorState.editingComponentId;
          const selectedLayerId = editorState.selectedLayerId;
          const lastSelectedLayerId = editorState.lastSelectedLayerId;

          // Helper: Find all layer IDs of layers using this style
          const findStyleLayerIds = (layers: Layer[], styleId: string): string[] => {
            const layerIds: string[] = [];
            const traverse = (layerList: Layer[]) => {
              for (const layer of layerList) {
                if (layer.styleId === styleId) {
                  layerIds.push(layer.id);
                }
                if (layer.children && layer.children.length > 0) {
                  traverse(layer.children);
                }
              }
            };
            traverse(layers);
            return layerIds;
          };

          // Record versions with layer style requirement metadata
          for (const entity of affectedEntities) {
            const metadata: any = {
              requirements: {
                layer_style_ids: [id], // The deleted style must be restored before undoing
              },
            };

            // Build prioritized selection list
            const layerIds: string[] = [];

            // If this entity is currently being edited, capture current selection first
            const isCurrentlyEditing =
            (entity.type === 'page' && entity.pageId === currentPageId) ||
            (entity.type === 'component' && entity.id === editingComponentId);

            if (isCurrentlyEditing) {
              if (selectedLayerId) layerIds.push(selectedLayerId);
              if (lastSelectedLayerId && lastSelectedLayerId !== selectedLayerId) {
                layerIds.push(lastSelectedLayerId);
              }
            }

            // Add the layer IDs that are using this style (for selection restoration)
            const styleLayerIds = findStyleLayerIds(entity.previousLayers, id);
            for (const layerId of styleLayerIds) {
              if (!layerIds.includes(layerId)) {
                layerIds.push(layerId);
              }
            }

            // Store selection metadata if we have any layer IDs
            if (layerIds.length > 0) {
              metadata.selection = {
                layer_ids: layerIds,
              };
            }

            if (entity.type === 'page' && entity.pageId) {
            // Initialize cache with previous state (before detachment) if not already cached
              initializeVersionTracking('page_layers', entity.pageId, entity.previousLayers);
              // Record version with new state (after detachment)
              await recordVersionViaApi('page_layers', entity.pageId, entity.newLayers, metadata);
            } else if (entity.type === 'component') {
            // Initialize cache with previous state (before detachment) if not already cached
              initializeVersionTracking('component', entity.id, entity.previousLayers);
              // Record version with new state (after detachment)
              await recordVersionViaApi('component', entity.id, entity.newLayers, metadata);
            }
          }
        } catch (postDeleteError) {
          // Log error but don't fail the deletion - style is already removed
          console.error('Error updating stores after style deletion:', postDeleteError);
        }
      }

      return { success: true, affectedEntities };
    } catch (error) {
      console.error('Failed to delete layer style:', error);
      set({ error: 'Failed to delete style', isLoading: false });
      return { success: false };
    }
  },

  // Restore layer styles (for undo/redo)
  restoreLayerStyles: async (styleIds) => {
    if (!styleIds || styleIds.length === 0) return;

    const existingIds = new Set(get().styles.map(s => s.id));
    const stylesToRestore: string[] = [];

    for (const styleId of styleIds) {
      if (!existingIds.has(styleId)) {
        stylesToRestore.push(styleId);
      }
    }

    if (stylesToRestore.length === 0) return;

    // Restore each style via API
    for (const styleId of stylesToRestore) {
      try {
        const response = await fetch(`/api/layer-styles/${styleId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'restore' }),
        });

        const result = await response.json();

        if (result.data) {
          // Add the restored style to the store
          set((state) => ({
            styles: [result.data, ...state.styles],
          }));
        }
      } catch (error) {
        console.error(`Failed to restore layer style ${styleId}:`, error);
      }
    }
  },

  // Rename a style (convenience method)
  renameStyle: async (id, newName) => {
    await get().updateStyle(id, { name: newName });
  },

  // Get style by ID (convenience method)
  getStyleById: (id) => {
    return get().styles.find((s) => s.id === id);
  },

  // Error management
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
}));
