/**
 * Components Store
 *
 * Global state management for components
 * Components are reusable layer trees stored globally
 */

import { create } from 'zustand';
import type { Component, Layer } from '@/types';
import {
  createComponentViaApi,
  replaceLayerWithComponentInstance,
  findLayerById,
} from '@/lib/layer-utils';
import { generateId } from '@/lib/utils';

interface ComponentsState {
  components: Component[];
  isLoading: boolean;
  error: string | null;
  componentDrafts: Record<string, Layer[]>;
  isSaving: boolean;
  saveTimeouts: Record<string, NodeJS.Timeout>;
}

/**
 * Preview info for component deletion
 */
export interface DeletePreviewInfo {
  affectedCount: number;
  affectedEntities: Array<{
    type: 'page' | 'component';
    id: string;
    name: string;
    pageId?: string;
  }>;
}

/**
 * Result of deleting a component
 */
export interface DeleteComponentResult {
  success: boolean;
  affectedEntities?: Array<{
    type: 'page' | 'component';
    id: string;
    name: string;
    pageId?: string;
    previousLayers: Layer[];
    newLayers: Layer[];
  }>;
}

interface ComponentsActions {
  // Data loading
  setComponents: (components: Component[]) => void;
  loadComponents: () => Promise<void>;

  // CRUD operations
  createComponent: (name: string, layers: Layer[]) => Promise<Component | null>;
  updateComponent: (id: string, updates: Partial<Pick<Component, 'name' | 'layers'>>) => Promise<void>;
  deleteComponent: (id: string) => Promise<DeleteComponentResult>;
  getDeletePreview: (id: string) => Promise<DeletePreviewInfo | null>;

  // Draft management (for editing mode)
  loadComponentDraft: (componentId: string) => Promise<void>;
  updateComponentDraft: (componentId: string, layers: Layer[]) => void;
  saveComponentDraft: (componentId: string) => Promise<void>;
  clearComponentDraft: (componentId: string) => void;

  // Convenience actions
  renameComponent: (id: string, newName: string) => Promise<void>;
  getComponentById: (id: string) => Component | undefined;
  createComponentFromLayer: (componentId: string, layerId: string, componentName: string) => Promise<string | null>;
  restoreComponents: (componentIds: string[]) => Promise<string[]>;

  // Component variables
  addTextVariable: (componentId: string, name: string) => Promise<string | null>;
  addImageVariable: (componentId: string, name: string) => Promise<string | null>;
  updateTextVariable: (componentId: string, variableId: string, updates: { name?: string; default_value?: any }) => Promise<void>;
  deleteTextVariable: (componentId: string, variableId: string) => Promise<void>;

  // State management
  setError: (error: string | null) => void;
  clearError: () => void;
  setSaving: (value: boolean) => void;
}

type ComponentsStore = ComponentsState & ComponentsActions;

