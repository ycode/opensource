/**
 * Version Tracking (Client-safe)
 *
 * Provides version tracking via API calls without importing server-only code.
 * Used by client stores to record and track versions for undo/redo.
 */

import type { VersionEntityType, CreateVersionData } from '@/types';
import { createPatch, createInversePatch, isPatchEmpty, doesPatchChangeState, generatePatchDescription, JsonPatch } from '@/lib/version-utils';
import { generatePageLayersHash, generateComponentContentHash, generateLayerStyleContentHash } from '@/lib/hash-utils';
import { useEditorStore } from '@/stores/useEditorStore';

// In-memory cache for previous states (per session)
const previousStatesCache = new Map<string, any>();

/**
 * Generate a cache key for an entity
 */
function getCacheKey(entityType: VersionEntityType, entityId: string): string {
  return `${entityType}:${entityId}`;
}

/**
 * Get the cached previous state for an entity
 */
export function getPreviousState(entityType: VersionEntityType, entityId: string): any | null {
  return previousStatesCache.get(getCacheKey(entityType, entityId)) || null;
}

/**
 * Set the cached previous state for an entity
 */
export function setPreviousState(entityType: VersionEntityType, entityId: string, state: any): void {
  previousStatesCache.set(getCacheKey(entityType, entityId), state);
}

/**
 * Initialize version tracking for an entity (called when loading data)
 */
export function initializeVersionTracking(
  entityType: VersionEntityType,
  entityId: string,
  initialState: any
): void {
  // Deep clone to prevent reference issues
  const clonedState = JSON.parse(JSON.stringify(initialState));
  setPreviousState(entityType, entityId, clonedState);
}

/**
 * Generate hash for entity content
 */
function generateHash(entityType: VersionEntityType, content: any): string {
  switch (entityType) {
    case 'page_layers':
      return generatePageLayersHash(content);
    case 'component':
      return generateComponentContentHash(content);
    case 'layer_style':
      return generateLayerStyleContentHash(content);
    default:
      return 'unknown';
  }
}

// Track if we're in an undo/redo save operation (persists across async calls)
const undoRedoSaveInProgress = new Set<string>();

// Auto-clear timeouts for undo/redo marks (in case save fails or gets stuck)
const undoRedoSaveTimeouts = new Map<string, NodeJS.Timeout>();

// Maximum time to keep an undo/redo save mark active (10 seconds)
const UNDO_REDO_MARK_TIMEOUT = 10000;

/**
 * Mark entity as being saved during undo/redo (call before save)
 * Automatically clears after UNDO_REDO_MARK_TIMEOUT to prevent getting stuck
 */
export function markUndoRedoSave(entityType: VersionEntityType, entityId: string): void {
  const key = `${entityType}:${entityId}`;

  // Clear any existing timeout
  const existingTimeout = undoRedoSaveTimeouts.get(key);
  if (existingTimeout) {
    clearTimeout(existingTimeout);
  }

  // Mark as in progress
  undoRedoSaveInProgress.add(key);

  // Set auto-clear timeout as a safety mechanism
  const timeout = setTimeout(() => {
    undoRedoSaveInProgress.delete(key);
    undoRedoSaveTimeouts.delete(key);
  }, UNDO_REDO_MARK_TIMEOUT);

  undoRedoSaveTimeouts.set(key, timeout);
}

/**
 * Clear undo/redo save mark (call after save completes)
 */
export function clearUndoRedoSave(entityType: VersionEntityType, entityId: string): void {
  const key = `${entityType}:${entityId}`;

  // Clear the mark
  undoRedoSaveInProgress.delete(key);

  // Clear the timeout
  const timeout = undoRedoSaveTimeouts.get(key);
  if (timeout) {
    clearTimeout(timeout);
    undoRedoSaveTimeouts.delete(key);
  }
}

/**
 * Record a version via API (client-safe, no server-only imports)
 */
