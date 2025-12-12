/**
 * Localisation Store
 *
 * Global state management for locales/languages
 * Handles CRUD operations and default locale management
 */

import { create } from 'zustand';
import { getTranslatableKey } from '@/lib/localisation-utils';
import type { Locale, CreateLocaleData, UpdateLocaleData, Translation, CreateTranslationData, UpdateTranslationData } from '@/types';

/**
 * Sort locales: default first, then alphabetically by label
 */
function sortLocales(locales: Locale[]): Locale[] {
  return [...locales].sort((a, b) => {
    // Default locale first
    if (a.is_default && !b.is_default) return -1;
    if (!a.is_default && b.is_default) return 1;
    // Then sort alphabetically by label
    return a.label.localeCompare(b.label);
  });
}

interface LoadingState {
  load: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
  setDefault: boolean;
  loadTranslations: boolean;
  createTranslation: boolean;
  updateTranslation: boolean;
  deleteTranslation: boolean;
}

interface LocalisationState {
  locales: Locale[];
  isLoading: LoadingState;
  error: string | null;
  defaultLocale: Locale | null;
  selectedLocaleId: string | null;
  translations: Record<string, Record<string, Translation>>; // Keyed by `locale_id` (UUID), then by `translatable key`
}

interface LocalisationActions {
  // Locale data loading
  setLocales: (locales: Locale[]) => void;
  loadLocales: () => Promise<void>;

  // Locale CRUD
  createLocale: (data: CreateLocaleData) => Promise<Locale | null>;
  updateLocale: (id: string, updates: UpdateLocaleData) => Promise<void>;
  deleteLocale: (id: string) => Promise<void>;

  // Locale selection & defaults
  setSelectedLocaleId: (id: string | null) => void;
  getSelectedLocale: () => Locale | null;
  setDefaultLocale: (id: string) => Promise<void>;
  getDefaultLocale: () => Locale | null;

  // Locale queries
  getLocaleById: (id: string) => Locale | undefined;
  getLocaleByCode: (code: string) => Locale | undefined;

  // Translation data loading
  loadTranslations: (localeId: string) => Promise<void>;
  clearTranslations: (localeId?: string) => void;

  // Translation CRUD
  createTranslation: (data: CreateTranslationData) => Promise<Translation | null>;
  updateTranslation: (translation: Translation | { locale_id: string; source_type: string; source_id: string; content_key: string }, updates: UpdateTranslationData) => Promise<void>;
  deleteTranslation: (translation: Translation | { locale_id: string; source_type: string; source_id: string; content_key: string }) => Promise<void>;
  upsertTranslations: (translations: CreateTranslationData[]) => Promise<void>;

  // Optimistic translation updates (immediate store updates, no API calls)
  optimisticallyUpdateTranslationValue: (localeId: string, key: string, contentValue: string) => void;

  // Translation queries
  getTranslation: (localeId: string, translation: Translation | { source_type: string; source_id: string; content_key: string }) => Translation | undefined;
  getTranslationByKey: (localeId: string, key: string) => Translation | undefined;
  getTranslationsBySource: (localeId: string, sourceType: string, sourceId: string) => Translation[];

  // Error management
  setError: (error: string | null) => void;
  clearError: () => void;
}

type LocalisationStore = LocalisationState & LocalisationActions;

const initialLoadingState: LoadingState = {
  load: false,
  create: false,
  update: false,
  delete: false,
  setDefault: false,
  loadTranslations: false,
  createTranslation: false,
  updateTranslation: false,
  deleteTranslation: false,
};

