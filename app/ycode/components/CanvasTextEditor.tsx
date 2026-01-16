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
import { Node, mergeAttributes } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Text from '@tiptap/extension-text';
import Paragraph from '@tiptap/extension-paragraph';
import Bold from '@tiptap/extension-bold';
import Italic from '@tiptap/extension-italic';
import Underline from '@tiptap/extension-underline';
import Strike from '@tiptap/extension-strike';
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
          <Badge variant="secondary">
            <span>{label}</span>
            {editor.isEditable && (
              <Button
                onClick={handleDelete}
                className="!size-4 !p-0 -mr-1"
                variant="outline"
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
  const styles = { ...DEFAULT_TEXT_STYLES, ...textStyles };
  const boldClass = styles.bold?.classes || 'font-bold';

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
  const styles = { ...DEFAULT_TEXT_STYLES, ...textStyles };
  const italicClass = styles.italic?.classes || 'italic';

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
  const styles = { ...DEFAULT_TEXT_STYLES, ...textStyles };
  const underlineClass = styles.underline?.classes || 'underline';

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
  const styles = { ...DEFAULT_TEXT_STYLES, ...textStyles };
  const strikeClass = styles.strike?.classes || 'line-through';

  return Strike.extend({
    renderHTML({ HTMLAttributes }) {
      return ['s', mergeAttributes(HTMLAttributes, { class: strikeClass }), 0];
    },
  });
}

/**
 * Create custom BulletList extension with layer textStyles class
 */
function createBulletListExtension(textStyles?: Record<string, TextStyle>) {
  const styles = { ...DEFAULT_TEXT_STYLES, ...textStyles };
  const bulletListClass = styles.bulletList?.classes || 'ml-2 pl-4 list-disc';

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
  const styles = { ...DEFAULT_TEXT_STYLES, ...textStyles };
  const orderedListClass = styles.orderedList?.classes || 'ml-2 pl-5 list-decimal';

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
  const styles = { ...DEFAULT_TEXT_STYLES, ...textStyles };
  const listItemClass = styles.listItem?.classes || '';

  return ListItem.extend({
    renderHTML({ HTMLAttributes }) {
      return ['li', mergeAttributes(HTMLAttributes, { class: listItemClass }), 0];
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
}, ref) => {
  const textStyles = layer.textStyles;
  const editorRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef(value);

  // Get store actions
  const setEditor = useCanvasTextEditorStore((s) => s.setEditor);
  const startEditing = useCanvasTextEditorStore((s) => s.startEditing);
  const stopEditing = useCanvasTextEditorStore((s) => s.stopEditing);
  const updateActiveMarks = useCanvasTextEditorStore((s) => s.updateActiveMarks);
  const setOnFinishCallback = useCanvasTextEditorStore((s) => s.setOnFinishCallback);

  // Keep valueRef in sync with value prop
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  // Create extensions with layer-specific textStyles
  const extensions = useMemo(() => [
    Document,
    Paragraph,
    Text,
    DynamicVariable,
    createBoldExtension(textStyles),
    createItalicExtension(textStyles),
    createUnderlineExtension(textStyles),
    createStrikeExtension(textStyles),
    createBulletListExtension(textStyles),
    createOrderedListExtension(textStyles),
    createListItemExtension(textStyles),
  ], [textStyles]);

  // Parse initial content
  const initialContent = useMemo(() => {
    if (typeof value === 'object' && value?.type === 'doc') {
      return value;
    }
    return parseValueToContent(typeof value === 'string' ? value : '', fields, undefined, allFields);
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
    onSelectionUpdate: () => {
      // Update active marks in store when selection changes
      updateActiveMarks();
    },
    onTransaction: () => {
      // Update active marks after any transaction
      updateActiveMarks();
    },
  }, [extensions]);

  // Register editor with store on mount
  useEffect(() => {
    if (editor) {
      setEditor(editor);
      startEditing(layer.id);

      // Register finish callback so toolbar "Done" button can trigger finish
      setOnFinishCallback(() => {
        saveChangesRef.current();
        onFinish?.();
      });
    }

    return () => {
      // Cleanup: save changes and unregister
      saveChangesRef.current();
      stopEditing();
    };
  }, [editor, setEditor, startEditing, stopEditing, setOnFinishCallback, onFinish, layer.id]);

  // Update save function when editor or onChange changes
  useEffect(() => {
    saveChangesRef.current = () => {
      if (editor) {
        const currentValue = editor.getJSON();
        if (JSON.stringify(currentValue) !== JSON.stringify(valueRef.current)) {
          onChange(currentValue);
        }
      }
    };
  }, [editor, onChange]);

  // Focus editor on mount
  useEffect(() => {
    if (editor && editor.view) {
      setTimeout(() => {
        try {
          editor.commands.focus('end');
        } catch (error) {
          console.warn('Failed to focus editor:', error);
        }
      }, 0);
    }
  }, [editor]);

  // Update content when value changes externally
  useEffect(() => {
    if (!editor) return;

    const currentContent = editor.getJSON();
    const newContent = typeof value === 'object' && value?.type === 'doc'
      ? value
      : parseValueToContent(typeof value === 'string' ? value : '', fields, undefined, allFields);

    if (JSON.stringify(currentContent) !== JSON.stringify(newContent)) {
      editor.commands.setContent(newContent);
    }
  }, [value, fields, allFields, editor]);

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
    <div ref={editorRef} className="relative">
      <EditorContent editor={editor} />
    </div>
  );
});

CanvasTextEditor.displayName = 'CanvasTextEditor';

export default CanvasTextEditor;
