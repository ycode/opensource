/**
 * Version Service
 *
 * Handles version tracking for undo/redo functionality
 * Integrates with save operations to record changes
 */

import type { Layer, VersionEntityType, CreateVersionData } from '@/types';
import { createPatch, createInversePatch, isPatchEmpty, generatePatchDescription, JsonPatch } from '@/lib/version-utils';
import { generatePageLayersHash, generateComponentContentHash, generateLayerStyleContentHash } from '@/lib/hash-utils';

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
 * Set the previous state for an entity (call after successful save)
 */
export function setPreviousState(entityType: VersionEntityType, entityId: string, state: any): void {
  previousStatesCache.set(getCacheKey(entityType, entityId), JSON.parse(JSON.stringify(state)));
}

/**
 * Clear the previous state for an entity
 */
export function clearPreviousState(entityType: VersionEntityType, entityId: string): void {
  previousStatesCache.delete(getCacheKey(entityType, entityId));
}

/**
 * Check if we should store a full snapshot (every 10 versions)
 */
async function shouldStoreSnapshot(entityType: VersionEntityType, entityId: string): Promise<boolean> {
  try {
    const { getVersionCount } = await import('@/lib/repositories/versionRepository');
    const count = await getVersionCount(entityType, entityId);
    return count > 0 && count % 10 === 0;
  } catch (error) {
    return false;
  }
}

/**
 * Generate content hash based on entity type
 */
function generateHash(entityType: VersionEntityType, state: any): string {
  switch (entityType) {
    case 'page_layers':
      return generatePageLayersHash({ layers: state, generated_css: null });
    case 'component':
      return generateComponentContentHash({ name: '', layers: state });
    case 'layer_style':
      return generateLayerStyleContentHash({ name: '', classes: state.classes || '', design: state.design });
    default:
      return generatePageLayersHash({ layers: state, generated_css: null });
  }
}

/**
 * Record a version for an entity (to be called after save operations)
 * This is the main function to integrate with stores
 */
export async function recordVersion(
  entityType: VersionEntityType,
  entityId: string,
  currentState: any,
  sessionId?: string,
  description?: string
): Promise<void> {
  // Don't record during undo/redo operations
  const { useVersionsStore } = await import('@/stores/useVersionsStore');
  if (useVersionsStore.getState().isUndoRedoInProgress) {
    return;
  }

  try {
    const previousState = getPreviousState(entityType, entityId);

    // Skip if no previous state (first save initializes cache)
    if (!previousState) {
      setPreviousState(entityType, entityId, currentState);
      return;
    }

    // Create patch
    const patch = createPatch(previousState, currentState);

    // Skip if no actual changes
    if (isPatchEmpty(patch)) {
      return;
    }

    // Create inverse patch for undo
    const inversePatch = createInversePatch(previousState, patch);

    // Generate hashes
    const previousHash = generateHash(entityType, previousState);
    const currentHash = generateHash(entityType, currentState);

    // Check if we should store a snapshot
    let snapshot: any = null;
    if (await shouldStoreSnapshot(entityType, entityId)) {
      snapshot = currentState;
    }

    // Generate description if not provided
    const finalDescription = description || generatePatchDescription(patch);

    // Get session ID
    const finalSessionId = sessionId || useVersionsStore.getState().getSessionId();

    // Create version via API
    const versionData: CreateVersionData = {
      entity_type: entityType,
      entity_id: entityId,
      action_type: 'update',
      description: finalDescription,
      redo: patch,
      undo: inversePatch,
      snapshot,
      previous_hash: previousHash,
      current_hash: currentHash,
      session_id: finalSessionId,
    };

    const response = await fetch('/ycode/api/versions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(versionData),
    });

    const result = await response.json();

    if (result.data) {
      // Record in store
      useVersionsStore.getState().recordVersion(result.data);

      // Update previous state cache
      setPreviousState(entityType, entityId, currentState);
    }
  } catch (error) {
    console.error('Failed to record version:', error);
    // Don't throw - version recording should not break save operations
  }
}

/**
 * Record initial state for an entity (call when loading/initializing)
 */
export function initializeVersionTracking(
  entityType: VersionEntityType,
  entityId: string,
  initialState: any
): void {
  setPreviousState(entityType, entityId, initialState);
}

/**
 * Apply an undo operation for page layers
 */
export async function applyUndoForPageLayers(
  pageId: string,
  version: { undo?: object; snapshot?: object }
): Promise<Layer[] | null> {
  const { usePagesStore } = await import('@/stores/usePagesStore');
  const draft = usePagesStore.getState().draftsByPageId[pageId];

  if (!draft) return null;

  // Use undo patch if available
  if (version.undo) {
    const { applyPatch } = await import('@/lib/version-utils');
    const restoredLayers = applyPatch(draft.layers, version.undo as JsonPatch);
    return restoredLayers;
  }

  // Fall back to snapshot
  if (version.snapshot) {
    return version.snapshot as Layer[];
  }

  return null;
}

/**
 * Apply a redo operation for page layers
 */
export async function applyRedoForPageLayers(
  pageId: string,
  version: { redo?: object } | null
): Promise<Layer[] | null> {
  // If version is null, restore to latest from database
  if (!version) {
    const { usePagesStore } = await import('@/stores/usePagesStore');
    await usePagesStore.getState().loadDraft(pageId);
    return usePagesStore.getState().draftsByPageId[pageId]?.layers || null;
  }

  const { usePagesStore } = await import('@/stores/usePagesStore');
  const draft = usePagesStore.getState().draftsByPageId[pageId];

  if (!draft || !version.redo) return null;

  const { applyPatch } = await import('@/lib/version-utils');
  const newLayers = applyPatch(draft.layers, version.redo as JsonPatch);
  return newLayers;
}