export async function recordVersionViaApi(
  entityType: VersionEntityType,
  entityId: string,
  currentState: any
): Promise<void> {
  const entityKey = `${entityType}:${entityId}`;

  // Check if this save was triggered during an undo/redo operation
  if (undoRedoSaveInProgress.has(entityKey)) {
    // Update cache only, don't create version
    initializeVersionTracking(entityType, entityId, currentState);
    undoRedoSaveInProgress.delete(entityKey);
    return;
  }

  // Also check the store flag for backward compatibility
  const { useVersionsStore } = await import('@/stores/useVersionsStore');
  const isUndoRedoInProgress = useVersionsStore.getState().isUndoRedoInProgress;

  if (isUndoRedoInProgress) {
    // Update cache only, don't create version
    initializeVersionTracking(entityType, entityId, currentState);
    return;
  }

  const previousState = getPreviousState(entityType, entityId);

  // Skip if no previous state (first save)
  if (!previousState) {
    // Initialize with current state for future comparisons
    initializeVersionTracking(entityType, entityId, currentState);
    return;
  }

  // Create patch from previous to current state
  const redoPatch = createPatch(previousState, currentState);

  // Skip if no changes
  if (isPatchEmpty(redoPatch)) {
    return;
  }

  // Verify the patch actually produces a different state
  // This catches patches that exist but don't change anything
  if (!doesPatchChangeState(previousState, redoPatch)) {
    return;
  }

  // Create inverse patch for undo (arguments: originalState, forwardPatch)
  const undoPatch = createInversePatch(previousState, redoPatch);

  // Generate hashes for integrity
  const previousHash = generateHash(entityType, previousState);
  const currentHash = generateHash(entityType, currentState);

  // Generate description
  const description = generatePatchDescription(redoPatch);

  // Capture UI metadata (selected layers, etc.)
  // Pass the patch to intelligently determine which layer to select
  const metadata = captureUIMetadata(entityType, entityId, redoPatch as any, currentState);

  // Prepare version data
  const versionData: CreateVersionData = {
    entity_type: entityType,
    entity_id: entityId,
    action_type: 'update',
    description,
    redo: redoPatch,
    undo: undoPatch,
    previous_hash: previousHash,
    current_hash: currentHash,
    session_id: getSessionId(),
    metadata,
  };

  try {
    const response = await fetch('/api/versions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(versionData),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Failed to record version:', error);
      return;
    }

    const result = await response.json();

    // Update the versions store with the new version
    if (result.data) {
      // Dynamic import to avoid circular dependencies
      const { useVersionsStore } = await import('@/stores/useVersionsStore');
      useVersionsStore.getState().recordVersion(result.data);

      // Notify that save completed (for clearing local undo buffers)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('versionSaved', {
          detail: { entityType, entityId }
        }));
      }
    }

    // Update the previous state cache
    initializeVersionTracking(entityType, entityId, currentState);
  } catch (error) {
    console.error('Failed to record version:', error);
  }
}

/**
 * Get or generate session ID for tracking related operations
 */
function getSessionId(): string {
  if (typeof window === 'undefined') return 'server';

  let sessionId = sessionStorage.getItem('ycode-session-id');
  if (!sessionId) {
    sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('ycode-session-id', sessionId);
  }
  return sessionId;
}

/**
 * Extract affected layer IDs from a JSON Patch
 * Analyzes patch operations to determine which layers were modified
 */
function getAffectedLayerIds(patch: any[]): string[] {
  if (!Array.isArray(patch) || patch.length === 0) return [];

  const affectedIds = new Set<string>();

  for (const operation of patch) {
    if (!operation.path) continue;

    // Parse the path to extract layer IDs
    // Paths look like: /0/id, /0/children/0/id, /0/design/background, etc.
    const pathParts = operation.path.split('/').filter(Boolean);

    // For layer arrays (page_layers, component), look for operations on specific indices
    // Operation types that indicate a layer was affected:
    // - add: new layer added
    // - remove: layer removed
    // - replace: layer or property modified

    if (operation.op === 'add' && operation.value) {
      // Added a new layer - value should contain the layer with its ID
      if (operation.value.id) {
        affectedIds.add(operation.value.id);
      }
    }

    if (operation.op === 'remove' && operation.value) {
      // Removed a layer - value contains the removed layer
      if (operation.value.id) {
        affectedIds.add(operation.value.id);
      }
    }

    if (operation.op === 'replace') {
      // Try to find layer ID in the path or value
      // Path patterns:
      // - /0 - replacing entire layer at index 0
      // - /0/design - modifying design property of layer at index 0
      // - /0/children/1/id - modifying nested layer

      if (operation.value?.id) {
        affectedIds.add(operation.value.id);
      }

      // Extract layer ID from path if it's a property change
      // Look for /id in the path or traverse up to find the layer
      const idIndex = pathParts.indexOf('id');
      if (idIndex > 0 && operation.value && typeof operation.value === 'string') {
        // This is likely /X/id or /X/children/Y/id being set
        affectedIds.add(operation.value);
      }
    }
  }

  return Array.from(affectedIds);
}

