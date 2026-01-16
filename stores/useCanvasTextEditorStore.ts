/**
 * Canvas Text Editor Store
 *
 * Manages the state of the inline text editor in the canvas.
 * Allows the toolbar in CenterCanvas to communicate with the editor in the iframe.
 */

import { create } from 'zustand';
import type { Editor } from '@tiptap/react';

interface CanvasTextEditorState {
  /** Whether text editing is active */
  isEditing: boolean;
  /** The Tiptap editor instance */
  editor: Editor | null;
  /** ID of the layer currently being edited */
  editingLayerId: string | null;
  /** Currently active formatting marks */
  activeMarks: {
    bold: boolean;
    italic: boolean;
    underline: boolean;
    strike: boolean;
    bulletList: boolean;
    orderedList: boolean;
  };
}

interface CanvasTextEditorActions {
  /** Set the editor instance when CanvasTextEditor mounts */
  setEditor: (editor: Editor | null) => void;
  /** Start editing mode */
  startEditing: (layerId: string) => void;
  /** Stop editing mode */
  stopEditing: () => void;
  /** Request to finish editing (triggers save and close) */
  requestFinish: () => void;
  /** Callback for when finish is requested (set by CanvasTextEditor) */
  onFinishCallback: (() => void) | null;
  /** Set the finish callback */
  setOnFinishCallback: (callback: (() => void) | null) => void;
  /** Update active marks based on editor state */
  updateActiveMarks: () => void;
  /** Toggle bold formatting */
  toggleBold: () => void;
  /** Toggle italic formatting */
  toggleItalic: () => void;
  /** Toggle underline formatting */
  toggleUnderline: () => void;
  /** Toggle strikethrough formatting */
  toggleStrike: () => void;
  /** Toggle bullet list */
  toggleBulletList: () => void;
  /** Toggle ordered list */
  toggleOrderedList: () => void;
  /** Focus the editor */
  focusEditor: () => void;
}

type CanvasTextEditorStore = CanvasTextEditorState & CanvasTextEditorActions;

export const useCanvasTextEditorStore = create<CanvasTextEditorStore>((set, get) => ({
  // State
  isEditing: false,
  editor: null,
  editingLayerId: null,
  activeMarks: {
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    bulletList: false,
    orderedList: false,
  },
  onFinishCallback: null,

  // Actions
  setEditor: (editor) => {
    set({ editor });
    if (editor) {
      get().updateActiveMarks();
    }
  },

  startEditing: (layerId) => set({
    isEditing: true,
    editingLayerId: layerId,
  }),

  stopEditing: () => set({
    isEditing: false,
    editor: null,
    editingLayerId: null,
    activeMarks: {
      bold: false,
      italic: false,
      underline: false,
      strike: false,
      bulletList: false,
      orderedList: false,
    },
    onFinishCallback: null,
  }),

  requestFinish: () => {
    const { onFinishCallback } = get();
    if (onFinishCallback) {
      onFinishCallback();
    }
  },

  setOnFinishCallback: (callback) => set({ onFinishCallback: callback }),

  updateActiveMarks: () => {
    const { editor } = get();
    if (!editor) return;

    set({
      activeMarks: {
        bold: editor.isActive('bold'),
        italic: editor.isActive('italic'),
        underline: editor.isActive('underline'),
        strike: editor.isActive('strike'),
        bulletList: editor.isActive('bulletList'),
        orderedList: editor.isActive('orderedList'),
      },
    });
  },

  toggleBold: () => {
    const { editor } = get();
    if (!editor) return;
    editor.chain().focus().toggleBold().run();
    get().updateActiveMarks();
  },

  toggleItalic: () => {
    const { editor } = get();
    if (!editor) return;
    editor.chain().focus().toggleItalic().run();
    get().updateActiveMarks();
  },

  toggleUnderline: () => {
    const { editor } = get();
    if (!editor) return;
    editor.chain().focus().toggleUnderline().run();
    get().updateActiveMarks();
  },

  toggleStrike: () => {
    const { editor } = get();
    if (!editor) return;
    editor.chain().focus().toggleStrike().run();
    get().updateActiveMarks();
  },

  toggleBulletList: () => {
    const { editor } = get();
    if (!editor) return;
    editor.chain().focus().toggleBulletList().run();
    get().updateActiveMarks();
  },

  toggleOrderedList: () => {
    const { editor } = get();
    if (!editor) return;
    editor.chain().focus().toggleOrderedList().run();
    get().updateActiveMarks();
  },

  focusEditor: () => {
    const { editor } = get();
    if (!editor || !editor.view) return;
    try {
      editor.commands.focus();
    } catch (error) {
      console.warn('Failed to focus editor:', error);
    }
  },
}));
