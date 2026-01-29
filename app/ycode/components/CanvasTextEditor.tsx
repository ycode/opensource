'use client';

/**
 * Canvas Text Editor
 *
 * Tiptap-based inline text editor for the canvas that preserves layer styling.
 * Renders with the same classes/textStyles as LayerRenderer for WYSIWYG editing.
 *
 * The formatting toolbar is rendered in CenterCanvas (outside iframe) and
 * communicates with this editor via useCanvasTextEditorStore.
 */

import React, { useEffect, useMemo, useCallback, forwardRef, useImperativeHandle, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { useEditor, EditorContent } from '@tiptap/react';
import { Node, Mark, mergeAttributes } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Text from '@tiptap/extension-text';
import Paragraph from '@tiptap/extension-paragraph';
import Bold from '@tiptap/extension-bold';
import Italic from '@tiptap/extension-italic';
import Underline from '@tiptap/extension-underline';
import Strike from '@tiptap/extension-strike';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import ListItem from '@tiptap/extension-list-item';
import { DEFAULT_TEXT_STYLES } from '@/lib/text-format-utils';
import type { Layer, TextStyle, CollectionField, Collection } from '@/types';
import type { FieldVariable } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import {
  parseValueToContent,
  getVariableLabel,
} from '@/lib/cms-variables-utils';
import { useCanvasTextEditorStore } from '@/stores/useCanvasTextEditorStore';
import { RichTextLink } from '@/lib/tiptap-extensions/rich-text-link';
import { useEditorStore } from '@/stores/useEditorStore';
import { cn } from '@/lib/utils';

interface CanvasTextEditorProps {
  /** The layer being edited */
  layer: Layer;
  /** Current value (Tiptap JSON or string) */
  value: any;
  /** Called when content changes */
  onChange: (value: any) => void;
  /** Called when editing is complete (blur/escape) */
  onFinish?: () => void;
  /** Collection fields for variable insertion */
  fields?: CollectionField[];
  /** All fields keyed by collection ID for nested references */
  allFields?: Record<string, CollectionField[]>;
  /** All collections for reference field lookups */
  collections?: Collection[];
  /** Collection item data for variable resolution */
  collectionItemData?: Record<string, string>;
  /** Click coordinates for initial cursor position */
  clickCoords?: { x: number; y: number } | null;
}

export interface CanvasTextEditorHandle {
  focus: () => void;
  addFieldVariable: (variableData: FieldVariable) => void;
}

/**
 * Custom Tiptap node for inline field variables
 */
const DynamicVariable = Node.create({
  name: 'dynamicVariable',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      variable: {
        default: null,
        parseHTML: (element) => {
          const variableAttr = element.getAttribute('data-variable');
          if (variableAttr) {
            try {
              return JSON.parse(variableAttr);
            } catch {
              return null;
            }
          }
          return null;
        },
        renderHTML: (attributes) => {
          if (!attributes) return {};
          return { 'data-variable': JSON.stringify(attributes) };
        },
      },
      label: {
        default: null,
        parseHTML: (element) => element.textContent || null,
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-variable]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const label = node.attrs.label ||
      node.attrs.variable?.data?.field_id ||
      node.attrs.variable?.type || 'variable';

    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        class: 'inline-flex items-center gap-1 rounded-sm border px-1.5 py-0 text-[10px] font-medium whitespace-nowrap shrink-0 border-transparent bg-gray-100 text-gray-600 mx-0.5',
        'data-variable': node.attrs.variable ? JSON.stringify(node.attrs.variable) : undefined,
      }),
      ['span', {}, label],
    ];
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const container = document.createElement('span');
      container.className = 'inline-block';
      container.contentEditable = 'false';

      const variable = node.attrs.variable;
      if (variable) {
        container.setAttribute('data-variable', JSON.stringify(variable));
      }

      const label = node.attrs.label ||
        variable?.data?.field_id ||
        variable?.type || 'variable';

      const handleDelete = () => {
        const pos = getPos();
        if (typeof pos === 'number') {
          editor.chain().focus().deleteRange({ from: pos, to: pos + 1 }).run();
        }
      };

      const root = createRoot(container);

      const renderBadge = () => {
        root.render(
          <Badge variant="inline_variable_canvas">
            <span>{label}</span>
            {editor.isEditable && (
              <Button
                onClick={handleDelete}
                className="!size-4 !p-0 -mr-1"
                variant="inline_variable_canvas"
              >
                <Icon name="x" className="size-2" />
              </Button>
            )}
          </Badge>
        );
      };

      queueMicrotask(renderBadge);

      const updateListener = () => renderBadge();
      editor.on('update', updateListener);

      return {
        dom: container,
        destroy: () => {
          editor.off('update', updateListener);
          setTimeout(() => root.unmount(), 0);
        },
      };
    };
  },
});

