'use client';

/**
 * Clipboard Store
 * 
 * Global clipboard state for layer operations (cut, copy, paste)
 * Works across different pages
 */

import { create } from 'zustand';
import type { Layer } from '../types';

interface ClipboardState {
  clipboardLayer: Layer | null;
  clipboardMode: 'copy' | 'cut' | null;
  sourcePageId: string | null;
}

interface ClipboardActions {
  copyLayer: (layer: Layer, pageId: string) => void;
  cutLayer: (layer: Layer, pageId: string) => void;
  clearClipboard: () => void;
}

type ClipboardStore = ClipboardState & ClipboardActions;

export const useClipboardStore = create<ClipboardStore>((set) => ({
  clipboardLayer: null,
  clipboardMode: null,
  sourcePageId: null,

  copyLayer: (layer, pageId) => {
    set({
      clipboardLayer: layer,
      clipboardMode: 'copy',
      sourcePageId: pageId,
    });
  },

  cutLayer: (layer, pageId) => {
    set({
      clipboardLayer: layer,
      clipboardMode: 'cut',
      sourcePageId: pageId,
    });
  },

  clearClipboard: () => {
    set({
      clipboardLayer: null,
      clipboardMode: null,
      sourcePageId: null,
    });
  },
}));

