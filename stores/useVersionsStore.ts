/**
 * Versions Store
 *
 * Global state management for undo/redo functionality
 * Tracks version history and current position for each entity
 */

'use client';

import { create } from 'zustand';
import type { Version, VersionEntityType, VersionHistoryItem } from '@/types';

// Entity key for tracking (combines type and id)
type EntityKey = `${VersionEntityType}:${string}`;

interface UndoRedoState {
  // Stack of version IDs we can undo (most recent at end)
  undoStack: string[];
  // Stack of version IDs we can redo (most recent at end)
  redoStack: string[];
  // Whether we can undo/redo
  canUndo: boolean;
  canRedo: boolean;
  // Loading state for this entity
  isLoading: boolean;
}

interface VersionsState {
  // Undo/redo state per entity
  entityStates: Record<EntityKey, UndoRedoState>;
  // Cached version data
  versionCache: Record<string, Version>;
  // History summaries for UI display
  historySummaries: Record<EntityKey, VersionHistoryItem[]>;
  // Global loading state
  isLoading: boolean;
  // Error state
  error: string | null;
  // Session ID for grouping operations
  sessionId: string | null;
  // Whether undo/redo is in progress (prevents recursive tracking)
  isUndoRedoInProgress: boolean;
}

interface VersionsActions {
  // Initialize session
  initSession: () => string;
  getSessionId: () => string;

  // Entity state management
  initEntityState: (entityType: VersionEntityType, entityId: string) => void;
  getEntityState: (entityType: VersionEntityType, entityId: string) => UndoRedoState | null;

  // Load version history from server
  loadVersionHistory: (entityType: VersionEntityType, entityId: string, currentStateHash?: string) => Promise<void>;

  // Record a new version (called after save operations)
  recordVersion: (version: Version) => void;

  // Undo/Redo operations
  undo: (entityType: VersionEntityType, entityId: string) => Promise<Version | null>;
  redo: (entityType: VersionEntityType, entityId: string) => Promise<Version | null>;

  // Check undo/redo availability
  canUndo: (entityType: VersionEntityType, entityId: string) => boolean;
  canRedo: (entityType: VersionEntityType, entityId: string) => boolean;

  // Get version at specific position
  getVersionAtPosition: (entityType: VersionEntityType, entityId: string, position: number) => Promise<Version | null>;

  // Clear history for an entity
  clearHistory: (entityType: VersionEntityType, entityId: string) => void;

  // Clear redo stack when new change is made
  clearRedoStack: (entityType: VersionEntityType, entityId: string) => void;

  // Error management
  setError: (error: string | null) => void;
  clearError: () => void;

  // Undo/redo progress tracking
  setUndoRedoInProgress: (inProgress: boolean) => void;
}

type VersionsStore = VersionsState & VersionsActions;

function createEntityKey(entityType: VersionEntityType, entityId: string): EntityKey {
  return `${entityType}:${entityId}`;
}

