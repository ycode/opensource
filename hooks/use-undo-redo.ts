/**
 * useUndoRedo Hook
 *
 * Provides undo/redo functionality for pages, components, and layer styles
 * Integrates with version tracking and applies patches to restore states
 */

import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useVersionsStore } from '@/stores/useVersionsStore';
import { usePagesStore } from '@/stores/usePagesStore';
import { useComponentsStore } from '@/stores/useComponentsStore';
import { useLayerStylesStore } from '@/stores/useLayerStylesStore';
import { applyPatch, createPatch, createInversePatch, isPatchEmpty, doesPatchChangeState, generatePatchDescription, JsonPatch } from '@/lib/version-utils';
import { markUndoRedoSave } from '@/lib/version-tracking';
import { generatePageLayersHash } from '@/lib/hash-utils';
import { stripUIProperties } from '@/lib/layer-utils';
import { useEditorStore } from '@/stores/useEditorStore';
import type { Layer, Version, VersionEntityType, CreateVersionData } from '@/types';

/**
 * Check if a layer exists in the layer tree
 */
function layerExists(layers: Layer[], layerId: string): boolean {
  if (!layers || !Array.isArray(layers)) return false;

  for (const layer of layers) {
    if (layer.id === layerId) return true;
    if (layer.children && layerExists(layer.children, layerId)) return true;
  }

  return false;
}

/**
 * Restore UI metadata after undo/redo
 * Uses prioritized layer IDs - tries first valid layer from the list
 * Falls back to previous version's metadata if no valid layers found
 */
function restoreUIMetadata(
  metadata: any,
  currentState?: any,
  fallbackMetadata?: any
): void {
  if (!metadata && !fallbackMetadata) return;

  try {
    const { setSelectedLayerIds, clearSelection } = useEditorStore.getState();

    // Get prioritized layer IDs from metadata
    const layerIds = metadata?.selection?.layer_ids;

    if (layerIds && Array.isArray(layerIds) && layerIds.length > 0) {
      // Try each layer ID in priority order until we find a valid one
      if (currentState && Array.isArray(currentState)) {
        for (const layerId of layerIds) {
          if (layerExists(currentState, layerId)) {
            // Found a valid layer, select it
            setSelectedLayerIds([layerId]);
            return;
          }
        }

        // None of the current metadata layers exist, try fallback
        if (fallbackMetadata) {
          const fallbackLayerIds = fallbackMetadata.selection?.layer_ids;
          if (fallbackLayerIds && Array.isArray(fallbackLayerIds)) {
            for (const layerId of fallbackLayerIds) {
              if (layerExists(currentState, layerId)) {
                // Found a valid layer in fallback metadata
                setSelectedLayerIds([layerId]);
                return;
              }
            }
          }
        }

        // No valid layers found anywhere, clear selection
        clearSelection();
      } else {
        // No validation possible, trust the first layer in the list
        setSelectedLayerIds([layerIds[0]]);
      }
    } else if (fallbackMetadata) {
      // No metadata in current version, try fallback directly
      const fallbackLayerIds = fallbackMetadata.selection?.layer_ids;
      if (fallbackLayerIds && Array.isArray(fallbackLayerIds) && fallbackLayerIds.length > 0) {
        if (currentState && Array.isArray(currentState)) {
          for (const layerId of fallbackLayerIds) {
            if (layerExists(currentState, layerId)) {
              setSelectedLayerIds([layerId]);
              return;
            }
          }
        } else {
          setSelectedLayerIds([fallbackLayerIds[0]]);
          return;
        }
      }
      clearSelection();
    } else {
      clearSelection();
    }
  } catch (error) {
    console.warn('Failed to restore UI metadata:', error);
  }
}

interface UseUndoRedoOptions {
  /** Entity type for version tracking */
  entityType: VersionEntityType;
  /** Entity ID (page_id, component_id, or style_id) */
  entityId: string | null;
  /** Whether to auto-initialize on mount */
  autoInit?: boolean;
}