/**
 * Create custom Bold extension with layer textStyles class
 */
function createBoldExtension(textStyles?: Record<string, TextStyle>) {
  const boldClass = textStyles?.bold?.classes ?? DEFAULT_TEXT_STYLES.bold?.classes;

  return Bold.extend({
    renderHTML({ HTMLAttributes }) {
      return ['strong', mergeAttributes(HTMLAttributes, { class: boldClass }), 0];
    },
  });
}

/**
 * Create custom Italic extension with layer textStyles class
 */
function createItalicExtension(textStyles?: Record<string, TextStyle>) {
  const italicClass = textStyles?.italic?.classes ?? DEFAULT_TEXT_STYLES.italic?.classes;

  return Italic.extend({
    renderHTML({ HTMLAttributes }) {
      return ['em', mergeAttributes(HTMLAttributes, { class: italicClass }), 0];
    },
  });
}

/**
 * Create custom Underline extension with layer textStyles class
 */
function createUnderlineExtension(textStyles?: Record<string, TextStyle>) {
  const underlineClass = textStyles?.underline?.classes ?? DEFAULT_TEXT_STYLES.underline?.classes;

  return Underline.extend({
    renderHTML({ HTMLAttributes }) {
      return ['u', mergeAttributes(HTMLAttributes, { class: underlineClass }), 0];
    },
  });
}

/**
 * Create custom Strike extension with layer textStyles class
 */
function createStrikeExtension(textStyles?: Record<string, TextStyle>) {
  const strikeClass = textStyles?.strike?.classes ?? DEFAULT_TEXT_STYLES.strike?.classes;

  return Strike.extend({
    renderHTML({ HTMLAttributes }) {
      return ['s', mergeAttributes(HTMLAttributes, { class: strikeClass }), 0];
    },
  });
}

/**
 * Create custom Subscript extension with layer textStyles class
 */
function createSubscriptExtension(textStyles?: Record<string, TextStyle>) {
  const subscriptClass = textStyles?.subscript?.classes ?? DEFAULT_TEXT_STYLES.subscript?.classes;

  return Subscript.extend({
    renderHTML({ HTMLAttributes }) {
      return ['sub', mergeAttributes(HTMLAttributes, { class: subscriptClass }), 0];
    },
  });
}

/**
 * Create custom Superscript extension with layer textStyles class
 */
function createSuperscriptExtension(textStyles?: Record<string, TextStyle>) {
  const superscriptClass = textStyles?.superscript?.classes ?? DEFAULT_TEXT_STYLES.superscript?.classes;

  return Superscript.extend({
    renderHTML({ HTMLAttributes }) {
      return ['sup', mergeAttributes(HTMLAttributes, { class: superscriptClass }), 0];
    },
  });
}

/**
 * Create custom BulletList extension with layer textStyles class
 */
function createBulletListExtension(textStyles?: Record<string, TextStyle>) {
  const bulletListClass = textStyles?.bulletList?.classes ?? DEFAULT_TEXT_STYLES.bulletList?.classes;

  return BulletList.extend({
    renderHTML({ HTMLAttributes }) {
      return ['ul', mergeAttributes(HTMLAttributes, { class: bulletListClass }), 0];
    },
  });
}

/**
 * Create custom OrderedList extension with layer textStyles class
 */
function createOrderedListExtension(textStyles?: Record<string, TextStyle>) {
  const orderedListClass = textStyles?.orderedList?.classes ?? DEFAULT_TEXT_STYLES.orderedList?.classes;

  return OrderedList.extend({
    renderHTML({ HTMLAttributes }) {
      return ['ol', mergeAttributes(HTMLAttributes, { class: orderedListClass }), 0];
    },
  });
}

/**
 * Create custom ListItem extension with layer textStyles class
 */
function createListItemExtension(textStyles?: Record<string, TextStyle>) {
  const listItemClass = textStyles?.listItem?.classes ?? DEFAULT_TEXT_STYLES.listItem?.classes;

  return ListItem.extend({
    renderHTML({ HTMLAttributes }) {
      return ['li', mergeAttributes(HTMLAttributes, { class: listItemClass }), 0];
    },
  });
}