/**
 * Get the most appropriate layer ID to select based on the changes
 * Priority:
 * 1. Newly added layer (from patch)
 * 2. Modified layer (from patch)
 * 3. Current selected layer (if still exists)
 * 4. Last selected layer (fallback)
 */
function getAppropriateLayerSelection(
  patch: any[],
  currentState: any,
  currentSelectedLayerId: string | null,
  lastSelectedLayerId: string | null
): { selectedLayerId: string | null; selectedLayerIds: string[] } {
  // Get affected layer IDs from the patch
  const affectedIds = getAffectedLayerIds(patch);

  // Priority 1: If a new layer was added, select it
  const addedLayers = patch.filter(op => op.op === 'add' && op.value?.id);
  if (addedLayers.length > 0) {
    const newLayerId = addedLayers[addedLayers.length - 1].value.id;
    return {
      selectedLayerId: newLayerId,
      selectedLayerIds: [newLayerId],
    };
  }

  // Priority 2: If layers were modified, select the first affected layer that still exists
  if (affectedIds.length > 0) {
    // Verify the layer still exists in current state
    for (const layerId of affectedIds) {
      if (layerExistsInState(currentState, layerId)) {
        return {
          selectedLayerId: layerId,
          selectedLayerIds: [layerId],
        };
      }
    }
  }

  // Priority 3: Keep current selection if it still exists
  if (currentSelectedLayerId && layerExistsInState(currentState, currentSelectedLayerId)) {
    return {
      selectedLayerId: currentSelectedLayerId,
      selectedLayerIds: [currentSelectedLayerId],
    };
  }

  // Priority 4: Fall back to last selected layer
  if (lastSelectedLayerId && layerExistsInState(currentState, lastSelectedLayerId)) {
    return {
      selectedLayerId: lastSelectedLayerId,
      selectedLayerIds: [lastSelectedLayerId],
    };
  }

  // No valid selection
  return {
    selectedLayerId: null,
    selectedLayerIds: [],
  };
}

/**
 * Check if a layer exists in the state (for page_layers/component)
 */
function layerExistsInState(state: any, layerId: string): boolean {
  if (!state || !Array.isArray(state)) return false;

  function searchLayers(layers: any[]): boolean {
    for (const layer of layers) {
      if (layer.id === layerId) return true;
      if (layer.children && Array.isArray(layer.children)) {
        if (searchLayers(layer.children)) return true;
      }
    }
    return false;
  }

  return searchLayers(state);
}

/**
 * Capture UI metadata for restoring context after undo/redo
 * Intelligently determines which layer to select based on the changes made
 */
function captureUIMetadata(
  entityType: VersionEntityType,
  entityId: string,
  patch?: any[],
  currentState?: any
): object | null {
  if (typeof window === 'undefined') return null;

  try {
    const metadata: any = {};

    if (entityType === 'page_layers' || entityType === 'component') {
      // Get current editor state
      const editorState = useEditorStore.getState();
      const currentSelectedLayerId = editorState.selectedLayerId || null;
      const lastSelectedLayerId = editorState.lastSelectedLayerId || null;

      // Intelligently determine which layer to select based on changes
      if (patch && currentState) {
        const selection = getAppropriateLayerSelection(
          patch,
          currentState,
          currentSelectedLayerId,
          lastSelectedLayerId
        );

        metadata.selectedLayerId = selection.selectedLayerId;
        metadata.selectedLayerIds = selection.selectedLayerIds;
        metadata.lastSelectedLayerId = lastSelectedLayerId;
      } else {
        // No patch provided - use current selection as fallback
        metadata.selectedLayerIds = editorState.selectedLayerIds || [];
        metadata.lastSelectedLayerId = lastSelectedLayerId;
        metadata.selectedLayerId = currentSelectedLayerId;
      }
    }

    return Object.keys(metadata).length > 0 ? metadata : null;
  } catch (error) {
    console.warn('Failed to capture UI metadata:', error);
    return null;
  }
}
