'use client';

import { create } from 'zustand';
import { EditorState } from '../types';
import type { Layer } from '../types';

interface HistoryEntry {
  pageId: string;
  layers: Layer[];
  timestamp: number;
}

interface EditorActions {
  setSelectedLayerId: (id: string | null) => void;
  setCurrentPageId: (id: string | null) => void;
  setLoading: (value: boolean) => void;
  setSaving: (value: boolean) => void;
  pushHistory: (pageId: string, layers: Layer[]) => void;
  undo: () => HistoryEntry | null;
  redo: () => HistoryEntry | null;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

interface EditorStoreWithHistory extends EditorState {
  history: HistoryEntry[];
  historyIndex: number;
  maxHistorySize: number;
}

type EditorStore = EditorStoreWithHistory & EditorActions;

export const useEditorStore = create<EditorStore>((set, get) => ({
  selectedLayerId: null,
  currentPageId: null,
  isDragging: false,
  isLoading: false,
  isSaving: false,
  history: [],
  historyIndex: -1,
  maxHistorySize: 50,
  
  setSelectedLayerId: (id) => set({ selectedLayerId: id }),
  setCurrentPageId: (id) => set({ currentPageId: id }),
  setLoading: (value) => set({ isLoading: value }),
  setSaving: (value) => set({ isSaving: value }),
  
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
}));