/**
 * Create custom RichTextLink extension with layer textStyles class
 */
function createRichTextLinkExtension(textStyles?: Record<string, TextStyle>) {
  const linkClass = textStyles?.link?.classes ?? DEFAULT_TEXT_STYLES.link?.classes;

  return RichTextLink.extend({
    addOptions() {
      return {
        ...this.parent?.(),
        HTMLAttributes: {
          class: linkClass,
        },
      };
    },
  });
}

/**
 * Create dynamic style Mark extension for applying arbitrary styles to selected text
 * Stores an array of styleKeys to support stacking multiple styles on the same text
 * Classes from all styleKeys are combined at render time
 */
function createDynamicStyleExtension(textStylesRef: React.MutableRefObject<Record<string, TextStyle> | undefined>) {
  return Mark.create({
    name: 'dynamicStyle',

    addAttributes() {
      return {
        styleKeys: {
          default: [],
          parseHTML: (element) => {
            const attr = element.getAttribute('data-style-keys');
            if (!attr) {
              // Backwards compatibility: single styleKey
              const singleKey = element.getAttribute('data-style-key');
              return singleKey ? [singleKey] : [];
            }
            try {
              return JSON.parse(attr);
            } catch {
              return [];
            }
          },
          renderHTML: (attributes) => {
            const keys = attributes.styleKeys || [];
            if (keys.length === 0) return {};
            return { 'data-style-keys': JSON.stringify(keys) };
          },
        },
      };
    },

    parseHTML() {
      return [
        { tag: 'span[data-style-keys]' },
        { tag: 'span[data-style-key]' }, // Backwards compatibility
      ];
    },

    renderHTML({ HTMLAttributes, mark }) {
      const styleKeys: string[] = mark.attrs.styleKeys || [];
      const styles = textStylesRef.current || {};

      // Combine classes from all styleKeys using cn() for intelligent merging
      // Later styles override earlier ones for conflicting properties (e.g., colors)
      const classesArray = styleKeys
        .map(key => styles[key]?.classes || '')
        .filter(Boolean);
      const combinedClasses = cn(...classesArray);

      // Store the last styleKey as data-style-key for click detection
      const lastKey = styleKeys[styleKeys.length - 1] || null;

      return ['span', mergeAttributes(HTMLAttributes, {
        'data-style-keys': JSON.stringify(styleKeys),
        'data-style-key': lastKey, // For click detection
        class: combinedClasses,
      }), 0];
    },
  });
}