export const useLocalisationStore = create<LocalisationStore>((set, get) => ({
  // Initial state
  locales: [],
  isLoading: initialLoadingState,
  error: null,
  defaultLocale: null,
  selectedLocaleId: null,
  translations: {},

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
    set({ isLoading: { ...initialLoadingState, load: true }, error: null });

    try {
      const response = await fetch('/api/locales');
      const result = await response.json();

      if (result.error) {
        set({ error: result.error, isLoading: initialLoadingState });
        return;
      }

      const locales = sortLocales(result.data || []);
      const defaultLocale = locales.find((l: Locale) => l.is_default) || null;
      const { selectedLocaleId } = get();
      const newSelectedLocaleId = selectedLocaleId || (locales.length > 0 ? locales[0].id : null);

      set({ locales, defaultLocale, selectedLocaleId: newSelectedLocaleId, isLoading: initialLoadingState });
    } catch (error) {
      console.error('Failed to load locales:', error);
      set({ error: 'Failed to load locales', isLoading: initialLoadingState });
    }
  },

  // Create a new locale
  createLocale: async (data) => {
    set({ isLoading: { ...initialLoadingState, create: true }, error: null });

    try {
      const response = await fetch('/api/locales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.error) {
        set({ error: result.error, isLoading: initialLoadingState });
        return null;
      }

      const { locale, locales } = result.data;
      const sortedLocales = sortLocales(locales);
      const defaultLocale = sortedLocales.find(l => l.is_default) || null;
      const { selectedLocaleId } = get();
      const newSelectedLocaleId = selectedLocaleId || (sortedLocales.length > 0 ? sortedLocales[0].id : null);

      set({
        locales: sortedLocales,
        defaultLocale,
        selectedLocaleId: newSelectedLocaleId,
        isLoading: initialLoadingState,
      });

      return locale;
    } catch (error) {
      console.error('Failed to create locale:', error);
      set({ error: 'Failed to create locale', isLoading: initialLoadingState });
      return null;
    }
  },

  // Update a locale
  updateLocale: async (id, updates) => {
    set({ isLoading: { ...initialLoadingState, update: true }, error: null });

    try {
      const response = await fetch(`/api/locales/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      const result = await response.json();

      if (result.error) {
        set({ error: result.error, isLoading: initialLoadingState });
        return;
      }

      const { locale, locales } = result.data;
      const sortedLocales = sortLocales(locales);
      const defaultLocale = sortedLocales.find(l => l.is_default) || null;

      set({
        locales: sortedLocales,
        defaultLocale,
        isLoading: initialLoadingState,
      });
    } catch (error) {
      console.error('Failed to update locale:', error);
      set({ error: 'Failed to update locale', isLoading: initialLoadingState });
    }
  },

  // Delete a locale
  deleteLocale: async (id) => {
    set({ isLoading: { ...initialLoadingState, delete: true }, error: null });

    try {
      const response = await fetch(`/api/locales/${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.error) {
        set({ error: result.error, isLoading: initialLoadingState });
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
          isLoading: initialLoadingState,
        };
      });
    } catch (error) {
      console.error('Failed to delete locale:', error);
      set({ error: 'Failed to delete locale', isLoading: initialLoadingState });
    }
  },

  // Set a locale as default
  setDefaultLocale: async (id) => {
    set({ isLoading: { ...initialLoadingState, setDefault: true }, error: null });

    try {
      const response = await fetch(`/api/locales/${id}/default`, {
        method: 'POST',
      });

      const result = await response.json();

      if (result.error) {
        set({ error: result.error, isLoading: initialLoadingState });
        return;
      }

      const updatedLocale = result.data;

      set((state) => ({
        locales: sortLocales(state.locales.map((l) => ({
          ...l,
          is_default: l.id === id,
        }))),
        defaultLocale: updatedLocale,
        isLoading: initialLoadingState,
      }));
    } catch (error) {
      console.error('Failed to set default locale:', error);
      set({ error: 'Failed to set default locale', isLoading: initialLoadingState });
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

  // Load translations for a locale
  loadTranslations: async (localeId) => {
    set({ isLoading: { ...initialLoadingState, loadTranslations: true }, error: null });

    try {
      const response = await fetch(`/api/translations?locale_id=${localeId}&is_published=false`);
      const result = await response.json();

      if (result.error) {
        set({ error: result.error, isLoading: initialLoadingState });
        return;
      }

      const translations: Translation[] = result.data || [];
      const translationsMap: Record<string, Translation> = {};

      for (const translation of translations) {
        const key = getTranslatableKey(translation);
        translationsMap[key] = translation;
      }

      set((state) => ({
        translations: { ...state.translations, [localeId]: translationsMap },
        isLoading: initialLoadingState,
      }));
    } catch (error) {
      console.error('Failed to load translations:', error);
      set({ error: 'Failed to load translations', isLoading: initialLoadingState });
    }
  },

  // Get translation by translation object or key parts
  getTranslation: (localeId, translation) => {
    const key = getTranslatableKey(translation);
    return get().translations[localeId]?.[key];
  },

  // Get translation by translatable key string
  getTranslationByKey: (localeId, key) => {
    return get().translations[localeId]?.[key];
  },

  // Get all translations for a specific source
  getTranslationsBySource: (localeId, sourceType, sourceId) => {
    const localeTranslations = get().translations[localeId];
    if (!localeTranslations) return [];
    return Object.values(localeTranslations).filter(
      (t) => t.source_type === sourceType && t.source_id === sourceId
    );
  },

  // Create a new translation
  createTranslation: async (data) => {
    const key = getTranslatableKey(data);
    const localeId = data.locale_id;

    // Optimistically create translation in store
    const optimisticTranslation: Translation = {
      id: `temp-${Date.now()}`,
      locale_id: localeId,
      source_type: data.source_type,
      source_id: data.source_id,
      content_key: data.content_key,
      content_type: data.content_type,
      content_value: data.content_value,
      is_published: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };

    set((state) => ({
      translations: {
        ...state.translations,
        [localeId]: {
          ...(state.translations[localeId] || {}),
          [key]: optimisticTranslation,
        },
      },
      isLoading: { ...initialLoadingState, createTranslation: true },
      error: null,
    }));

    try {
      const response = await fetch('/api/translations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.error) {
        // Revert optimistic update on error
        set((state) => {
          const localeTranslations = state.translations[localeId];
          if (!localeTranslations) {
            return { error: result.error, isLoading: initialLoadingState };
          }

          const { [key]: _, ...restTranslations } = localeTranslations;
          return {
            translations: {
              ...state.translations,
              [localeId]: restTranslations,
            },
            error: result.error,
            isLoading: initialLoadingState,
          };
        });
        return null;
      }

      const translation: Translation = result.data;
      const finalKey = getTranslatableKey(translation);
      const finalLocaleId = translation.locale_id;

      // Replace optimistic translation with real one
      set((state) => ({
        translations: {
          ...state.translations,
          [finalLocaleId]: {
            ...(state.translations[finalLocaleId] || {}),
            [finalKey]: translation,
          },
        },
        isLoading: initialLoadingState,
      }));

      return translation;
    } catch (error) {
      // Revert optimistic update on error
      set((state) => {
        const localeTranslations = state.translations[localeId];
        if (!localeTranslations) {
          return { error: 'Failed to create translation', isLoading: initialLoadingState };
        }

        const { [key]: _, ...restTranslations } = localeTranslations;
        return {
          translations: {
            ...state.translations,
            [localeId]: restTranslations,
          },
          error: 'Failed to create translation',
          isLoading: initialLoadingState,
        };
      });
      return null;
    }
  },

  // Update a translation
  updateTranslation: async (translation, updates) => {
    const localeId = translation.locale_id;
    const key = getTranslatableKey(translation);
    const existingTranslation = get().translations[localeId]?.[key];

    if (!existingTranslation) {
      set({ error: 'Translation not found', isLoading: initialLoadingState });
      return;
    }

    // Optimistically update translation in store
    if (updates.content_value !== undefined) {
      set((state) => {
        const localeTranslations = state.translations[localeId] || {};
        const existingTranslation = localeTranslations[key];

        if (existingTranslation) {
          return {
            translations: {
              ...state.translations,
              [localeId]: {
                ...localeTranslations,
                [key]: {
                  ...existingTranslation,
                  content_value: updates.content_value!,
                },
              },
            },
          };
        }

        return state;
      });
    }

    set({ isLoading: { ...initialLoadingState, updateTranslation: true }, error: null });

    try {
      const response = await fetch(`/api/translations/${existingTranslation.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      const result = await response.json();

      if (result.error) {
        // Revert optimistic update on error
        if (updates.content_value !== undefined && existingTranslation) {
          set((state) => {
            const localeTranslations = state.translations[localeId] || {};
            return {
              translations: {
                ...state.translations,
                [localeId]: {
                  ...localeTranslations,
                  [key]: existingTranslation,
                },
              },
              error: result.error,
              isLoading: initialLoadingState,
            };
          });
          return;
        }
        set({ error: result.error, isLoading: initialLoadingState });
        return;
      }

      const updatedTranslation: Translation = result.data;
      const updatedKey = getTranslatableKey(updatedTranslation);
      const updatedLocaleId = updatedTranslation.locale_id;

      // Update with server response (may have additional fields updated)
      set((state) => ({
        translations: {
          ...state.translations,
          [updatedLocaleId]: {
            ...(state.translations[updatedLocaleId] || {}),
            [updatedKey]: updatedTranslation,
          },
        },
        isLoading: initialLoadingState,
      }));
    } catch (error) {
      // Revert optimistic update on error
      if (updates.content_value !== undefined && existingTranslation) {
        set((state) => {
          const localeTranslations = state.translations[localeId] || {};
          return {
            translations: {
              ...state.translations,
              [localeId]: {
                ...localeTranslations,
                [key]: existingTranslation,
              },
            },
            error: 'Failed to update translation',
            isLoading: initialLoadingState,
          };
        });
        return;
      }
      console.error('Failed to update translation:', error);
      set({ error: 'Failed to update translation', isLoading: initialLoadingState });
    }
  },

  // Delete a translation
  deleteTranslation: async (translation) => {
    set({ isLoading: { ...initialLoadingState, deleteTranslation: true }, error: null });

    const localeId = translation.locale_id;
    const key = getTranslatableKey(translation);
    const existingTranslation = get().translations[localeId]?.[key];

    if (!existingTranslation) {
      set({ error: 'Translation not found', isLoading: initialLoadingState });
      return;
    }

    try {
      const response = await fetch(`/api/translations/${existingTranslation.id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.error) {
        set({ error: result.error, isLoading: initialLoadingState });
        return;
      }

      set((state) => {
        const localeTranslations = state.translations[localeId];
        if (!localeTranslations) {
          return { isLoading: initialLoadingState };
        }

        const { [key]: _, ...restTranslations } = localeTranslations;
        return {
          translations: {
            ...state.translations,
            [localeId]: restTranslations,
          },
          isLoading: initialLoadingState,
        };
      });
    } catch (error) {
      console.error('Failed to delete translation:', error);
      set({ error: 'Failed to delete translation', isLoading: initialLoadingState });
    }
  },

  // Upsert multiple translations (create or update)
  upsertTranslations: async (translationsData) => {
    set({ isLoading: { ...initialLoadingState, createTranslation: true }, error: null });

    try {
      const response = await fetch('/api/translations/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ translations: translationsData }),
      });

      const result = await response.json();

      if (result.error) {
        set({ error: result.error, isLoading: initialLoadingState });
        return;
      }

      const translations: Translation[] = result.data || [];
      const updatedTranslations = { ...get().translations };

      for (const translation of translations) {
        const key = getTranslatableKey(translation);
        const localeId = translation.locale_id;

        if (!updatedTranslations[localeId]) {
          updatedTranslations[localeId] = {};
        }

        updatedTranslations[localeId][key] = translation;
      }

      set({ translations: updatedTranslations, isLoading: initialLoadingState });
    } catch (error) {
      console.error('Failed to upsert translations:', error);
      set({ error: 'Failed to upsert translations', isLoading: initialLoadingState });
    }
  },

  // Optimistically update translation value in store (no API call)
  optimisticallyUpdateTranslationValue: (localeId, key, contentValue) => {
    set((state) => {
      const localeTranslations = state.translations[localeId] || {};
      const existingTranslation = localeTranslations[key];

      if (existingTranslation) {
        // Update existing translation
        return {
          translations: {
            ...state.translations,
            [localeId]: {
              ...localeTranslations,
              [key]: {
                ...existingTranslation,
                content_value: contentValue,
              },
            },
          },
        };
      }

      return state;
    });
  },

  // Clear all translations from state (optionally for a specific locale)
  clearTranslations: (localeId) => {
    if (localeId) {
      set((state) => {
        const { [localeId]: _, ...restTranslations } = state.translations;
        return { translations: restTranslations };
      });
    } else {
      set({ translations: {} });
    }
  },

  // Error management
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
}));
