'use client';

import { create } from 'zustand';
import { updatesApi, type UpdateStatus, type UpdateDetails, type VersionInfo } from '../lib/updates';

interface UpdateState {
  status: UpdateStatus | null;
  details: UpdateDetails | null;
  versionInfo: VersionInfo | null;
  isLoading: boolean;
  error: string | null;
  lastChecked: string | null;
}

interface UpdateActions {
  checkForUpdates: () => Promise<void>;
  getStatus: () => Promise<void>;
  getDetails: () => Promise<void>;
  getVersionInfo: () => Promise<void>;
  clearError: () => void;
}

type UpdateStore = UpdateState & UpdateActions;

export const useUpdateStore = create<UpdateStore>((set, get) => ({
  status: null,
  details: null,
  versionInfo: null,
  isLoading: false,
  error: null,
  lastChecked: null,

  checkForUpdates: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await updatesApi.checkForUpdates();
      if (response.error) {
        set({ error: response.error, isLoading: false });
        return;
      }
      set({
        details: response.data!,
        lastChecked: new Date().toISOString(),
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to check for updates',
        isLoading: false,
      });
    }
  },

  getStatus: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await updatesApi.getStatus();
      if (response.error) {
        set({ error: response.error, isLoading: false });
        return;
      }
      set({
        status: response.data!,
        lastChecked: new Date().toISOString(),
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to get update status',
        isLoading: false,
      });
    }
  },

  getDetails: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await updatesApi.getDetails();
      if (response.error) {
        set({ error: response.error, isLoading: false });
        return;
      }
      set({
        details: response.data!,
        lastChecked: new Date().toISOString(),
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to get update details',
        isLoading: false,
      });
    }
  },

  getVersionInfo: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await updatesApi.getVersion();
      if (response.error) {
        set({ error: response.error, isLoading: false });
        return;
      }
      set({
        versionInfo: response.data!,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to get version info',
        isLoading: false,
      });
    }
  },

  clearError: () => set({ error: null }),
}));
