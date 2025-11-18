/**
 * Setup Wizard Store
 * 
 * Manages state for the first-time setup wizard
 */

import { create } from 'zustand';
import type { SetupStep, SetupState, SupabaseConfig } from '@/types';

interface SetupStore extends SetupState {
  setStep: (step: SetupStep) => void;
  setSupabaseConfig: (config: SupabaseConfig) => void;
  setVercelToken: (token: string) => void;
  setAdminEmail: (email: string) => void;
  markComplete: () => void;
  reset: () => void;
}

export const useSetupStore = create<SetupStore>((set) => ({
  // Initial state
  currentStep: 'welcome',
  isComplete: false,

  // Actions
  setStep: (step) => set({ currentStep: step }),
  
  setSupabaseConfig: (config) => set({ supabaseConfig: config }),
  
  setVercelToken: (token) =>
    set((state) => ({
      vercelConfig: {
        ...state.vercelConfig,
        token,
        project_id: process.env.VERCEL_PROJECT_ID || '',
      },
    })),
  
  setAdminEmail: (email) => set({ adminEmail: email }),
  
  markComplete: () => set({ isComplete: true }),
  
  reset: () =>
    set({
      currentStep: 'welcome',
      supabaseConfig: undefined,
      vercelConfig: undefined,
      adminEmail: undefined,
      isComplete: false,
    }),
}));
