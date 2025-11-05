/**
 * Layer Styles Store
 * 
 * Global state management for layer styles
 * Layer styles are part of the page draft and get published when the page is published
 */

import { create } from 'zustand';
import type { LayerStyle } from '@/types';

interface LayerStylesState {
  styles: LayerStyle[];
  isLoading: boolean;
  error: string | null;
}

interface LayerStylesActions {
  // Data loading
  loadStyles: () => Promise<void>;
  
  // CRUD operations
  createStyle: (name: string, classes: string, design?: LayerStyle['design']) => Promise<LayerStyle | null>;
  updateStyle: (id: string, updates: Partial<Pick<LayerStyle, 'name' | 'classes' | 'design'>>) => Promise<void>;
  deleteStyle: (id: string) => Promise<void>;
  
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
    } catch (error) {
      console.error('Failed to update layer style:', error);
      set({ error: 'Failed to update style', isLoading: false });
    }
  },
  
  // Delete a style
  deleteStyle: async (id) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await fetch(`/api/layer-styles/${id}`, {
        method: 'DELETE',
      });
      
      const result = await response.json();
      
      if (result.error) {
        set({ error: result.error, isLoading: false });
        return;
      }
      
      set((state) => ({
        styles: state.styles.filter((s) => s.id !== id),
        isLoading: false,
      }));
    } catch (error) {
      console.error('Failed to delete layer style:', error);
      set({ error: 'Failed to delete style', isLoading: false });
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