const CanvasTextEditor = forwardRef<CanvasTextEditorHandle, CanvasTextEditorProps>(({
  layer,
  value,
  onChange,
  onFinish,
  fields,
  allFields,
  clickCoords,
}, ref) => {
  const textStyles = layer.textStyles;
  const editorRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef(value);
  // Store cursor position to restore after focus loss
  const savedSelectionRef = useRef<{ from: number; to: number } | null>(null);
  // Store click coordinates on mount (they shouldn't change during editing)
  const clickCoordsRef = useRef(clickCoords);
  // Mutable ref for textStyles that gets updated for real-time style changes
  const textStylesRef = useRef(textStyles);
  // Ref for onFinish callback to avoid stale closures
  const onFinishRef = useRef(onFinish);
  // Keep textStylesRef in sync with textStyles prop
  useEffect(() => {
    textStylesRef.current = textStyles;
  }, [textStyles]);
  // Keep onFinishRef in sync with onFinish prop
  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  // Get store actions
  const setEditor = useCanvasTextEditorStore((s) => s.setEditor);
  const startEditing = useCanvasTextEditorStore((s) => s.startEditing);
  const stopEditing = useCanvasTextEditorStore((s) => s.stopEditing);
  const updateActiveMarks = useCanvasTextEditorStore((s) => s.updateActiveMarks);
  const setOnFinishCallback = useCanvasTextEditorStore((s) => s.setOnFinishCallback);
  const setOnSaveCallback = useCanvasTextEditorStore((s) => s.setOnSaveCallback);

  // Keep valueRef in sync with value prop
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  // Track current layer ID to detect layer switches
  const currentLayerIdRef = useRef<string>(layer.id);

  // Create extensions with layer-specific textStyles
  // Dynamic styles use textStylesRef for real-time class lookups
  const extensions = useMemo(() => [
    Document,
    Paragraph,
    Text,
    DynamicVariable,
    createRichTextLinkExtension(textStylesRef.current),
    createBoldExtension(textStylesRef.current),
    createItalicExtension(textStylesRef.current),
    createUnderlineExtension(textStylesRef.current),
    createStrikeExtension(textStylesRef.current),
    createSubscriptExtension(textStylesRef.current),
    createSuperscriptExtension(textStylesRef.current),
    createBulletListExtension(textStylesRef.current),
    createOrderedListExtension(textStylesRef.current),
    createListItemExtension(textStylesRef.current),
    createDynamicStyleExtension(textStylesRef),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], []);

  // Parse initial content once on mount
  const initialContent = useMemo(() => {
    if (typeof value === 'object' && value?.type === 'doc') {
      return value;
    }
    return parseValueToContent(typeof value === 'string' ? value : '', fields, undefined, allFields);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Create a ref to handle saving on unmount/finish
  const saveChangesRef = useRef<() => void>(() => {});

  const editor = useEditor({
    immediatelyRender: true,
    extensions,
    content: initialContent,
    editorProps: {
      attributes: {
        class: 'outline-none ycode-text-editor',
      },
      handleKeyDown: (view, event) => {
        // Escape to save and finish editing
        if (event.key === 'Escape') {
          saveChangesRef.current();
          onFinish?.();
          return true;
        }
        return false;
      },
    },
    onSelectionUpdate: ({ editor: editorInstance }) => {
      // Update active marks in store when selection changes
      updateActiveMarks();

      // Save cursor position when selection changes (if editor is focused)
      if (editorInstance && editorInstance.isFocused) {
        const { from, to } = editorInstance.state.selection;
        savedSelectionRef.current = { from, to };
      }
    },
    onTransaction: ({ editor: editorInstance }) => {
      // Update active marks after any transaction
      updateActiveMarks();

      // Save cursor position after transaction (if editor is focused)
      if (editorInstance && editorInstance.isFocused) {
        const { from, to } = editorInstance.state.selection;
        savedSelectionRef.current = { from, to };
      }
    },
    onBlur: ({ editor: editorInstance }) => {
      // Save cursor position when editor loses focus
      if (editorInstance) {
        const { from, to } = editorInstance.state.selection;
        savedSelectionRef.current = { from, to };
      }
    },
    onFocus: ({ editor: editorInstance }) => {
      // Restore cursor position when editor regains focus
      if (editorInstance && savedSelectionRef.current) {
        const { from, to } = savedSelectionRef.current;
        try {
          const docSize = editorInstance.state.doc.content.size;
          const safeFrom = Math.min(from, docSize);
          const safeTo = Math.min(to, docSize);

          if (safeFrom >= 0 && safeTo >= 0 && safeFrom <= docSize && safeTo <= docSize) {
            // Use setTimeout to ensure focus is complete before restoring selection
            setTimeout(() => {
              editorInstance.commands.setTextSelection({ from: safeFrom, to: safeTo });
            }, 0);
          }
        } catch (error) {
          // Ignore errors when restoring selection
        }
      }
    },
  }, [extensions]);

  // Function to apply dynamic style classes to DOM elements
  const applyDynamicStyles = useCallback(() => {
    if (!editorRef.current) return;
    const styles = textStylesRef.current || {};

    // Find all elements with data-style-keys and update their classes
    const styledElements = editorRef.current.querySelectorAll('[data-style-keys]');
    styledElements.forEach((el) => {
      const keysAttr = el.getAttribute('data-style-keys');
      if (!keysAttr) return;

      try {
        const styleKeys: string[] = JSON.parse(keysAttr);
        // Combine classes from all styleKeys using cn() for intelligent merging
        // Later styles override earlier ones for conflicting properties
        const classesArray = styleKeys
          .map(key => styles[key]?.classes || '')
          .filter(Boolean);
        el.className = cn(...classesArray);
      } catch {
        // Fallback: single key
        const singleKey = el.getAttribute('data-style-key');
        if (singleKey && styles[singleKey]) {
          el.className = styles[singleKey].classes || '';
        }
      }
    });
  }, []);

  // Subscribe to editor events to apply dynamic styles when content renders
  useEffect(() => {
    if (!editor) return;

    // Apply styles when editor creates/updates content
    const handleCreate = () => {
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(applyDynamicStyles);
    };

    const handleUpdate = () => {
      requestAnimationFrame(applyDynamicStyles);
    };

    editor.on('create', handleCreate);
    editor.on('update', handleUpdate);

    // Also apply immediately and after delays for initial render
    applyDynamicStyles();
    const timeoutId1 = setTimeout(applyDynamicStyles, 50);
    const timeoutId2 = setTimeout(applyDynamicStyles, 150);

    return () => {
      editor.off('create', handleCreate);
      editor.off('update', handleUpdate);
      clearTimeout(timeoutId1);
      clearTimeout(timeoutId2);
    };
  }, [editor, applyDynamicStyles]);

  // Reapply styles when textStyles change
  useEffect(() => {
    applyDynamicStyles();
  }, [textStyles, applyDynamicStyles]);

  // Register editor with store on mount
  useEffect(() => {
    if (editor) {
      setEditor(editor);
      startEditing(layer.id);

      // Register finish callback so toolbar "Done" button can trigger finish
      // Use refs to avoid stale closures when onChange/onFinish change identity
      setOnFinishCallback(() => {
        saveChangesRef.current();
        onFinishRef.current?.();
      });

      // Register save callback so dynamicStyle application can trigger a save
      setOnSaveCallback(() => {
        saveChangesRef.current();
      });
    }

    return () => {
      // Cleanup: save changes and unregister
      saveChangesRef.current();
      stopEditing();
    };
  }, [editor, setEditor, startEditing, stopEditing, setOnFinishCallback, setOnSaveCallback, layer.id]);

  // Update save function when editor or onChange changes
  useEffect(() => {
    saveChangesRef.current = () => {
      if (editor) {
        const currentValue = editor.getJSON();
        if (JSON.stringify(currentValue) !== JSON.stringify(valueRef.current)) {
          onChange(currentValue);
          // Update valueRef to prevent duplicate saves
          valueRef.current = currentValue;
        }
      }
    };
  }, [editor, onChange]);

  // Handle layer switches: save old content before loading new layer
  useEffect(() => {
    if (!editor) return;

    if (currentLayerIdRef.current !== layer.id) {
      // Layer has changed - save the current editor content before switching
      if (currentLayerIdRef.current) {
        const currentContent = editor.getJSON();
        if (JSON.stringify(currentContent) !== JSON.stringify(valueRef.current)) {
          onChange(currentContent);
        }
      }
      // Update to new layer ID
      currentLayerIdRef.current = layer.id;
    }
  }, [layer.id, editor, onChange]);

  // Focus editor on mount (only if no saved selection exists)
  useEffect(() => {
    if (!editor) return;

    let retryCount = 0;
    const MAX_RETRIES = 50; // Maximum 50 retries (500ms total)
    let timeoutId: NodeJS.Timeout | null = null;

    // Wait for the view to be fully mounted
    const checkAndFocus = () => {
      // Stop retrying if we've exceeded max retries
      if (retryCount >= MAX_RETRIES) {
        console.warn('Failed to focus editor: max retries exceeded');
        return;
      }

      retryCount++;

      try {
        // Check if editor still exists
        if (!editor || !editor.view) {
          timeoutId = setTimeout(checkAndFocus, 10);
          return;
        }

        // Try to access view.dom safely (it may throw if not ready)
        let dom: HTMLElement | null = null;
        try {
          dom = editor.view.dom;
        } catch (error) {
          // view.dom is not available yet, retry
          timeoutId = setTimeout(checkAndFocus, 10);
          return;
        }

        if (!dom || !dom.isConnected) {
          timeoutId = setTimeout(checkAndFocus, 10);
          return;
        }

        // All checks passed, safe to focus
        // Priority 1: Restore saved selection (from previous blur)
        if (savedSelectionRef.current) {
          const { from, to } = savedSelectionRef.current;
          const docSize = editor.state.doc.content.size;
          const safeFrom = Math.min(from, docSize);
          const safeTo = Math.min(to, docSize);

          if (safeFrom >= 0 && safeTo >= 0 && safeFrom <= docSize && safeTo <= docSize) {
            editor.commands.setTextSelection({ from: safeFrom, to: safeTo });
            editor.commands.focus();
          } else {
            editor.commands.focus('end');
          }
        }
        // Priority 2: Use click coordinates to position cursor
        else if (clickCoordsRef.current && editor.view.dom) {
          try {
            // Use Tiptap's posAtCoords to find the document position at these coordinates
            const pos = editor.view.posAtCoords({
              left: clickCoordsRef.current.x,
              top: clickCoordsRef.current.y
            });

            if (pos) {
              editor.commands.setTextSelection(pos.pos);
              editor.commands.focus();
            } else {
              // Fallback to end if coords are outside content
              editor.commands.focus('end');
            }
          } catch (error) {
            console.warn('Failed to position cursor at click coordinates:', error);
            editor.commands.focus('end');
          }
        }
        // Priority 3: Default to end
        else {
          editor.commands.focus('end');
        }
      } catch (error) {
        // If view is not available, retry after a delay
        if (error instanceof Error && (error.message.includes('view') || error.message.includes('dom'))) {
          if (retryCount < MAX_RETRIES) {
            timeoutId = setTimeout(checkAndFocus, 10);
          } else {
            console.warn('Failed to focus editor:', error);
          }
        } else {
          console.warn('Failed to focus editor:', error);
        }
      }
    };

    timeoutId = setTimeout(checkAndFocus, 0);

    // Cleanup: cancel pending timeout if component unmounts or editor changes
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [editor]);

  // Update content when value changes externally (but preserve cursor position)
  // IMPORTANT: Skip updates when editor is focused to prevent resetting user edits
  // This is critical for the dynamicStyle auto-apply feature, which modifies content
  // before updating layer.textStyles - we don't want the old value to reset the editor
  useEffect(() => {
    if (!editor) return;

    // Skip external content sync when user is actively editing
    // User edits are saved on finish/unmount, not during editing
    if (editor.isFocused) return;

    const currentContent = editor.getJSON();
    const newContent = typeof value === 'object' && value?.type === 'doc'
      ? value
      : parseValueToContent(typeof value === 'string' ? value : '', fields, undefined, allFields);

    // Only update if content actually changed (not just design properties)
    if (JSON.stringify(currentContent) !== JSON.stringify(newContent)) {
      editor.commands.setContent(newContent, { emitUpdate: false });
      // Update valueRef to track the new content
      valueRef.current = newContent;
    }
  }, [value, fields, allFields, editor, layer.id]);

  // Add field variable
  const addFieldVariable = useCallback((variableData: FieldVariable) => {
    if (!editor || !editor.view) return;

    const { from } = editor.state.selection;
    const doc = editor.state.doc;

    let needsSpaceBefore = false;
    if (from > 0) {
      const nodeBefore = doc.nodeAt(from - 1);
      if (nodeBefore?.type.name === 'dynamicVariable') {
        needsSpaceBefore = true;
      } else {
        const charBefore = doc.textBetween(from - 1, from);
        needsSpaceBefore = Boolean(charBefore && charBefore !== ' ' && charBefore !== '\n');
      }
    }

    let needsSpaceAfter = false;
    if (from < doc.content.size) {
      const nodeAfter = doc.nodeAt(from);
      if (nodeAfter?.type.name === 'dynamicVariable') {
        needsSpaceAfter = true;
      } else {
        const charAfter = doc.textBetween(from, from + 1);
        needsSpaceAfter = Boolean(charAfter && charAfter !== ' ' && charAfter !== '\n');
      }
    }

    const label = getVariableLabel(variableData, fields, allFields);
    const contentToInsert: any[] = [];

    if (needsSpaceBefore) {
      contentToInsert.push({ type: 'text', text: ' ' });
    }

    contentToInsert.push({
      type: 'dynamicVariable',
      attrs: { variable: variableData, label },
    });

    if (needsSpaceAfter) {
      contentToInsert.push({ type: 'text', text: ' ' });
    }

    editor.chain().focus().insertContent(contentToInsert).run();
  }, [editor, fields, allFields]);

  // Handle clicks on styled text to select that style for editing
  const handleEditorClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;

    // Check if clicked element or its parents have data-style-key
    const styledElement = target.closest('[data-style-key]') as HTMLElement;
    if (styledElement) {
      const styleKey = styledElement.getAttribute('data-style-key');
      if (styleKey) {
        // Import from the store isn't ideal here, but needed for click handling
        const setActiveTextStyleKey = useEditorStore.getState().setActiveTextStyleKey;
        setActiveTextStyleKey(styleKey);
      }
    }
  }, []);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    focus: () => {
      if (editor?.view) {
        try {
          editor.commands.focus('end');
        } catch (error) {
          console.warn('Failed to focus editor:', error);
        }
      }
    },
    addFieldVariable,
  }), [editor, addFieldVariable]);

  if (!editor) return null;

  return (
    <div
      ref={editorRef}
      className="relative"
      onClick={handleEditorClick}
    >
      <EditorContent editor={editor} />
    </div>
  );
});

CanvasTextEditor.displayName = 'CanvasTextEditor';

export default CanvasTextEditor;
