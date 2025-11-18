'use client';

/**
 * Clipboard Store
 * 
 * Global clipboard state for layer operations (cut, copy, paste)
 * Works across different pages
 */

import { create } from 'zustand';
import type { Layer } from '../types';

interface CopiedStyle {
  classes: string;
  design?: Layer['design'];
  styleId?: string;
  styleOverrides?: Layer['styleOverrides'];
}

interface ClipboardState {
  clipboardLayer: Layer | null;
  clipboardMode: 'copy' | 'cut' | null;
  sourcePageId: string | null;
  copiedStyle: CopiedStyle | null;
}

interface ClipboardActions {
  copyLayer: (layer: Layer, pageId: string) => void;
  cutLayer: (layer: Layer, pageId: string) => void;
  clearClipboard: () => void;
  copyStyle: (classes: string, design?: Layer['design'], styleId?: string, styleOverrides?: Layer['styleOverrides']) => void;
  pasteStyle: () => CopiedStyle | null;
  clearStyle: () => void;
}

type ClipboardStore = ClipboardState & ClipboardActions;

export const useClipboardStore = create<ClipboardStore>((set, get) => ({
  clipboardLayer: null,
  clipboardMode: null,
  sourcePageId: null,
  copiedStyle: null,

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

  copyStyle: (classes, design, styleId, styleOverrides) => {
    set({
      copiedStyle: {
        classes,
        design,
        styleId,
        styleOverrides,
      },
    });
  },

  pasteStyle: () => {
    return get().copiedStyle;
  },

  clearStyle: () => {
    set({
      copiedStyle: null,
    });
  },
}));
