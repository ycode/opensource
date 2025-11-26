'use client';

/**
 * Input With Inline Variables
 *
 * Tiptap-based input that displays variable badges inline
 * Supports custom objects like { type: 'field', data: { field_id: ... } }
 * Data is stored in data-variable attribute as JSON-encoded string
 */

import React, { useEffect, useState, useImperativeHandle, forwardRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { useEditor, EditorContent } from '@tiptap/react';
import { Node, mergeAttributes } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Text from '@tiptap/extension-text';
import Paragraph from '@tiptap/extension-paragraph';
import Placeholder from '@tiptap/extension-placeholder';
import { cn } from '@/lib/utils';
import type { CollectionField } from '@/types';
import {
  parseValueToContent,
  convertContentToValue,
  getVariableLabel,
} from '@/lib/cms-variables-utils';
import type { FieldVariable } from '@/types';
import {
  Select,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';

interface InputWithInlineVariablesProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  fields?: CollectionField[];
}

export interface InputWithInlineVariablesHandle {
  addFieldVariable: (variableData: FieldVariable) => void;
}

export type { FieldVariable } from '@/types';

/**
 * Custom Tiptap node for dynamic variable badges
 * Stores data in data-variable attribute as JSON-encoded string
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

          return {
            'data-variable': JSON.stringify(attributes),
          };
        },
      },
      label: {
        default: null,
        parseHTML: (element) => {
          // Try to get from text content or data attribute
          return element.textContent || null;
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-variable]',
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const label = node.attrs.label ||
      (node.attrs.variable?.data?.field_id) ||
      (node.attrs.variable?.type || 'variable');

    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        class: 'inline-flex items-center justify-center gap-1 rounded-sm border px-1.5 py-0 text-[10px] font-medium whitespace-nowrap shrink-0 border-transparent bg-secondary text-secondary-foreground/70 mx-0.5',
        'data-variable': node.attrs.variable ? JSON.stringify(node.attrs.variable) : undefined,
      }),
      ['span', {}, label],
    ];
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      // Create container for React component
      const container = document.createElement('span');
      container.className = 'inline-block';
      container.contentEditable = 'false';

      const variable = node.attrs.variable;
      if (variable) {
        container.setAttribute('data-variable', JSON.stringify(variable));
      }

      // Extract label from variable data
      const label = node.attrs.label ||
        (variable?.data?.field_id) ||
        (variable?.type || 'variable');

      // Handle delete
      const handleDelete = () => {
        const pos = getPos();
        if (typeof pos === 'number') {
          editor.chain().focus().deleteRange({ from: pos, to: pos + 1 }).run();
        }
      };

      // Render React Badge component asynchronously to avoid triggering updates during render phase
      // The renderHTML fallback matches Badge styling exactly, so there's no visual difference
      const root = createRoot(container);
      queueMicrotask(() => {
        root.render(
          <Badge variant="secondary">
            <span>{label}</span>
            <Button
              onClick={handleDelete}
              className="!size-4 !p-0 -mr-1"
              variant="outline"
            >
              <Icon name="x" className="size-2" />
            </Button>
          </Badge>
        );
      });

      return {
        dom: container,
        destroy: () => {
          // Defer unmount to avoid synchronous unmount during render
          setTimeout(() => {
            root.unmount();
          }, 0);
        },
      };
    };
  },
});

const InputWithInlineVariables = forwardRef<InputWithInlineVariablesHandle, InputWithInlineVariablesProps>(({
  value,
  onChange,
  placeholder = '',
  className,
  fields,
}, ref) => {
  const [isFocused, setIsFocused] = useState(false);

  const editor = useEditor({
    immediatelyRender: true,
    extensions: [
      Document,
      Paragraph,
      Text,
      DynamicVariable,
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: parseValueToContent(value, fields),
    editorProps: {
      attributes: {
        class: cn(
          'min-h-[2rem] text-xs leading-5.5 px-2 py-1 rounded-lg',
          'w-full min-w-0 border border-transparent bg-input transition-[color,box-shadow] outline-none',
          'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[0px]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          '[&_.ProseMirror]:outline-none [&_.ProseMirror]:w-full [&_.ProseMirror]:min-h-full',
          '[&_.ProseMirror_p]:m-0 [&_.ProseMirror_p]:p-0 [&_.ProseMirror_p]:flex [&_.ProseMirror_p]:flex-wrap [&_.ProseMirror_p]:items-center [&_.ProseMirror_p]:gap-y-0.5',
          '[&_.ProseMirror_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child]:before:inline-block [&_.ProseMirror_p.is-editor-empty:first-child]:before:w-full [&_.ProseMirror_p.is-editor-empty:first-child]:before:text-xs [&_.ProseMirror_p.is-editor-empty:first-child]:before:text-current/25 [&_.ProseMirror_p.is-editor-empty:first-child]:before:pointer-events-none',
          className
        ),
      },
      handleKeyDown: (view, event) => {
        // Prevent line breaks
        if (event.key === 'Enter') {
          event.preventDefault();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const newValue = convertContentToValue(editor.getJSON());
      if (newValue !== value) {
        onChange(newValue);
      }
    },
    onCreate: ({ editor }) => {
      // Set initial content
      const content = parseValueToContent(value, fields);
      editor.commands.setContent(content);
    },
    onFocus: () => {
      setIsFocused(true);
    },
    onBlur: () => {
      setIsFocused(false);
    },
  });

  // Update placeholder attribute when placeholder prop changes
  useEffect(() => {
    if (!editor) return;

    const proseMirror = editor.view.dom;
    const paragraph = proseMirror?.querySelector('p');

    if (paragraph) {
      paragraph.setAttribute('data-placeholder', placeholder);
    }
  }, [editor, placeholder]);

  // Update editor content when value or fields change externally
  useEffect(() => {
    if (!editor) return;

    const currentValue = convertContentToValue(editor.getJSON());
    if (currentValue !== value) {
      const content = parseValueToContent(value, fields);
      editor.commands.setContent(content);

      // Move cursor to end
      setTimeout(() => {
        editor.commands.focus('end');
      }, 0);
    } else if (fields) {
      // Update labels for existing nodes when fields change
      const json = editor.getJSON();
      let updated = false;

      const updateNodeLabels = (content: any[]): any[] => {
        return content.map((node: any) => {
          if (node.type === 'dynamicVariable' && node.attrs?.variable) {
            const variable = node.attrs.variable;
            if (variable.type === 'field' && variable.data?.field_id) {
              const field = fields.find(f => f.id === variable.data.field_id);
              const newLabel = field?.name || variable.data.field_id;
              if (node.attrs.label !== newLabel) {
                updated = true;
                return {
                  ...node,
                  attrs: {
                    ...node.attrs,
                    label: newLabel,
                  },
                };
              }
            }
          } else if (node.content) {
            return {
              ...node,
              content: updateNodeLabels(node.content),
            };
          }
          return node;
        });
      };

      if (json.content) {
        const updatedContent = updateNodeLabels(json.content);
        if (updated) {
          editor.commands.setContent({ ...json, content: updatedContent });
        }
      }
    }
  }, [value, fields, editor]);

  // Internal function to add a field variable
  const addFieldVariableInternal = useCallback((variableData: FieldVariable) => {
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
    const label = getVariableLabel(variableData, fields);

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

    // Trigger onChange with updated value
    const newValue = convertContentToValue(editor.getJSON());
    onChange(newValue);

    // Calculate final cursor position
    // Variable is 1 character, plus spaces if added
    let finalPosition = from;
    if (needsSpaceBefore) finalPosition += 1; // space before
    finalPosition += 1; // variable itself
    if (needsSpaceAfter) finalPosition += 1; // space after

    // Restore focus at the position after the inserted content
    setTimeout(() => {
      editor.commands.focus(finalPosition);
    }, 0);
  }, [editor, fields, onChange]);

  // Expose addFieldVariable function via ref
  useImperativeHandle(ref, () => ({
    addFieldVariable: addFieldVariableInternal,
  }), [addFieldVariableInternal]);

  if (!editor) {
    return null;
  }

  const handleFieldSelect = (fieldId: string) => {
    if (!fields) return;

    const field = fields.find(f => f.id === fieldId);
    if (field) {
      addFieldVariableInternal({
        type: 'field',
        data: {
          field_id: field.id,
          relationships: [],
        },
      });
    }
  };

  return (
    <div className="relative flex-1 input-with-inline-variables">
      <div className="relative">
        <EditorContent editor={editor} />
      </div>

      {fields && fields.length > 0 && (
        <div className="absolute top-1 right-1">
          <Select
            value=""
            onValueChange={handleFieldSelect}
          >
            <SelectPrimitive.Trigger asChild>
              <Button
                variant="secondary"
                size="xs"
              >
                <Icon name="database" className="size-2.5" />
              </Button>
            </SelectPrimitive.Trigger>

            <SelectContent>
              {fields.length > 0 ? (
                fields.map((field) => (
                  <SelectItem key={field.id} value={field.id}>
                    {field.name}
                  </SelectItem>
                ))
              ) : (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                  No fields available
                </div>
              )}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
});

InputWithInlineVariables.displayName = 'InputWithInlineVariables';

export default InputWithInlineVariables;