interface UseUndoRedoReturn {
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
  /** Whether an operation is in progress */
  isLoading: boolean;
  /** Perform undo operation */
  undo: () => Promise<boolean>;
  /** Perform redo operation */
  redo: () => Promise<boolean>;
  /** Record a change (called after save) */
  recordChange: (previousState: any, currentState: any, description?: string) => Promise<void>;
  /** Initialize version history */
  initialize: () => Promise<void>;
}

// Cache for tracking the previous state of entities
const previousStateCache = new Map<string, any>();

// Local undo/redo buffer for unsaved changes (per entity)
interface LocalChange {
  state: any;
  timestamp: number;
}

const localUndoBuffer = new Map<string, LocalChange[]>();
const localRedoBuffer = new Map<string, LocalChange[]>();

// Operation lock to prevent concurrent undo/redo operations per entity
const operationLocks = new Map<string, boolean>();

// Track entities currently being initialized to prevent false change detection
const initializingEntities = new Set<string>();

export function useUndoRedo({
  entityType,
  entityId,
  autoInit = true,
}: UseUndoRedoOptions): UseUndoRedoReturn {
  const {
    initEntityState,
    loadVersionHistory,
    recordVersion,
    undo: storeUndo,
    redo: storeRedo,
    getSessionId,
    setUndoRedoInProgress,
  } = useVersionsStore();

  // Subscribe directly to the entity state to properly react to changes
  const entityKey = entityId ? `${entityType}:${entityId}` : null;
  const entityState = useVersionsStore((state) => {
    if (!entityKey) return null;
    // Access the entity state directly - this ensures proper reactivity
    return state.entityStates[entityKey as keyof typeof state.entityStates] ?? null;
  });

  const draftsByPageId = usePagesStore((state) => state.draftsByPageId);
  const setDraftLayers = usePagesStore((state) => state.setDraftLayers);
  const componentDrafts = useComponentsStore((state) => state.componentDrafts);
  const updateComponentDraft = useComponentsStore((state) => state.updateComponentDraft);
  const styles = useLayerStylesStore((state) => state.styles);

  // Entity key for caching
  const cacheKey = useMemo(() => {
    if (!entityId) return null;
    return `${entityType}:${entityId}`;
  }, [entityType, entityId]);

  // Get current state based on entity type
  const getCurrentState = useCallback((): any => {
    if (!entityId) return null;

    switch (entityType) {
      case 'page_layers': {
        const draft = draftsByPageId[entityId];
        return draft?.layers || [];
      }
      case 'component': {
        return componentDrafts[entityId] || [];
      }
      case 'layer_style': {
        const style = styles.find((s) => s.id === entityId);
        return style ? { classes: style.classes, design: style.design } : null;
      }
      default:
        return null;
    }
  }, [entityType, entityId, draftsByPageId, componentDrafts, styles]);

  // Apply state based on entity type
  const applyState = useCallback(
    async (state: any): Promise<void> => {
      if (!entityId) return;

      switch (entityType) {
        case 'page_layers': {
          setDraftLayers(entityId, state as Layer[]);
          break;
        }
        case 'component': {
          // Log component state for debugging duplication issues
          if (process.env.NODE_ENV === 'development') {
            const layerIds = (state as Layer[]).map(l => l.id);
            const duplicates = layerIds.filter((id, index) => layerIds.indexOf(id) !== index);
            if (duplicates.length > 0) {
              console.error(`❌ [applyState] Component ${entityId} - Applying state with DUPLICATE IDs:`, duplicates);
              console.error('   Layer IDs in state:', layerIds);
            }
          }
          updateComponentDraft(entityId, state as Layer[]);
          break;
        }
        case 'layer_style': {
          // For layer styles, we need to update via API
          await fetch(`/api/layer-styles/${entityId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(state),
          });
          // Reload styles
          await useLayerStylesStore.getState().loadStyles();
          break;
        }
      }
    },
    [entityType, entityId, setDraftLayers, updateComponentDraft]
  );

  // Initialize entity state - only when entityId changes
  const initialize = useCallback(async () => {
    if (!entityId || !cacheKey) return;

    // Mark entity as initializing to prevent false change detection
    initializingEntities.add(cacheKey);

    try {
      // Small delay to ensure loadComponentDraft completes first
      // This prevents race condition where we read stale state
      await new Promise(resolve => setTimeout(resolve, 10));

      // Get current state
      const currentState = getCurrentState();

      // ALWAYS sync previousStateCache with current loaded state to prevent
      // false change detection when re-entering edit mode
      // Only update if not already set by loadComponentDraft
      if (currentState && !previousStateCache.has(cacheKey)) {
        previousStateCache.set(cacheKey, JSON.parse(JSON.stringify(currentState)));
      }

      // Clear local buffers when switching entities to prevent stale state interference
      localUndoBuffer.delete(cacheKey);
      localRedoBuffer.delete(cacheKey);

      // Only initialize version history if not already initialized
      const existingState = useVersionsStore.getState().entityStates[`${entityType}:${entityId}`];
      if (existingState && (existingState.undoStack.length > 0 || existingState.redoStack.length > 0)) {
        // Already initialized, don't reset version history
        return;
      }

      initEntityState(entityType, entityId);

      // Calculate hash to determine position in history
      let currentHash: string | undefined;

      if (currentState && entityType === 'page_layers') {
        currentHash = generatePageLayersHash({ layers: currentState, generated_css: null });
      }

      await loadVersionHistory(entityType, entityId, currentHash);
    } finally {
      // Clear initializing flag after a longer delay to ensure all async operations complete
      setTimeout(() => {
        initializingEntities.delete(cacheKey);
      }, 100);
    }
  }, [entityType, entityId, initEntityState, loadVersionHistory, cacheKey, getCurrentState]);

  // Auto-initialize on mount - only run once per entityId
  useEffect(() => {
    if (autoInit && entityId) {
      initialize();
    }

    // Reset buffer counts when entity changes - buffers are cleared in initialize()
    // This ensures UI reflects the cleared state
    if (cacheKey) {
      // Use timeout to ensure this runs after initialize() clears the buffers
      const timer = setTimeout(() => {
        const undoBuffer = localUndoBuffer.get(cacheKey);
        const redoBuffer = localRedoBuffer.get(cacheKey);
        setLocalUndoCount(undoBuffer?.length || 0);
        setLocalRedoCount(redoBuffer?.length || 0);
      }, 0);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoInit, entityId, cacheKey]);

  // Listen for version saved event to clear local buffers
  useEffect(() => {
    if (!cacheKey) return;

    const handleVersionSaved = (event: CustomEvent) => {
      const { entityType: savedType, entityId: savedId } = event.detail;
      const savedKey = `${savedType}:${savedId}`;

      if (savedKey === cacheKey) {
        // Clear local buffers since changes are now persisted
        localUndoBuffer.delete(cacheKey);
        localRedoBuffer.delete(cacheKey);
        setLocalUndoCount(0);
        setLocalRedoCount(0);
      }
    };

    window.addEventListener('versionSaved', handleVersionSaved as EventListener);
    return () => {
      window.removeEventListener('versionSaved', handleVersionSaved as EventListener);
    };
  }, [cacheKey, getCurrentState]);

  // Track state changes for local undo buffer (for unsaved changes)
  useEffect(() => {
    if (!cacheKey || !entityId) return;

    // Don't track during entity initialization (e.g., entering component edit mode)
    // This prevents treating loaded state as a user change
    if (initializingEntities.has(cacheKey)) {
      return;
    }

    const currentState = getCurrentState();
    if (!currentState) return;

    // Initialize cache if needed
    if (!previousStateCache.has(cacheKey)) {
      previousStateCache.set(cacheKey, JSON.parse(JSON.stringify(currentState)));
      return;
    }

    // Don't track during undo/redo operations
    if (useVersionsStore.getState().isUndoRedoInProgress) {
      return;
    }

    // Check if state actually changed
    const prevState = previousStateCache.get(cacheKey);

    // Strip UI-only properties (like 'open') before comparison for layer-based entities
    const isLayerEntity = entityType === 'page_layers' || entityType === 'component';
    const prevStateForComparison = isLayerEntity && Array.isArray(prevState)
      ? stripUIProperties(prevState as Layer[])
      : prevState;
    const currentStateForComparison = isLayerEntity && Array.isArray(currentState)
      ? stripUIProperties(currentState as Layer[])
      : currentState;

    const currentJSON = JSON.stringify(currentStateForComparison);
    const prevJSON = JSON.stringify(prevStateForComparison);

    if (currentJSON !== prevJSON) {
      // Validate states before adding to buffer (development only)
      if (process.env.NODE_ENV === 'development' && entityType === 'component') {
        const prevLayerIds = (prevState as Layer[]).map(l => l.id);
        const currentLayerIds = (currentState as Layer[]).map(l => l.id);
        const prevDuplicates = prevLayerIds.filter((id, index) => prevLayerIds.indexOf(id) !== index);
        const currentDuplicates = currentLayerIds.filter((id, index) => currentLayerIds.indexOf(id) !== index);

        if (prevDuplicates.length > 0) {
          console.error(`❌ [State Tracking] Component ${entityId} - Previous state has DUPLICATE IDs:`, prevDuplicates);
          console.error('   Previous layer IDs:', prevLayerIds);
          console.error('   Current layer IDs:', currentLayerIds);
        }
        if (currentDuplicates.length > 0) {
          console.error(`❌ [State Tracking] Component ${entityId} - Current state has DUPLICATE IDs:`, currentDuplicates);
          console.error('   Previous layer IDs:', prevLayerIds);
          console.error('   Current layer IDs:', currentLayerIds);
        }
      }

      // Add current state to undo buffer
      const undoBuffer = localUndoBuffer.get(cacheKey) || [];
      undoBuffer.push({
        state: JSON.parse(JSON.stringify(prevState)),
        timestamp: Date.now(),
      });
      localUndoBuffer.set(cacheKey, undoBuffer);
      setLocalUndoCount(undoBuffer.length);

      // Clear redo buffer when new change is made (both local and database)
      localRedoBuffer.delete(cacheKey);
      setLocalRedoCount(0);

      // Also clear database redo stack immediately (don't wait for save)
      useVersionsStore.getState().clearRedoStack(entityType, entityId);

      // Update previous state
      previousStateCache.set(cacheKey, JSON.parse(JSON.stringify(currentState)));

    }
  }, [cacheKey, entityId, entityType, getCurrentState, draftsByPageId, componentDrafts, styles]);

  // Track buffer size in state to trigger re-renders
  const [localUndoCount, setLocalUndoCount] = useState(0);
  const [localRedoCount, setLocalRedoCount] = useState(0);

  // Check if we have local unsaved changes
  const hasLocalChanges = localUndoCount > 0;

  // Check undo/redo availability - includes local buffer
  const canUndo = hasLocalChanges || (entityState?.canUndo ?? false);
  const canRedo = localRedoCount > 0 || (entityState?.canRedo ?? false);

  // Get loading state
  const isLoading = entityState?.isLoading ?? false;
  const { isUndoRedoInProgress } = useVersionsStore();

  // Undo operation
  const undo = useCallback(async (): Promise<boolean> => {
    if (!entityId || !canUndo) return false;

    // Prevent concurrent undo/redo operations using synchronous lock
    const lockKey = `${entityType}:${entityId}`;
    if (operationLocks.get(lockKey)) {
      return false;
    }
    operationLocks.set(lockKey, true);

    try {
      setUndoRedoInProgress(true);

      // Check local buffer first (for unsaved changes)
      if (cacheKey) {
        const undoBuffer = localUndoBuffer.get(cacheKey);
        if (undoBuffer && undoBuffer.length > 0) {
          // Pop the last change from undo buffer
          const lastChange = undoBuffer.pop()!;
          localUndoBuffer.set(cacheKey, undoBuffer);
          setLocalUndoCount(undoBuffer.length);

          // Validate buffer state for components
          if (process.env.NODE_ENV === 'development' && entityType === 'component') {
            const layerIds = (lastChange.state as Layer[]).map(l => l.id);
            const duplicates = layerIds.filter((id, index) => layerIds.indexOf(id) !== index);
            if (duplicates.length > 0) {
              console.error(`❌ [Local Undo] Component ${entityId} - Buffer state has DUPLICATE IDs:`, duplicates);
              console.error('   Layer IDs in buffer:', layerIds);
              console.error('   This indicates corruption when the state was saved to buffer');
            }
          }

          // Add current state to redo buffer
          const currentState = getCurrentState();
          if (currentState) {
            const redoBuffer = localRedoBuffer.get(cacheKey) || [];
            redoBuffer.push({
              state: JSON.parse(JSON.stringify(currentState)),
              timestamp: Date.now(),
            });
            localRedoBuffer.set(cacheKey, redoBuffer);
            setLocalRedoCount(redoBuffer.length);
          }

          // Restore the previous state
          await applyState(lastChange.state);
          previousStateCache.set(cacheKey, JSON.parse(JSON.stringify(lastChange.state)));

          // Auto-save will detect the state change and handle saving with debouncing
          return true;
        }
      }

      // No local changes, use database undo
      const version = await storeUndo(entityType, entityId);

      if (!version) {
        return false;
      }

      // Check and restore required components before undoing
      if (version.metadata?.requirements?.component_ids) {
        const { restoreComponents } = useComponentsStore.getState();
        await restoreComponents(version.metadata.requirements.component_ids);
      }

      // Check and restore required layer styles before undoing
      if (version.metadata?.requirements?.layer_style_ids) {
        const { useLayerStylesStore } = await import('@/stores/useLayerStylesStore');
        const { restoreLayerStyles } = useLayerStylesStore.getState();
        await restoreLayerStyles(version.metadata.requirements.layer_style_ids);
      }

      // Apply the undo patch to restore previous state
      const currentState = getCurrentState();

      if (currentState && version.undo) {
        const restoredState = applyPatch(currentState, version.undo as JsonPatch);

        // Check if state actually changed
        const currentJSON = JSON.stringify(currentState);
        const restoredJSON = JSON.stringify(restoredState);

        if (currentJSON === restoredJSON) {
          // console.warn('⚠️ Undo: Patch produced no change!');
          // Don't return false - still update the store to keep stacks in sync
        }

        // Mark this entity so auto-save won't create a new version
        markUndoRedoSave(entityType, entityId);

        await applyState(restoredState);

        // Restore UI metadata (selected layers, etc.)
        // The metadata contains prioritized layer IDs - tries current version first, then falls back to previous
        const previousMetadata = (version as any).previousVersionMetadata;
        restoreUIMetadata(version.metadata, restoredState, previousMetadata);

        // Update cache
        if (cacheKey) {
          previousStateCache.set(cacheKey, JSON.parse(JSON.stringify(restoredState)));
        }

        // Auto-save will detect the state change and handle saving with debouncing
        // markUndoRedoSave ensures no new version is created
        return true;
      }

      // If no undo patch, try to reconstruct from snapshot
      // This is a fallback for older versions or create/delete actions
      if (version.snapshot) {
        // Check and restore required components before undoing
        if (version.metadata?.requirements?.component_ids) {
          const { restoreComponents } = useComponentsStore.getState();
          await restoreComponents(version.metadata.requirements.component_ids);
        }

        // Check and restore required layer styles before undoing
        if (version.metadata?.requirements?.layer_style_ids) {
          const { useLayerStylesStore } = await import('@/stores/useLayerStylesStore');
          const { restoreLayerStyles } = useLayerStylesStore.getState();
          await restoreLayerStyles(version.metadata.requirements.layer_style_ids);
        }

        // Mark this entity so auto-save won't create a new version
        markUndoRedoSave(entityType, entityId);

        await applyState(version.snapshot);
        if (cacheKey) {
          previousStateCache.set(cacheKey, JSON.parse(JSON.stringify(version.snapshot)));
        }

        // Restore UI metadata from snapshot
        // The metadata contains prioritized layer IDs - tries current version first, then falls back to previous
        const previousMetadata = (version as any).previousVersionMetadata;
        restoreUIMetadata(version.metadata, version.snapshot, previousMetadata);

        // Auto-save will detect the state change and handle saving with debouncing
        return true;
      }

      return false;
    } catch (error) {
      console.error('Undo failed:', error);
      return false;
    } finally {
      const lockKey = `${entityType}:${entityId}`;
      operationLocks.delete(lockKey);
      setUndoRedoInProgress(false);
    }
  }, [entityType, entityId, canUndo, storeUndo, getCurrentState, applyState, cacheKey, setUndoRedoInProgress]);

  // Redo operation
  const redo = useCallback(async (): Promise<boolean> => {
    if (!entityId || !canRedo) return false;

    // Prevent concurrent undo/redo operations using synchronous lock
    const lockKey = `${entityType}:${entityId}`;
    if (operationLocks.get(lockKey)) {
      return false;
    }
    operationLocks.set(lockKey, true);

    try {
      setUndoRedoInProgress(true);

      // Check local redo buffer first (for unsaved changes)
      if (cacheKey) {
        const redoBuffer = localRedoBuffer.get(cacheKey);
        if (redoBuffer && redoBuffer.length > 0) {

          // Pop the last state from redo buffer
          const nextChange = redoBuffer.pop()!;
          localRedoBuffer.set(cacheKey, redoBuffer);
          setLocalRedoCount(redoBuffer.length);

          // Add current state to undo buffer
          const currentState = getCurrentState();
          if (currentState) {
            const undoBuffer = localUndoBuffer.get(cacheKey) || [];
            undoBuffer.push({
              state: JSON.parse(JSON.stringify(currentState)),
              timestamp: Date.now(),
            });
            localUndoBuffer.set(cacheKey, undoBuffer);
            setLocalUndoCount(undoBuffer.length);
          }

          // Restore the next state
          await applyState(nextChange.state);
          previousStateCache.set(cacheKey, JSON.parse(JSON.stringify(nextChange.state)));

          // Auto-save will detect the state change and handle saving with debouncing
          return true;
        }
      }

      // No local redo, use database redo
      const version = await storeRedo(entityType, entityId);

      if (version === null) {
        // version === null means "restore to latest"
        // Mark this entity so auto-save won't create a new version
        markUndoRedoSave(entityType, entityId);

        // Reload from database
        if (entityType === 'page_layers') {
          await usePagesStore.getState().loadDraft(entityId);
        } else if (entityType === 'component') {
          await useComponentsStore.getState().loadComponentDraft(entityId);
        } else if (entityType === 'layer_style') {
          await useLayerStylesStore.getState().loadStyles();
        }

        // Update cache
        if (cacheKey) {
          const currentState = getCurrentState();
          if (currentState) {
            previousStateCache.set(cacheKey, JSON.parse(JSON.stringify(currentState)));
          }
        }

        return true;
      }

      // Check and restore required components before redoing
      if (version.metadata?.requirements?.component_ids) {
        const { restoreComponents } = useComponentsStore.getState();
        await restoreComponents(version.metadata.requirements.component_ids);
      }

      // Check and restore required layer styles before redoing
      if (version.metadata?.requirements?.layer_style_ids) {
        const { useLayerStylesStore } = await import('@/stores/useLayerStylesStore');
        const { restoreLayerStyles } = useLayerStylesStore.getState();
        await restoreLayerStyles(version.metadata.requirements.layer_style_ids);
      }

      // Apply the redo patch
      const currentState = getCurrentState();

      if (currentState && version.redo) {
        const newState = applyPatch(currentState, version.redo as JsonPatch);

        // Check if state actually changed
        const currentJSON = JSON.stringify(currentState);
        const newJSON = JSON.stringify(newState);

        if (currentJSON === newJSON) {
          console.warn('⚠️ Redo: Patch produced no change!');
          console.warn('⚠️ Current state hash:', version.previous_hash?.substring(0, 8));
          console.warn('⚠️ This might indicate we\'re applying patches out of order');
          // Don't return false - still update the store to keep stacks in sync
        }

        // Mark this entity so auto-save won't create a new version
        markUndoRedoSave(entityType, entityId);

        await applyState(newState);

        // Restore UI metadata (selected layers, etc.) - use metadata from AFTER the change
        // For redo, we want the state AFTER applying the patch
        // Pass newState to validate layer existence
        if (version.metadata) {
          restoreUIMetadata(version.metadata, newState);
        }

        // Update cache
        if (cacheKey) {
          previousStateCache.set(cacheKey, JSON.parse(JSON.stringify(newState)));
        }

        // Auto-save will detect the state change and handle saving with debouncing
        return true;
      }

      console.warn('🔄 Redo: Failed - no current state or patch');
      return false;
    } catch (error) {
      console.error('Redo failed:', error);
      return false;
    } finally {
      const lockKey = `${entityType}:${entityId}`;
      operationLocks.delete(lockKey);
      setUndoRedoInProgress(false);
    }
  }, [entityType, entityId, canRedo, storeRedo, getCurrentState, applyState, cacheKey, setUndoRedoInProgress]);

  // Record a change
  const recordChange = useCallback(
    async (previousState: any, currentState: any, description?: string): Promise<void> => {
      if (!entityId) return;

      // Don't record during undo/redo
      if (useVersionsStore.getState().isUndoRedoInProgress) {
        return;
      }

      try {
        // Create patches for redo (forward) and undo (inverse)
        const redoPatch = createPatch(previousState, currentState);

        // Skip if no actual changes
        if (isPatchEmpty(redoPatch)) {
          return;
        }

        // Verify the patch actually produces a different state
        if (!doesPatchChangeState(previousState, redoPatch)) {
          return;
        }

        // Create undo patch (inverse of redo)
        const undoPatch = createInversePatch(previousState, redoPatch);

        // Generate hashes
        const previousHash = previousState
          ? generatePageLayersHash({ layers: previousState, generated_css: null })
          : null;
        const currentHash = generatePageLayersHash({ layers: currentState, generated_css: null });

        // Generate description if not provided
        const finalDescription = description || generatePatchDescription(redoPatch);

        // Let the server decide when to store snapshots based on version count
        // We'll pass the current state and let the API handle snapshot logic

        // Create version via API
        // Note: snapshot is determined server-side based on version count
        const versionData: CreateVersionData = {
          entity_type: entityType,
          entity_id: entityId,
          action_type: 'update',
          description: finalDescription,
          redo: redoPatch,
          undo: undoPatch,
          previous_hash: previousHash,
          current_hash: currentHash,
          session_id: getSessionId(),
        };

        const response = await fetch('/api/versions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(versionData),
        });

        const result = await response.json();

        if (result.data) {
          // Record in store
          recordVersion(result.data);

          // Update cache
          if (cacheKey) {
            previousStateCache.set(cacheKey, JSON.parse(JSON.stringify(currentState)));
          }
        }
      } catch (error) {
        console.error('Failed to record change:', error);
      }
    },
    [entityType, entityId, getSessionId, recordVersion, cacheKey]
  );

  return {
    canUndo,
    canRedo,
    isLoading: isLoading || isUndoRedoInProgress, // Loading if fetching history OR operation in progress
    undo,
    redo,
    recordChange,
    initialize,
  };
}

/**
 * Get the previous state from cache (for use in save operations)
 */
export function getPreviousState(entityType: VersionEntityType, entityId: string): any {
  const cacheKey = `${entityType}:${entityId}`;
  return previousStateCache.get(cacheKey);
}

/**
 * Update the cached previous state (after recording a change)
 */
export function updatePreviousState(entityType: VersionEntityType, entityId: string, state: any): void {
  const cacheKey = `${entityType}:${entityId}`;
  previousStateCache.set(cacheKey, JSON.parse(JSON.stringify(state)));
}

/**
 * Mark entity as initializing to prevent false change detection.
 * Call this BEFORE updating the store with loaded data.
 */
export function markEntityInitializing(entityType: VersionEntityType, entityId: string): void {
  const cacheKey = `${entityType}:${entityId}`;
  initializingEntities.add(cacheKey);
}

/**
 * Clear entity initializing mark.
 * Call this AFTER the entity state has been fully initialized.
 */
export function clearEntityInitializing(entityType: VersionEntityType, entityId: string): void {
  const cacheKey = `${entityType}:${entityId}`;
  initializingEntities.delete(cacheKey);
}
