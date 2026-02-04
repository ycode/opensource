/**
 * Settings Store
 *
 * Global state management for application settings
 * Settings are loaded once at startup and can be updated individually
 */

import { create } from 'zustand';
import { settingsApi } from '@/lib/api';
import type { Setting } from '@/types';

interface SettingsState {
  settings: Setting[];
  settingsByKey: Record<string, any>;
  isLoading: boolean;
  error: string | null;
}

interface SettingsActions {
  // Data loading
  setSettings: (settings: Setting[]) => void;

  // Getters
  getSettingByKey: (key: string) => any | null;

  // Update individual setting (local state only)
  updateSetting: (key: string, value: any) => void;

  // Save settings to server and update local state
  saveSettings: (settings: Record<string, any>) => Promise<boolean>;

  // State management
  setError: (error: string | null) => void;
  clearError: () => void;
}

type SettingsStore = SettingsState & SettingsActions;

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  // Initial state
  settings: [],
  settingsByKey: {},
  isLoading: false,
  error: null,

  // Set settings (used by unified init)
  setSettings: (settings) => {
    const settingsByKey: Record<string, any> = {};
    settings.forEach((setting) => {
      settingsByKey[setting.key] = setting.value;
    });
    set({ settings, settingsByKey });
  },

  // Get a setting value by key
  getSettingByKey: (key) => {
    const { settingsByKey } = get();
    return settingsByKey[key] ?? null;
  },

  // Update a single setting in the store (local state)
  updateSetting: (key, value) => {
    set((state) => {
      const updatedSettings = state.settings.map((setting) =>
        setting.key === key
          ? { ...setting, value, updated_at: new Date().toISOString() }
          : setting
      );

      // If the setting doesn't exist, add it
      const exists = state.settings.some((s) => s.key === key);
      if (!exists) {
        updatedSettings.push({
          id: `temp-${key}`,
          key,
          value,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      const settingsByKey = { ...state.settingsByKey, [key]: value };

      return { settings: updatedSettings, settingsByKey };
    });
  },

  // Save settings to server and update local state
  saveSettings: async (settings) => {
    try {
      const response = await settingsApi.batchUpdate(settings);
      if (response.error) {
        set({ error: response.error });
        return false;
      }
      // Update local state for all settings
      Object.entries(settings).forEach(([key, value]) => {
        get().updateSetting(key, value);
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save settings';
      set({ error: message });
      return false;
    }
  },

  // Error management
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
}));
