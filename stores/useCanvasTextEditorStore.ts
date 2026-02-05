/**
 * Canvas Text Editor Store
 *
 * Manages the state of the inline text editor in the canvas.
 * Allows the toolbar in CenterCanvas to communicate with the editor in the iframe.
 */

import { create } from 'zustand';
import type { Editor } from '@tiptap/react';
import type { FieldVariable } from '@/types';
import { getVariableLabel } from '@/lib/cms-variables-utils';
import type { CollectionField } from '@/types';
import { useEditorStore } from './useEditorStore';
import { generateId } from '@/lib/utils';

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
    subscript: boolean;
    superscript: boolean;
    bulletList: boolean;
    orderedList: boolean;
    /** Whether text has a link mark */
    richTextLink: boolean;
    /** Active dynamic style key (if any) */
    dynamicStyleKey: string | null;
    /** Active heading level (1-6) or null if not in a heading */
    headingLevel: 1 | 2 | 3 | 4 | 5 | 6 | null;
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
  /** Callback for saving content (set by CanvasTextEditor) */
  onSaveCallback: (() => void) | null;
  /** Set the save callback */
  setOnSaveCallback: (callback: (() => void) | null) => void;
  /** Trigger a content save without finishing */
  triggerSave: () => void;
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
  /** Toggle subscript formatting */
  toggleSubscript: () => void;
  /** Toggle superscript formatting */
  toggleSuperscript: () => void;
  /** Toggle bullet list */
  toggleBulletList: () => void;
  /** Toggle ordered list */
  toggleOrderedList: () => void;
  /** Toggle heading level (1-6) or set to paragraph (null) */
  setHeading: (level: 1 | 2 | 3 | 4 | 5 | 6 | null) => void;
  /** Toggle custom style formatting */
  toggleCustomStyle: () => void;
  /** Focus the editor */
  focusEditor: () => void;
  /** Add a field variable at the current cursor position */
  addFieldVariable: (
    variableData: FieldVariable,
    fields?: CollectionField[],
    allFields?: Record<string, CollectionField[]>
  ) => void;
  /** Check if there's a text selection (not just cursor position) */
  hasTextSelection: () => boolean;
  /** Ensure dynamicStyle mark is applied to selection, returns the active text style key */
  ensureDynamicStyleApplied: () => string | null;
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
    subscript: false,
    superscript: false,
    bulletList: false,
    orderedList: false,
    richTextLink: false,
    dynamicStyleKey: null,
    headingLevel: null,
  },
  onFinishCallback: null,
  onSaveCallback: null,

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

  stopEditing: () => {
    // NOTE: Don't reset activeTextStyleKey here because stopEditing is called
    // during editor remounts (e.g., when textStyles change). Only clear it
    // when we actually finish editing (via requestFinish).

    set({
      isEditing: false,
      editor: null,
      editingLayerId: null,
      activeMarks: {
        bold: false,
        italic: false,
        underline: false,
        strike: false,
        subscript: false,
        superscript: false,
        bulletList: false,
        orderedList: false,
        richTextLink: false,
        dynamicStyleKey: null,
        headingLevel: null,
      },
      onFinishCallback: null,
      onSaveCallback: null,
    });
  },

  requestFinish: () => {
    const { onFinishCallback } = get();

    // Clear active text style key when actually finishing editing
    const setActiveTextStyleKey = useEditorStore.getState().setActiveTextStyleKey;
    setActiveTextStyleKey(null);

    if (onFinishCallback) {
      onFinishCallback();
    }
  },

  setOnFinishCallback: (callback) => set({ onFinishCallback: callback }),

  setOnSaveCallback: (callback) => set({ onSaveCallback: callback }),

  triggerSave: () => {
    const { onSaveCallback } = get();
    if (onSaveCallback) {
      onSaveCallback();
    }
  },

  updateActiveMarks: () => {
    const { editor } = get();
    if (!editor) return;

    // Check for dynamicStyle mark and get the last styleKey from the array
    let dynamicStyleKey: string | null = null;
    if (editor.isActive('dynamicStyle')) {
      const attrs = editor.getAttributes('dynamicStyle');
      const styleKeys: string[] = attrs?.styleKeys || [];
      // Use the last (most recently added) styleKey
      dynamicStyleKey = styleKeys.length > 0 ? styleKeys[styleKeys.length - 1] : null;
    }

    // Check for heading level
    let headingLevel: 1 | 2 | 3 | 4 | 5 | 6 | null = null;
    for (const level of [1, 2, 3, 4, 5, 6] as const) {
      if (editor.isActive('heading', { level })) {
        headingLevel = level;
        break;
      }
    }

    const activeMarks = {
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      underline: editor.isActive('underline'),
      strike: editor.isActive('strike'),
      subscript: editor.isActive('subscript'),
      superscript: editor.isActive('superscript'),
      bulletList: editor.isActive('bulletList'),
      orderedList: editor.isActive('orderedList'),
      richTextLink: editor.isActive('richTextLink'),
      dynamicStyleKey,
      headingLevel,
    };

    set({ activeMarks });

    // Update active text style key in editor store based on active marks
    // ONLY if the editor is focused (to prevent switching styles during content refresh)
    if (!editor.isFocused) return;

    const setActiveTextStyleKey = useEditorStore.getState().setActiveTextStyleKey;

    // Determine which text style is active (prioritize dynamicStyle, then inline marks, then block styles)
    let textStyleKey: string | null = null;
    if (dynamicStyleKey) {
      textStyleKey = dynamicStyleKey;
    } else if (activeMarks.bold) {
      textStyleKey = 'bold';
    } else if (activeMarks.italic) {
      textStyleKey = 'italic';
    } else if (activeMarks.underline) {
      textStyleKey = 'underline';
    } else if (activeMarks.strike) {
      textStyleKey = 'strike';
    } else if (activeMarks.subscript) {
      textStyleKey = 'subscript';
    } else if (activeMarks.superscript) {
      textStyleKey = 'superscript';
    } else if (headingLevel) {
      textStyleKey = `h${headingLevel}`;
    } else if (activeMarks.bulletList) {
      textStyleKey = 'bulletList';
    } else if (activeMarks.orderedList) {
      textStyleKey = 'orderedList';
    }

    setActiveTextStyleKey(textStyleKey);
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

  toggleSubscript: () => {
    const { editor } = get();
    if (!editor) return;
    editor.chain().focus().toggleSubscript().run();
    get().updateActiveMarks();
  },

  toggleSuperscript: () => {
    const { editor } = get();
    if (!editor) return;
    editor.chain().focus().toggleSuperscript().run();
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

  setHeading: (level) => {
    const { editor } = get();
    if (!editor) return;
    if (level === null) {
      editor.chain().focus().setParagraph().run();
    } else {
      editor.chain().focus().toggleHeading({ level }).run();
    }
    get().updateActiveMarks();
  },

  toggleCustomStyle: () => {
    const { editor, activeMarks } = get();
    if (!editor) return;

    // If dynamicStyle is already active, remove it
    if (activeMarks.dynamicStyleKey) {
      editor.chain().focus().unsetMark('dynamicStyle').run();
    } else {
      // Generate a new unique style key and apply dynamicStyle
      const newKey = generateId('dts');
      editor.chain().focus().setMark('dynamicStyle', { styleKeys: [newKey] }).run();
    }
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

  hasTextSelection: () => {
    const { editor } = get();
    if (!editor) return false;

    const { from, to } = editor.state.selection;
    return from !== to;
  },

  ensureDynamicStyleApplied: () => {
    const { editor, activeMarks } = get();
    if (!editor) return null;

    const { from, to } = editor.state.selection;
    const hasSelection = from !== to;

    // If no selection (cursor only), return the current active style for editing
    if (!hasSelection) {
      if (activeMarks.dynamicStyleKey) return activeMarks.dynamicStyleKey;
      if (activeMarks.bold) return 'bold';
      if (activeMarks.italic) return 'italic';
      if (activeMarks.underline) return 'underline';
      if (activeMarks.strike) return 'strike';
      if (activeMarks.subscript) return 'subscript';
      if (activeMarks.superscript) return 'superscript';
      return null;
    }

    // Get existing styleKeys from the current mark (if any)
    let existingKeys: string[] = [];
    if (editor.isActive('dynamicStyle')) {
      const attrs = editor.getAttributes('dynamicStyle');
      existingKeys = attrs?.styleKeys || [];
    }

    // Create a new styleKey and append it to the array
    const newKey = generateId('dts');
    const updatedKeys = [...existingKeys, newKey];

    // Remove existing mark from selection, then apply with combined styleKeys
    // This ensures the new styleKeys array is properly set instead of merged
    editor.chain()
      .unsetMark('dynamicStyle')
      .setMark('dynamicStyle', { styleKeys: updatedKeys })
      .run();
    get().updateActiveMarks();

    // Set the active text style key to the new one
    const setActiveTextStyleKey = useEditorStore.getState().setActiveTextStyleKey;
    setActiveTextStyleKey(newKey);

    // Trigger a save to persist the new mark to the layer
    get().triggerSave();

    return newKey;
  },

  addFieldVariable: (variableData, fields, allFields) => {
    const { editor } = get();
    if (!editor) return;

    // Save current cursor position
    const { from } = editor.state.selection;
    const doc = editor.state.doc;

    // Check what's before the cursor
    let needsSpaceBefore = false;
    if (from > 0) {
      const nodeBefore = doc.nodeAt(from - 1);
      if (nodeBefore) {
        // Check if it's a variable node
        if (nodeBefore.type.name === 'dynamicVariable') {
          needsSpaceBefore = true;
        } else {
          // Check if it's text that's not a space
          const charBefore = doc.textBetween(from - 1, from);
          needsSpaceBefore = Boolean(charBefore && charBefore !== ' ' && charBefore !== '\n');
        }
      } else {
        // Check character before cursor
        const charBefore = doc.textBetween(from - 1, from);
        needsSpaceBefore = Boolean(charBefore && charBefore !== ' ' && charBefore !== '\n');
      }
    }

    // Check what's after the cursor
    let needsSpaceAfter = false;
    if (from < doc.content.size) {
      const nodeAfter = doc.nodeAt(from);
      if (nodeAfter) {
        // Check if it's a variable node
        if (nodeAfter.type.name === 'dynamicVariable') {
          needsSpaceAfter = true;
        } else {
          // Check if it's text that's not a space
          const charAfter = doc.textBetween(from, from + 1);
          needsSpaceAfter = Boolean(charAfter && charAfter !== ' ' && charAfter !== '\n');
        }
      } else {
        // Check character at cursor position
        const charAfter = doc.textBetween(from, from + 1);
        needsSpaceAfter = Boolean(charAfter && charAfter !== ' ' && charAfter !== '\n');
      }
    }

    // Get label for the variable
    const label = getVariableLabel(variableData, fields, allFields);

    // Build content to insert
    const contentToInsert: any[] = [];

    // Add space before if needed
    if (needsSpaceBefore) {
      contentToInsert.push({ type: 'text', text: ' ' });
    }

    // Add the variable node
    contentToInsert.push({
      type: 'dynamicVariable',
      attrs: {
        variable: variableData,
        label,
      },
    });

    // Add space after if needed
    if (needsSpaceAfter) {
      contentToInsert.push({ type: 'text', text: ' ' });
    }

    // Insert content
    editor.chain().focus().insertContent(contentToInsert).run();

    // Move cursor after inserted content
    let finalPosition = from;
    if (needsSpaceBefore) finalPosition += 1;
    finalPosition += 1;
    if (needsSpaceAfter) finalPosition += 1;

    setTimeout(() => {
      editor.commands.focus(finalPosition);
    }, 0);
  },
}));