export const useComponentsStore = create<ComponentsStore>((set, get) => ({
  // Initial state
  components: [],
  isLoading: false,
  error: null,
  componentDrafts: {},
  isSaving: false,
  saveTimeouts: {},

  // Set components (used by unified init)
  setComponents: (components) => set({ components }),

  // Load all components
  loadComponents: async () => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch('/ycode/api/components');
      const result = await response.json();

      if (result.error) {
        set({ error: result.error, isLoading: false });
        return;
      }

      set({ components: result.data || [], isLoading: false });
    } catch (error) {
      console.error('Failed to load components:', error);
      set({ error: 'Failed to load components', isLoading: false });
    }
  },

  // Create a new component
  createComponent: async (name, layers) => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch('/ycode/api/components', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          layers,
        }),
      });

      const result = await response.json();

      if (result.error) {
        set({ error: result.error, isLoading: false });
        return null;
      }

      const newComponent = result.data;
      set((state) => ({
        components: [newComponent, ...state.components],
        isLoading: false,
      }));

      return newComponent;
    } catch (error) {
      console.error('Failed to create component:', error);
      set({ error: 'Failed to create component', isLoading: false });
      return null;
    }
  },

  // Update a component
  updateComponent: async (id, updates) => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`/ycode/api/components/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      const result = await response.json();

      if (result.error) {
        set({ error: result.error, isLoading: false });
        return;
      }

      const updatedComponent = result.data;
      set((state) => ({
        components: state.components.map((c) => (c.id === id ? updatedComponent : c)),
        isLoading: false,
      }));
    } catch (error) {
      console.error('Failed to update component:', error);
      set({ error: 'Failed to update component', isLoading: false });
    }
  },

  // Get preview of what will be affected by deleting a component
  getDeletePreview: async (id) => {
    try {
      const response = await fetch(`/ycode/api/components/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'preview-delete' }),
      });

      const result = await response.json();

      if (result.error) {
        console.error('Failed to get delete preview:', result.error);
        return null;
      }

      return result.data as DeletePreviewInfo;
    } catch (error) {
      console.error('Failed to get delete preview:', error);
      return null;
    }
  },

  // Delete a component (soft delete with undo/redo support)
  deleteComponent: async (id) => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`/ycode/api/components/${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.error) {
        set({ error: result.error, isLoading: false });
        return { success: false };
      }

      const { component, affectedEntities } = result.data;

      // Update pages store for affected pages
      if (affectedEntities && affectedEntities.length > 0) {
        const { usePagesStore } = await import('./usePagesStore');
        const pagesStore = usePagesStore.getState();

        for (const entity of affectedEntities) {
          if (entity.type === 'page' && entity.pageId) {
            // Update the page draft with new layers (component detached)
            const currentDraft = pagesStore.draftsByPageId[entity.pageId];
            if (currentDraft) {
              pagesStore.setDraftLayers(entity.pageId, entity.newLayers);
            }
          } else if (entity.type === 'component') {
            // Update component in local store
            set((state) => ({
              components: state.components.map((c) =>
                c.id === entity.id ? { ...c, layers: entity.newLayers } : c
              ),
            }));

            // Also update component draft if it's currently being edited
            const currentDraft = get().componentDrafts[entity.id];
            if (currentDraft) {
              get().updateComponentDraft(entity.id, entity.newLayers);
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

        // Helper: Find all layer IDs of component instances in a layer tree
        const findComponentInstanceLayerIds = (layers: Layer[], componentId: string): string[] => {
          const instanceIds: string[] = [];
          const traverse = (layerList: Layer[]) => {
            for (const layer of layerList) {
              if (layer.componentId === componentId) {
                instanceIds.push(layer.id);
              }
              if (layer.children && layer.children.length > 0) {
                traverse(layer.children);
              }
            }
          };
          traverse(layers);
          return instanceIds;
        };

        // Record versions with component requirement metadata
        for (const entity of affectedEntities) {
          // Note: Component requirements are now auto-detected from layers
          // We still explicitly add the deleted component ID for clarity and as a safety measure
          const metadata: any = {
            requirements: {
              component_ids: [id], // The deleted component must be restored before undoing
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

          // Always add the component instance layer IDs that are being detached
          // These will be restored when undoing, so they're good selection candidates
          const componentInstanceIds = findComponentInstanceLayerIds(entity.previousLayers, id);
          for (const instanceId of componentInstanceIds) {
            if (!layerIds.includes(instanceId)) {
              layerIds.push(instanceId);
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
      }

      // Remove the component from local store
      set((state) => ({
        components: state.components.filter((c) => c.id !== id),
        isLoading: false,
      }));

      return { success: true, affectedEntities };
    } catch (error) {
      console.error('Failed to delete component:', error);
      set({ error: 'Failed to delete component', isLoading: false });
      return { success: false };
    }
  },

  // Load component into draft for editing
  loadComponentDraft: async (componentId) => {
    const component = get().components.find((c) => c.id === componentId);
    if (component) {
      const layers = JSON.parse(JSON.stringify(component.layers)); // Deep clone

      // Mark entity as initializing BEFORE updating store to prevent false change detection
      try {
        const { markEntityInitializing, updatePreviousState } = await import('@/hooks/use-undo-redo');
        markEntityInitializing('component', componentId);
        // Also sync the previous state cache with loaded data
        updatePreviousState('component', componentId, layers);
      } catch (err) {
        console.error('Failed to mark component as initializing:', err);
      }

      set((state) => ({
        componentDrafts: {
          ...state.componentDrafts,
          [componentId]: layers,
        },
      }));

      // Initialize version tracking with loaded state
      import('@/lib/version-tracking').then(({ initializeVersionTracking }) => {
        initializeVersionTracking('component', componentId, layers);
      }).catch((err) => {
        console.error('Failed to initialize component version tracking:', err);
      });
    }
  },

  // Update component draft (triggers auto-save)
  updateComponentDraft: (componentId, layers) => {
    set((state) => ({
      componentDrafts: {
        ...state.componentDrafts,
        [componentId]: layers,
      },
    }));

    // Clear existing timeout for this component
    const { saveTimeouts } = get();
    if (saveTimeouts[componentId]) {
      clearTimeout(saveTimeouts[componentId]);
    }

    // Set new timeout for auto-save (500ms debounce)
    const timeout = setTimeout(() => {
      get().saveComponentDraft(componentId);
    }, 500);

    set((state) => ({
      saveTimeouts: {
        ...state.saveTimeouts,
        [componentId]: timeout,
      },
    }));
  },

  // Save component draft to database
  saveComponentDraft: async (componentId) => {
    const { componentDrafts } = get();
    const draftLayers = componentDrafts[componentId];

    if (!draftLayers) {
      console.warn(`No draft found for component ${componentId}`);
      return;
    }

    // Capture the layers we're about to save
    const layersBeingSaved = draftLayers;

    set({ isSaving: true });

    try {
      const response = await fetch(`/ycode/api/components/${componentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layers: layersBeingSaved }),
      });

      const result = await response.json();

      if (result.error) {
        console.error('Failed to save component draft:', result.error);
        set({ isSaving: false });
        return;
      }

      const updatedComponent = result.data;

      // Update the component in the store
      // Check if layers changed during save (e.g., undo/redo happened)
      const currentDraft = get().componentDrafts[componentId];
      const currentLayersJSON = JSON.stringify(currentDraft || []);
      const savedLayersJSON = JSON.stringify(layersBeingSaved);

      if (currentLayersJSON === savedLayersJSON) {
        // Safe to update - no changes made during save
        set((state) => ({
          components: state.components.map((c) => (c.id === componentId ? updatedComponent : c)),
          isSaving: false,
        }));

        // Record version for undo/redo only if layers match what we saved
        import('@/lib/version-tracking').then(({ recordVersionViaApi }) => {
          recordVersionViaApi('component', componentId, layersBeingSaved);
        }).catch((err) => {
          console.error('Failed to record component version:', err);
        });
      } else {
        // Layers changed during save - keep local changes
        set((state) => ({
          components: state.components.map((c) => (c.id === componentId ? updatedComponent : c)),
          isSaving: false,
        }));

        // DO NOT record version - the saved state is stale
        // The new state will trigger another auto-save which will record its own version
      }

      // Trigger component sync across all pages
      // This will be handled by usePagesStore.updateComponentOnLayers
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('componentUpdated', {
          detail: { componentId, layers: draftLayers }
        }));
      }

      // Regenerate CSS to include updated component classes
      try {
        const { generateAndSaveCSS } = await import('@/lib/client/cssGenerator');
        const { usePagesStore } = await import('./usePagesStore');

        // Collect layers from ALL pages
        const allLayers: Layer[] = [];
        const allDrafts = usePagesStore.getState().draftsByPageId;
        Object.values(allDrafts).forEach((pageDraft) => {
          if (pageDraft.layers) {
            allLayers.push(...pageDraft.layers);
          }
        });

        await generateAndSaveCSS(allLayers);
      } catch (cssError) {
        console.error('Failed to generate CSS after component save:', cssError);
        // Don't fail the save operation if CSS generation fails
      }
    } catch (error) {
      console.error('Failed to save component draft:', error);
      set({ isSaving: false });
    }
  },

  // Clear component draft from memory
  clearComponentDraft: (componentId) => {
    set((state) => {
      const newDrafts = { ...state.componentDrafts };
      delete newDrafts[componentId];

      const newTimeouts = { ...state.saveTimeouts };
      if (newTimeouts[componentId]) {
        clearTimeout(newTimeouts[componentId]);
        delete newTimeouts[componentId];
      }

      return {
        componentDrafts: newDrafts,
        saveTimeouts: newTimeouts,
      };
    });
  },

  // Rename a component (convenience method)
  renameComponent: async (id, newName) => {
    await get().updateComponent(id, { name: newName });
  },

  // Get component by ID (convenience method)
  getComponentById: (id) => {
    return get().components.find((c) => c.id === id);
  },

  /**
   * Create a component from a layer in a component draft
   */
  createComponentFromLayer: async (componentId, layerId, componentName) => {
    const { componentDrafts } = get();
    const layers = componentDrafts[componentId];
    if (!layers) return null;

    const layerToCopy = findLayerById(layers, layerId);
    if (!layerToCopy) return null;

    const newComponent = await createComponentViaApi(componentName, [layerToCopy]);
    if (!newComponent) return null;

    // Add to local store
    set((state) => ({
      components: [newComponent, ...state.components],
    }));

    // Replace layer with component instance
    const newLayers = replaceLayerWithComponentInstance(layers, layerId, newComponent.id);
    get().updateComponentDraft(componentId, newLayers);

    return newComponent.id;
  },

  /**
   * Restore required components for undo operations
   * Checks if components exist, restores them if deleted
   */
  restoreComponents: async (componentIds) => {
    const { loadComponents } = get();
    const restoredIds: string[] = [];

    for (const componentId of componentIds) {
      try {
        // Check if component exists/is deleted
        const response = await fetch(`/ycode/api/components/${componentId}`);
        const result = await response.json();

        // If component doesn't exist or is deleted, restore it
        if (!result.data || result.error) {
          console.log(`[Store] Restoring required component: ${componentId}`);

          // Restore the component via API
          const restoreResponse = await fetch(`/ycode/api/components/${componentId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'restore' }),
          });

          const restoreResult = await restoreResponse.json();

          if (restoreResult.data) {
            restoredIds.push(componentId);
            console.log(`[Store] Successfully restored component: ${componentId}`);
          }
        }
      } catch (error) {
        console.error(`[Store] Failed to check/restore required component ${componentId}:`, error);
        // Continue with other components
      }
    }

    // Reload all components if any were restored
    if (restoredIds.length > 0) {
      await loadComponents();
    }

    return restoredIds;
  },

  // Add a text variable to a component
  addTextVariable: async (componentId, name) => {
    const component = get().getComponentById(componentId);
    if (!component) return null;

    const variableId = generateId('cpv'); // CPV = Component Variable
    const newVariable = { id: variableId, name };
    const updatedVariables = [...(component.variables || []), newVariable];

    try {
      const response = await fetch(`/ycode/api/components/${componentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variables: updatedVariables }),
      });

      const result = await response.json();
      if (result.error) {
        console.error('Failed to add text variable:', result.error);
        return null;
      }

      // Update local state
      set((state) => ({
        components: state.components.map((c) =>
          c.id === componentId ? { ...c, variables: updatedVariables } : c
        ),
      }));

      return variableId;
    } catch (error) {
      console.error('Failed to add text variable:', error);
      return null;
    }
  },

  // Add an image variable to a component
  addImageVariable: async (componentId, name) => {
    const component = get().getComponentById(componentId);
    if (!component) return null;

    const variableId = generateId('cpv'); // CPV = Component Variable
    const newVariable = { id: variableId, name, type: 'image' as const };
    const updatedVariables = [...(component.variables || []), newVariable];

    try {
      const response = await fetch(`/ycode/api/components/${componentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variables: updatedVariables }),
      });

      const result = await response.json();
      if (result.error) {
        console.error('Failed to add image variable:', result.error);
        return null;
      }

      // Update local state
      set((state) => ({
        components: state.components.map((c) =>
          c.id === componentId ? { ...c, variables: updatedVariables } : c
        ),
      }));

      return variableId;
    } catch (error) {
      console.error('Failed to add image variable:', error);
      return null;
    }
  },

  // Update a text variable's name and/or default value
  updateTextVariable: async (componentId, variableId, updates) => {
    const component = get().getComponentById(componentId);
    if (!component) return;

    const updatedVariables = (component.variables || []).map((v) =>
      v.id === variableId ? { ...v, ...updates } : v
    );

    try {
      const response = await fetch(`/ycode/api/components/${componentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variables: updatedVariables }),
      });

      const result = await response.json();
      if (result.error) {
        console.error('Failed to update text variable:', result.error);
        return;
      }

      set((state) => ({
        components: state.components.map((c) =>
          c.id === componentId ? { ...c, variables: updatedVariables } : c
        ),
      }));
    } catch (error) {
      console.error('Failed to update text variable:', error);
    }
  },

  // Delete a text variable
  deleteTextVariable: async (componentId, variableId) => {
    const component = get().getComponentById(componentId);
    if (!component) return;

    const updatedVariables = (component.variables || []).filter((v) => v.id !== variableId);

    // Helper to unlink layers from the deleted variable
    const unlinkLayersFromVariable = (layers: Layer[]): Layer[] => {
      return layers.map(layer => {
        const updatedLayer = { ...layer };

        // Unlink if this layer's text variable references the deleted variable
        const textVar = layer.variables?.text;
        if (textVar?.id === variableId) {
          const { id: _, ...textWithoutId } = textVar;
          updatedLayer.variables = {
            ...layer.variables,
            text: textWithoutId as typeof textVar,
          };
        }

        // Recursively process children
        if (layer.children && layer.children.length > 0) {
          updatedLayer.children = unlinkLayersFromVariable(layer.children);
        }

        return updatedLayer;
      });
    };

    // Clean up component's own layers
    const updatedLayers = component.layers ? unlinkLayersFromVariable(component.layers) : [];

    try {
      const response = await fetch(`/ycode/api/components/${componentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variables: updatedVariables,
          layers: updatedLayers,
        }),
      });

      const result = await response.json();
      if (result.error) {
        console.error('Failed to delete text variable:', result.error);
        return;
      }

      // Update local state
      set((state) => ({
        components: state.components.map((c) =>
          c.id === componentId ? { ...c, variables: updatedVariables, layers: updatedLayers } : c
        ),
        // Also update draft if it exists
        componentDrafts: {
          ...state.componentDrafts,
          ...(state.componentDrafts[componentId] ? {
            [componentId]: unlinkLayersFromVariable(state.componentDrafts[componentId])
          } : {}),
        },
      }));

      // Clean up orphaned overrides from page instances
      // Import pages store and clean up componentOverrides that reference the deleted variable
      const { usePagesStore } = await import('./usePagesStore');
      const pagesState = usePagesStore.getState();

      // Helper to clean overrides from layers
      const cleanOverridesFromLayers = (layers: Layer[]): Layer[] => {
        return layers.map(layer => {
          const updatedLayer = { ...layer };

          // If this is an instance of our component, clean up the override
          if (layer.componentId === componentId && layer.componentOverrides?.text?.[variableId] !== undefined) {
            const { [variableId]: _, ...remainingOverrides } = layer.componentOverrides.text;
            updatedLayer.componentOverrides = {
              ...layer.componentOverrides,
              text: Object.keys(remainingOverrides).length > 0 ? remainingOverrides : undefined,
            };
            // Clean up empty componentOverrides
            if (!updatedLayer.componentOverrides?.text) {
              delete updatedLayer.componentOverrides;
            }
          }

          // Recursively process children
          if (layer.children && layer.children.length > 0) {
            updatedLayer.children = cleanOverridesFromLayers(layer.children);
          }

          return updatedLayer;
        });
      };

      // Update all page drafts that might have instances of this component
      Object.entries(pagesState.draftsByPageId).forEach(([pageId, draft]) => {
        if (draft && draft.layers) {
          const cleanedLayers = cleanOverridesFromLayers(draft.layers);
          // Only update if something changed (simple stringify comparison)
          if (JSON.stringify(cleanedLayers) !== JSON.stringify(draft.layers)) {
            pagesState.setDraftLayers(pageId, cleanedLayers);
          }
        }
      });
    } catch (error) {
      console.error('Failed to delete text variable:', error);
    }
  },

  // Error management
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
  setSaving: (value) => set({ isSaving: value }),
}));
