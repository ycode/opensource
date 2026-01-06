'use client';

import { create } from 'zustand';
import { EditorState, UIState } from '../types';
import type { Layer, Breakpoint, Asset } from '../types';

interface HistoryEntry {
  pageId: string;
  layers: Layer[];
  timestamp: number;
}

interface EditorActions {
  setSelectedLayerId: (id: string | null) => void;
  setSelectedLayerIds: (ids: string[]) => void;
  addToSelection: (id: string) => void;
  toggleSelection: (id: string) => void;
  selectRange: (fromId: string, toId: string, flattenedLayers: any[]) => void;
  clearSelection: () => void;
  setCurrentPageId: (id: string | null) => void;
  setCurrentPageCollectionItemId: (id: string | null) => void;
  setLoading: (value: boolean) => void;
  setSaving: (value: boolean) => void;
  setActiveBreakpoint: (breakpoint: Breakpoint) => void;
  setActiveUIState: (state: UIState) => void;
  setEditingComponentId: (id: string | null, returnPageId?: string | null) => void;
  setBuilderDataPreloaded: (preloaded: boolean) => void;
  pushHistory: (pageId: string, layers: Layer[]) => void;
  undo: () => HistoryEntry | null;
  redo: () => HistoryEntry | null;
  canUndo: () => boolean;
  canRedo: () => boolean;
  setInteractionHighlights: (triggerIds: string[], targetIds: string[]) => void;
  setActiveInteraction: (triggerId: string | null, targetIds: string[]) => void;
  clearActiveInteraction: () => void;
  openCollectionItemSheet: (collectionId: string, itemId: string) => void;
  closeCollectionItemSheet: () => void;
  setHoveredLayerId: (id: string | null) => void;
  setPreviewMode: (enabled: boolean) => void;
  openFileManager: (onSelect?: ((asset: Asset) => void) | null) => void;
  closeFileManager: () => void;
}

interface EditorStoreWithHistory extends EditorState {
  history: HistoryEntry[];
  historyIndex: number;
  maxHistorySize: number;
  editingComponentId: string | null;
  returnToPageId: string | null;
  currentPageCollectionItemId: string | null;
  builderDataPreloaded: boolean;
  interactionTriggerLayerIds: string[];
  interactionTargetLayerIds: string[];
  activeInteractionTriggerLayerId: string | null;
  activeInteractionTargetLayerIds: string[];
  collectionItemSheet: {
    open: boolean;
    collectionId: string;
    itemId: string;
  } | null;
  hoveredLayerId: string | null;
  isPreviewMode: boolean;
  fileManager: {
    open: boolean;
    onSelect: ((asset: Asset) => void) | null;
  };
}

type EditorStore = EditorStoreWithHistory & EditorActions;

