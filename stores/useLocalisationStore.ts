/**
 * Localisation Store
 *
 * Global state management for locales/languages
 * Handles CRUD operations and default locale management
 */

import { create } from 'zustand';
import type { Locale, CreateLocaleData, UpdateLocaleData } from '@/types';

/**
 * Sort locales alphabetically by label
 */
function sortLocales(locales: Locale[]): Locale[] {
  return [...locales].sort((a, b) => a.label.localeCompare(b.label));
}

interface LocalisationState {
  locales: Locale[];
  isLoading: boolean;
  error: string | null;
  defaultLocale: Locale | null;
  selectedLocaleId: string | null;
}

interface LocalisationActions {
  // Data loading
  setLocales: (locales: Locale[]) => void;
  loadLocales: () => Promise<void>;

  // CRUD operations
  createLocale: (data: CreateLocaleData) => Promise<Locale | null>;
  updateLocale: (id: string, updates: UpdateLocaleData) => Promise<void>;
  deleteLocale: (id: string) => Promise<void>;

  // Default locale management
  setDefaultLocale: (id: string) => Promise<void>;
  getDefaultLocale: () => Locale | null;

  // Selected locale management
  setSelectedLocaleId: (id: string | null) => void;
  getSelectedLocale: () => Locale | null;

  // Convenience actions
  getLocaleById: (id: string) => Locale | undefined;
  getLocaleByCode: (code: string) => Locale | undefined;

  // State management
  setError: (error: string | null) => void;
  clearError: () => void;
}

type LocalisationStore = LocalisationState & LocalisationActions;

export const useLocalisationStore = create<LocalisationStore>((set, get) => ({
  // Initial state
  locales: [],
  isLoading: false,
  error: null,
  defaultLocale: null,
  selectedLocaleId: null,

  // Set locales (used by unified init)
  setLocales: (locales) => {
    const sortedLocales = sortLocales(locales);
    const defaultLocale = sortedLocales.find(l => l.is_default) || null;
    const { selectedLocaleId } = get();

    // Auto-select first locale if none selected and we have locales
    const newSelectedLocaleId = selectedLocaleId || (sortedLocales.length > 0 ? sortedLocales[0].id : null);

    set({ locales: sortedLocales, defaultLocale, selectedLocaleId: newSelectedLocaleId });
  },

  // Load all locales
  loadLocales: async () => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch('/api/locales');
      const result = await response.json();

      if (result.error) {
        set({ error: result.error, isLoading: false });
        return;
      }

      const locales = sortLocales(result.data || []);
      const defaultLocale = locales.find((l: Locale) => l.is_default) || null;
      const { selectedLocaleId } = get();
      const newSelectedLocaleId = selectedLocaleId || (locales.length > 0 ? locales[0].id : null);

      set({ locales, defaultLocale, selectedLocaleId: newSelectedLocaleId, isLoading: false });
    } catch (error) {
      console.error('Failed to load locales:', error);
      set({ error: 'Failed to load locales', isLoading: false });
    }
  },

  // Create a new locale
  createLocale: async (data) => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch('/api/locales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.error) {
        set({ error: result.error, isLoading: false });
        return null;
      }

      const newLocale = result.data;

      set((state) => {
        const locales = sortLocales([newLocale, ...state.locales]);
        const defaultLocale = newLocale.is_default ? newLocale : state.defaultLocale;
        const selectedLocaleId = state.selectedLocaleId || newLocale.id;

        return {
          locales,
          defaultLocale,
          selectedLocaleId,
          isLoading: false,
        };
      });

      return newLocale;
    } catch (error) {
      console.error('Failed to create locale:', error);
      set({ error: 'Failed to create locale', isLoading: false });
      return null;
    }
  },

  // Update a locale
  updateLocale: async (id, updates) => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`/api/locales/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      const result = await response.json();

      if (result.error) {
        set({ error: result.error, isLoading: false });
        return;
      }

      const updatedLocale = result.data;

      set((state) => {
        const locales = sortLocales(state.locales.map((l) => (l.id === id ? updatedLocale : l)));

        // Update defaultLocale if this locale is now default or was default before
        let defaultLocale = state.defaultLocale;
        if (updatedLocale.is_default) {
          defaultLocale = updatedLocale;
        } else if (state.defaultLocale?.id === id && !updatedLocale.is_default) {
          defaultLocale = locales.find(l => l.is_default) || null;
        }

        return {
          locales,
          defaultLocale,
          isLoading: false,
        };
      });
    } catch (error) {
      console.error('Failed to update locale:', error);
      set({ error: 'Failed to update locale', isLoading: false });
    }
  },

  // Delete a locale
  deleteLocale: async (id) => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`/api/locales/${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.error) {
        set({ error: result.error, isLoading: false });
        return;
      }

      set((state) => {
        const locales = state.locales.filter((l) => l.id !== id);
        const defaultLocale = state.defaultLocale?.id === id
          ? locales.find(l => l.is_default) || null
          : state.defaultLocale;

        // If deleted locale was selected, select first remaining locale
        const selectedLocaleId = state.selectedLocaleId === id
          ? (locales.length > 0 ? locales[0].id : null)
          : state.selectedLocaleId;

        return {
          locales,
          defaultLocale,
          selectedLocaleId,
          isLoading: false,
        };
      });
    } catch (error) {
      console.error('Failed to delete locale:', error);
      set({ error: 'Failed to delete locale', isLoading: false });
    }
  },

  // Set a locale as default
  setDefaultLocale: async (id) => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`/api/locales/${id}/default`, {
        method: 'POST',
      });

      const result = await response.json();

      if (result.error) {
        set({ error: result.error, isLoading: false });
        return;
      }

      const updatedLocale = result.data;

      set((state) => ({
        locales: sortLocales(state.locales.map((l) => ({
          ...l,
          is_default: l.id === id,
        }))),
        defaultLocale: updatedLocale,
        isLoading: false,
      }));
    } catch (error) {
      console.error('Failed to set default locale:', error);
      set({ error: 'Failed to set default locale', isLoading: false });
    }
  },

  // Get default locale
  getDefaultLocale: () => {
    return get().defaultLocale;
  },

  // Set selected locale
  setSelectedLocaleId: (id) => {
    set({ selectedLocaleId: id });
  },

  // Get selected locale
  getSelectedLocale: () => {
    const { selectedLocaleId, locales } = get();
    if (!selectedLocaleId) return null;
    return locales.find((l) => l.id === selectedLocaleId) || null;
  },

  // Get locale by ID (convenience method)
  getLocaleById: (id) => {
    return get().locales.find((l) => l.id === id);
  },

  // Get locale by code (convenience method)
  getLocaleByCode: (code) => {
    return get().locales.find((l) => l.code === code);
  },

  // Error management
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
}));