function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export const useVersionsStore = create<VersionsStore>((set, get) => ({
  // Initial state
  entityStates: {},
  versionCache: {},
  historySummaries: {},
  isLoading: false,
  error: null,
  sessionId: null,
  isUndoRedoInProgress: false,

  // Initialize or get session ID
  initSession: () => {
    let { sessionId } = get();
    if (!sessionId) {
      sessionId = generateSessionId();
      set({ sessionId });
    }
    return sessionId;
  },

  getSessionId: () => {
    return get().sessionId || get().initSession();
  },

  // Initialize entity state
  initEntityState: (entityType, entityId) => {
    const key = createEntityKey(entityType, entityId);
    const { entityStates } = get();

    if (!entityStates[key]) {
      set({
        entityStates: {
          ...entityStates,
          [key]: {
            undoStack: [],
            redoStack: [],
            canUndo: false,
            canRedo: false,
            isLoading: false,
          },
        },
      });
    }
  },

  // Get entity state
  getEntityState: (entityType, entityId) => {
    const key = createEntityKey(entityType, entityId);
    return get().entityStates[key] || null;
  },

  // Load version history from server
  loadVersionHistory: async (entityType, entityId, currentStateHash?: string) => {
    const key = createEntityKey(entityType, entityId);

    set((state) => ({
      entityStates: {
        ...state.entityStates,
        [key]: {
          ...(state.entityStates[key] || {
            undoStack: [],
            redoStack: [],
            canUndo: false,
            canRedo: false,
          }),
          isLoading: true,
        },
      },
    }));

    try {
      const response = await fetch(
        `/api/versions?entityType=${entityType}&entityId=${entityId}&limit=100`
      );
      const result = await response.json();

      if (result.error) {
        set({ error: result.error });
        return;
      }

      const versions: Version[] = result.data || [];
      const versionsSorted = [...versions].reverse(); // Oldest to newest

      // Cache versions
      const newCache: Record<string, Version> = {};
      versions.forEach((v) => {
        newCache[v.id] = v;
      });

      // Determine which versions go in undo vs redo stacks
      let undoStack: string[] = [];
      let redoStack: string[] = [];

      if (currentStateHash && versions.length > 0) {
        // Find where we are in the version history
        let foundMatch = false;

        for (let i = 0; i < versionsSorted.length; i++) {
          const version = versionsSorted[i];

          // Case 1: Current state matches this version's current_hash
          // We're AFTER this version - it and all before it can be undone
          if (version.current_hash === currentStateHash) {
            // All versions up to and including this one go in undoStack
            undoStack = versionsSorted.slice(0, i + 1).map(v => v.id);
            // Remaining versions go in redoStack
            redoStack = versionsSorted.slice(i + 1).map(v => v.id);

            foundMatch = true;
            break;
          }

          // Case 2: Current state matches this version's previous_hash
          // We're BEFORE this version - versions before can be undone, this and after can be redone
          if (version.previous_hash === currentStateHash) {
            // Versions before this go in undoStack
            undoStack = versionsSorted.slice(0, i).map(v => v.id);
            // This version and after go in redoStack
            redoStack = versionsSorted.slice(i).map(v => v.id);

            foundMatch = true;
            break;
          }
        }

        if (!foundMatch) {
          // At latest - all versions can be undone
          undoStack = versionsSorted.map(v => v.id);
          redoStack = [];
        }
      } else {
        // No hash provided - assume at latest
        undoStack = versionsSorted.map(v => v.id);
        redoStack = [];
      }

      const canUndo = undoStack.length > 0;
      const canRedo = redoStack.length > 0;

      set((state) => ({
        versionCache: { ...state.versionCache, ...newCache },
        entityStates: {
          ...state.entityStates,
          [key]: {
            undoStack,
            redoStack,
            canUndo,
            canRedo,
            isLoading: false,
          },
        },
        historySummaries: {
          ...state.historySummaries,
          [key]: versions.map((v) => ({
            id: v.id,
            action_type: v.action_type,
            description: v.description,
            created_at: v.created_at,
          })),
        },
      }));
    } catch (error) {
      console.error('Failed to load version history:', error);
      set({ error: 'Failed to load version history' });

      set((state) => ({
        entityStates: {
          ...state.entityStates,
          [key]: {
            ...(state.entityStates[key] || {
              undoStack: [],
              redoStack: [],
              canUndo: false,
              canRedo: false,
            }),
            isLoading: false,
          },
        },
      }));
    }
  },

  // Record a new version
  recordVersion: (version) => {
    // Don't record during undo/redo operations
    if (get().isUndoRedoInProgress) {
      return;
    }

    const key = createEntityKey(version.entity_type, version.entity_id);
    const { entityStates, versionCache } = get();

    const entityState = entityStates[key] || {
      undoStack: [],
      redoStack: [],
      canUndo: false,
      canRedo: false,
      isLoading: false,
    };

    // When recording a new version:
    // 1. Add it to undo stack (push to end)
    // 2. Clear redo stack (we've made a new change, any redo history is now invalid)
    const newUndoStack = [...entityState.undoStack, version.id];

    set({
      versionCache: { ...versionCache, [version.id]: version },
      entityStates: {
        ...entityStates,
        [key]: {
          ...entityState,
          undoStack: newUndoStack,
          redoStack: [], // Clear redo stack
          canUndo: true,
          canRedo: false,
        },
      },
    });
  },

  // Undo operation
  undo: async (entityType, entityId) => {
    const key = createEntityKey(entityType, entityId);
    const { entityStates, versionCache } = get();
    const entityState = entityStates[key];

    if (!entityState || entityState.undoStack.length === 0) {
      return null;
    }

    // Pop the most recent version from undo stack
    const versionId = entityState.undoStack[entityState.undoStack.length - 1];
    let version = versionCache[versionId];

    // Fetch if not cached
    if (!version) {
      try {
        const response = await fetch(`/api/versions/${versionId}`);
        const result = await response.json();
        if (result.data) {
          version = result.data;
          set((state) => ({
            versionCache: { ...state.versionCache, [versionId]: version! },
          }));
        }
      } catch (error) {
        console.error('Failed to fetch version:', error);
        return null;
      }
    }

    if (!version) {
      return null;
    }

    // Move version from undo stack to redo stack
    const newUndoStack = entityState.undoStack.slice(0, -1); // Remove last
    const newRedoStack = [...entityState.redoStack, versionId]; // Add to end

    // Get the previous version's metadata (N-1) to restore selection from
    let previousVersionMetadata = null;
    if (newUndoStack.length > 0) {
      const previousVersionId = newUndoStack[newUndoStack.length - 1];
      let previousVersion = versionCache[previousVersionId];

      // Fetch if not cached
      if (!previousVersion) {
        try {
          const response = await fetch(`/api/versions/${previousVersionId}`);
          const result = await response.json();
          if (result.data) {
            previousVersion = result.data;
            set((state) => ({
              versionCache: { ...state.versionCache, [previousVersionId]: previousVersion! },
            }));
          }
        } catch (error) {
          console.error('Failed to fetch previous version for metadata:', error);
        }
      }

      if (previousVersion?.metadata) {
        previousVersionMetadata = previousVersion.metadata;
      }
    }

    set((state) => ({
      entityStates: {
        ...state.entityStates,
        [key]: {
          ...state.entityStates[key],
          undoStack: newUndoStack,
          redoStack: newRedoStack,
          canUndo: newUndoStack.length > 0,
          canRedo: true,
        },
      },
    }));

    // Attach previous version metadata for selection restoration
    return {
      ...version,
      previousVersionMetadata,
    };
  },

  // Redo operation
  redo: async (entityType, entityId) => {
    const key = createEntityKey(entityType, entityId);
    const { entityStates, versionCache } = get();
    const entityState = entityStates[key];

    if (!entityState || entityState.redoStack.length === 0) {
      return null;
    }

    // Pop the most recent version from redo stack
    const versionId = entityState.redoStack[entityState.redoStack.length - 1];
    let version = versionCache[versionId];

    // Fetch if not cached
    if (!version) {
      try {
        const response = await fetch(`/api/versions/${versionId}`);
        const result = await response.json();
        if (result.data) {
          version = result.data;
          set((state) => ({
            versionCache: { ...state.versionCache, [versionId]: version! },
          }));
        }
      } catch (error) {
        console.error('Failed to fetch version:', error);
        return null;
      }
    }

    if (!version) {
      return null;
    }

    // Move version from redo stack to undo stack
    const newRedoStack = entityState.redoStack.slice(0, -1); // Remove last
    const newUndoStack = [...entityState.undoStack, versionId]; // Add to end

    set((state) => ({
      entityStates: {
        ...state.entityStates,
        [key]: {
          ...state.entityStates[key],
          undoStack: newUndoStack,
          redoStack: newRedoStack,
          canUndo: true,
          canRedo: newRedoStack.length > 0,
        },
      },
    }));

    return version;
  },

  // Check if can undo
  canUndo: (entityType, entityId) => {
    const key = createEntityKey(entityType, entityId);
    const entityState = get().entityStates[key];
    return entityState?.canUndo ?? false;
  },

  // Check if can redo
  canRedo: (entityType, entityId) => {
    const key = createEntityKey(entityType, entityId);
    const entityState = get().entityStates[key];
    return entityState?.canRedo ?? false;
  },

  // Get version at position (position in combined history: undo + redo stacks)
  getVersionAtPosition: async (entityType, entityId, position) => {
    const key = createEntityKey(entityType, entityId);
    const { entityStates, versionCache } = get();
    const entityState = entityStates[key];

    if (!entityState) {
      return null;
    }

    // Combined history: undo stack + redo stack
    const allVersions = [...entityState.undoStack, ...entityState.redoStack];

    if (position < 0 || position >= allVersions.length) {
      return null;
    }

    const versionId = allVersions[position];
    let version = versionCache[versionId];

    if (!version) {
      try {
        const response = await fetch(`/api/versions/${versionId}`);
        const result = await response.json();
        if (result.data) {
          version = result.data;
          set((state) => ({
            versionCache: { ...state.versionCache, [versionId]: version! },
          }));
        }
      } catch (error) {
        console.error('Failed to fetch version:', error);
        return null;
      }
    }

    return version || null;
  },

  // Clear history for an entity
  clearHistory: (entityType, entityId) => {
    const key = createEntityKey(entityType, entityId);

    set((state) => {
      const newEntityStates = { ...state.entityStates };
      delete newEntityStates[key];

      const newHistorySummaries = { ...state.historySummaries };
      delete newHistorySummaries[key];

      return {
        entityStates: newEntityStates,
        historySummaries: newHistorySummaries,
      };
    });
  },

  // Clear redo stack when new change is made (before save)
  clearRedoStack: (entityType, entityId) => {
    const key = createEntityKey(entityType, entityId);
    const { entityStates } = get();
    const entityState = entityStates[key];

    if (!entityState) return;

    // Only update if redo stack is not empty
    if (entityState.redoStack.length > 0) {
      set({
        entityStates: {
          ...entityStates,
          [key]: {
            ...entityState,
            redoStack: [],
            canRedo: false,
          },
        },
      });
    }
  },

  // Error management
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),

  // Undo/redo progress tracking
  setUndoRedoInProgress: (inProgress) => set({ isUndoRedoInProgress: inProgress }),
}));
