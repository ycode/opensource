/**
 * Components Store
 * 
 * Global state management for components
 * Components are reusable layer trees stored globally
 */

import { create } from 'zustand';
import type { Component, Layer } from '@/types';

interface ComponentsState {
  components: Component[];
  isLoading: boolean;
  error: string | null;
  componentDrafts: Record<string, Layer[]>;
  isSaving: boolean;
  saveTimeouts: Record<string, NodeJS.Timeout>;
}

interface ComponentsActions {
  // Data loading
  loadComponents: () => Promise<void>;
  
  // CRUD operations
  createComponent: (name: string, layers: Layer[]) => Promise<Component | null>;
  updateComponent: (id: string, updates: Partial<Pick<Component, 'name' | 'layers'>>) => Promise<void>;
  deleteComponent: (id: string) => Promise<void>;
  
  // Draft management (for editing mode)
  loadComponentDraft: (componentId: string) => void;
  updateComponentDraft: (componentId: string, layers: Layer[]) => void;
  saveComponentDraft: (componentId: string) => Promise<void>;
  clearComponentDraft: (componentId: string) => void;
  
  // Convenience actions
  renameComponent: (id: string, newName: string) => Promise<void>;
  getComponentById: (id: string) => Component | undefined;
  
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
  
  // Load all components
  loadComponents: async () => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await fetch('/api/components');
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
      const response = await fetch('/api/components', {
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
      const response = await fetch(`/api/components/${id}`, {
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
  
  // Delete a component
  deleteComponent: async (id) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await fetch(`/api/components/${id}`, {
        method: 'DELETE',
      });
      
      const result = await response.json();
      
      if (result.error) {
        set({ error: result.error, isLoading: false });
        return;
      }
      
      set((state) => ({
        components: state.components.filter((c) => c.id !== id),
        isLoading: false,
      }));
    } catch (error) {
      console.error('Failed to delete component:', error);
      set({ error: 'Failed to delete component', isLoading: false });
    }
  },
  
  // Load component into draft for editing
  loadComponentDraft: (componentId) => {
    const component = get().components.find((c) => c.id === componentId);
    if (component) {
      set((state) => ({
        componentDrafts: {
          ...state.componentDrafts,
          [componentId]: JSON.parse(JSON.stringify(component.layers)), // Deep clone
        },
      }));
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
    
    set({ isSaving: true });
    
    try {
      const response = await fetch(`/api/components/${componentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layers: draftLayers }),
      });
      
      const result = await response.json();
      
      if (result.error) {
        console.error('Failed to save component draft:', result.error);
        set({ isSaving: false });
        return;
      }
      
      const updatedComponent = result.data;
      
      // Update the component in the store
      set((state) => ({
        components: state.components.map((c) => (c.id === componentId ? updatedComponent : c)),
        isSaving: false,
      }));
      
      // Trigger component sync across all pages
      // This will be handled by usePagesStore.updateComponentOnLayers
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('componentUpdated', {
          detail: { componentId, layers: draftLayers }
        }));
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
  
  // Error management
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
  setSaving: (value) => set({ isSaving: value }),
}));