export const useEditorStore = create<EditorStore>((set, get) => ({
  selectedLayerId: null,
  selectedLayerIds: [],
  lastSelectedLayerId: null,
  currentPageId: null,
  isDragging: false,
  isLoading: false,
  isSaving: false,
  activeBreakpoint: 'desktop' as Breakpoint,
  activeUIState: 'neutral' as UIState,
  history: [],
  historyIndex: -1,
  maxHistorySize: 50,
  editingComponentId: null,
  returnToPageId: null,
  currentPageCollectionItemId: null,
  builderDataPreloaded: false,
  interactionTriggerLayerIds: [],
  interactionTargetLayerIds: [],
  activeInteractionTriggerLayerId: null,
  activeInteractionTargetLayerIds: [],
  collectionItemSheet: null,
  hoveredLayerId: null,
  isPreviewMode: false,
  fileManager: {
    open: false,
    onSelect: null,
  },

  setSelectedLayerId: (id) => {
    // Legacy support - also update selectedLayerIds
    set({
      selectedLayerId: id,
      selectedLayerIds: id ? [id] : [],
      lastSelectedLayerId: id
    });
  },

  setSelectedLayerIds: (ids) => {
    // Update both for compatibility
    set({
      selectedLayerIds: ids,
      selectedLayerId: ids.length === 1 ? ids[0] : (ids.length > 0 ? ids[ids.length - 1] : null),
      lastSelectedLayerId: ids.length > 0 ? ids[ids.length - 1] : null
    });
  },

  addToSelection: (id) => {
    const { selectedLayerIds } = get();
    if (!selectedLayerIds.includes(id)) {
      const newIds = [...selectedLayerIds, id];
      set({
        selectedLayerIds: newIds,
        selectedLayerId: newIds.length === 1 ? newIds[0] : id,
        lastSelectedLayerId: id
      });
    }
  },

  toggleSelection: (id) => {
    const { selectedLayerIds } = get();
    let newIds: string[];

    if (selectedLayerIds.includes(id)) {
      // Remove from selection
      newIds = selectedLayerIds.filter(layerId => layerId !== id);
    } else {
      // Add to selection
      newIds = [...selectedLayerIds, id];
    }

    set({
      selectedLayerIds: newIds,
      selectedLayerId: newIds.length === 1 ? newIds[0] : (newIds.length > 0 ? newIds[newIds.length - 1] : null),
      lastSelectedLayerId: newIds.length > 0 ? id : null
    });
  },

  selectRange: (fromId, toId, flattenedLayers) => {
    // Find indices in flattened array
    const fromIndex = flattenedLayers.findIndex((node: any) => node.id === fromId);
    const toIndex = flattenedLayers.findIndex((node: any) => node.id === toId);

    if (fromIndex === -1 || toIndex === -1) return;

    // Get range (handle both directions)
    const start = Math.min(fromIndex, toIndex);
    const end = Math.max(fromIndex, toIndex);

    const rangeIds = flattenedLayers
      .slice(start, end + 1)
      .map((node: any) => node.id)
      .filter((id: string) => id !== 'body'); // Exclude body layer

    set({
      selectedLayerIds: rangeIds,
      selectedLayerId: rangeIds.length === 1 ? rangeIds[0] : toId,
      lastSelectedLayerId: toId
    });
  },

  clearSelection: () => {
    set({
      selectedLayerIds: [],
      selectedLayerId: null,
      lastSelectedLayerId: null
    });
  },

  setCurrentPageId: (id) => set({
    currentPageId: id,
    activeUIState: 'neutral', // Reset to neutral on page change
    currentPageCollectionItemId: null // Clear selected item when page changes
  }),
  setCurrentPageCollectionItemId: (id) => set({ currentPageCollectionItemId: id }),
  setLoading: (value) => set({ isLoading: value }),
  setSaving: (value) => set({ isSaving: value }),
  setActiveBreakpoint: (breakpoint) => set({ activeBreakpoint: breakpoint }),
  setActiveUIState: (state) => set({ activeUIState: state }),
  setEditingComponentId: (id, returnPageId = null) => set({
    editingComponentId: id,
    returnToPageId: returnPageId,
  }),
  setBuilderDataPreloaded: (preloaded) => set({ builderDataPreloaded: preloaded }),

  pushHistory: (pageId, layers) => {
    const { history, historyIndex, maxHistorySize } = get();

    // Remove any entries after current index (if we're in the middle of history)
    const newHistory = history.slice(0, historyIndex + 1);

    // Add new entry
    newHistory.push({
      pageId,
      layers: JSON.parse(JSON.stringify(layers)), // Deep clone
      timestamp: Date.now(),
    });

    // Limit history size
    if (newHistory.length > maxHistorySize) {
      newHistory.shift();
    } else {
      set({ historyIndex: historyIndex + 1 });
    }

    set({ history: newHistory });
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      set({ historyIndex: historyIndex - 1 });
      return history[historyIndex - 1];
    }
    return null;
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      set({ historyIndex: historyIndex + 1 });
      return history[historyIndex + 1];
    }
    return null;
  },

  canUndo: () => {
    const { historyIndex } = get();
    return historyIndex > 0;
  },

  canRedo: () => {
    const { history, historyIndex } = get();
    return historyIndex < history.length - 1;
  },

  setInteractionHighlights: (triggerIds, targetIds) => set({
    interactionTriggerLayerIds: triggerIds,
    interactionTargetLayerIds: targetIds,
  }),

  setActiveInteraction: (triggerId, targetIds) => set({
    activeInteractionTriggerLayerId: triggerId,
    activeInteractionTargetLayerIds: targetIds,
  }),

  clearActiveInteraction: () => set({
    activeInteractionTriggerLayerId: null,
    activeInteractionTargetLayerIds: [],
  }),

  openCollectionItemSheet: (collectionId, itemId) => set({
    collectionItemSheet: {
      open: true,
      collectionId,
      itemId,
    },
  }),

  closeCollectionItemSheet: () => set({
    collectionItemSheet: null,
  }),

  setHoveredLayerId: (id) => set({ hoveredLayerId: id }),

  setPreviewMode: (enabled) => set({ isPreviewMode: enabled }),

  openFileManager: (onSelect) => set({
    fileManager: {
      open: true,
      onSelect: onSelect ?? null,
    },
  }),

  closeFileManager: () => set({
    fileManager: {
      open: false,
      onSelect: null,
    },
  }),
}));
