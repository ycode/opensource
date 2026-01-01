'use client';

import { create } from 'zustand';

interface MigrationState {
  migrationsComplete: boolean;
}

interface MigrationActions {
  setMigrationsComplete: (complete: boolean) => void;
}

type MigrationStore = MigrationState & MigrationActions;

export const useMigrationStore = create<MigrationStore>((set) => ({
  migrationsComplete: false,

  setMigrationsComplete: (complete) => set({ migrationsComplete: complete }),
}));
