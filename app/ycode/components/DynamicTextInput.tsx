'use client';

/**
 * Dynamic Text Input (with inline variables)
 *
 * Tiptap-based input that displays variable badges inline
 * Supports custom objects like { type: 'field', data: { field_id: ... } }
 * Data is stored in data-variable attribute as JSON-encoded string
 */

import React, { useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { Node, mergeAttributes } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Text from '@tiptap/extension-text';
import Paragraph from '@tiptap/extension-paragraph';
import { cn } from '@/lib/utils';
import type { CollectionField } from '@/types';

interface DynamicTextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  fields?: CollectionField[];
}

export interface DynamicTextInputHandle {
  addFieldVariable: (variableData: FieldVariableData) => void;
}

export type VariableData = FieldVariableData;

export interface FieldVariableData {
  type: 'field';
  data: {
    field_id: string;
    relationships: string[];
    format?: string;
  };
}

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
        class: 'inline-flex items-center justify-center rounded-sm border px-1.5 py-0 text-[10px] font-medium whitespace-nowrap shrink-0 border-transparent bg-secondary text-secondary-foreground/70 mx-0.5',
        'data-variable': node.attrs.variable ? JSON.stringify(node.attrs.variable) : undefined,
      }),
      label,
    ];
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const span = document.createElement('span');
      span.className = 'inline-flex items-center justify-center gap-0.5 rounded-sm border px-1.25 pt-0.25 text-[11px] leading-none font-medium whitespace-nowrap shrink-0 border-transparent bg-primary/50 text-primary-foreground mx-0.25';

      const variable = node.attrs.variable;
      if (variable) {
        span.setAttribute('data-variable', JSON.stringify(variable));
      }
      span.contentEditable = 'false';

      // Extract label from variable data
      const label = node.attrs.label ||
        (variable?.data?.field_id) ||
        (variable?.type || 'variable');

      // Add the label text
      const textNode = document.createTextNode(label);
      span.appendChild(textNode);

      // Create X icon
      const icon = document.createElement('span');
      icon.className = 'inline-flex items-center justify-center size-3.5 rounded-sm hover:bg-black/20 cursor-pointer transition-colors -mr-0.5';
      icon.innerHTML = '<svg class="size-2 fill-current" viewBox="0 0 12 12"><path d="M9.5,1.79289322 L10.2071068,2.5 L6.70689322,5.99989322 L10.2071068,9.5 L9.5,10.2071068 L5.99989322,6.70689322 L2.5,10.2071068 L1.79289322,9.5 L5.29289322,5.99989322 L1.79289322,2.5 L2.5,1.79289322 L5.99989322,5.29289322 L9.5,1.79289322 Z"/></svg>';

      // Handle click on X icon
      icon.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });

      icon.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const pos = getPos();
        if (typeof pos === 'number') {
          editor.chain().focus().deleteRange({ from: pos, to: pos + 1 }).run();
        }
      });

      span.appendChild(icon);

      return {
        dom: span,
      };
    };
  },
});

/**
 * Converts string with variables to Tiptap JSON content
 * Expects format: <ycode-inline-variable>JSON</ycode-inline-variable>
 */
function parseValueToContent(text: string, fields?: CollectionField[]) {
  const content: any[] = [];
  const regex = /<ycode-inline-variable>([\s\S]*?)<\/ycode-inline-variable>/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      const textContent = text.slice(lastIndex, match.index);
      if (textContent) {
        content.push({
          type: 'text',
          text: textContent,
        });
      }
    }

    // Parse the variable content as JSON
    const variableContent = match[1].trim();
    let variable: VariableData | null = null;
    let label: string = 'variable';

    try {
      const parsed = JSON.parse(variableContent);
      if (parsed.type && parsed.data) {
        variable = parsed;

        // Look up field name when type is 'field'
        if (parsed.type === 'field' && parsed.data?.field_id) {
          const field = fields?.find(f => f.id === parsed.data.field_id);
          label = field?.name || parsed.data.field_id;
        } else {
          label = parsed.type;
        }
      }
    } catch {
      // Invalid JSON, skip this variable
    }

    if (variable) {
      content.push({
        type: 'dynamicVariable',
        attrs: {
          variable,
          label,
        },
      });
    }

    lastIndex = regex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    const textContent = text.slice(lastIndex);
    if (textContent) {
      content.push({
        type: 'text',
        text: textContent,
      });
    }
  }

  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: content.length > 0 ? content : undefined,
      },
    ],
  };
}

/**
 * Converts Tiptap JSON content back to string
 * Outputs format: <ycode-inline-variable>{"type":"field","data":{"field_id":"..."}}</ycode-inline-variable>
 */
function convertContentToValue(content: any): string {
  let result = '';

  if (content?.content) {
    for (const block of content.content) {
      if (block.content) {
        for (const node of block.content) {
          if (node.type === 'text') {
            result += node.text;
          } else if (node.type === 'dynamicVariable') {
            if (node.attrs.variable) {
              result += `<ycode-inline-variable>${JSON.stringify(node.attrs.variable)}</ycode-inline-variable>`;
            }
          }
        }
      }
    }
  }

  return result;
}

const DynamicTextInput = forwardRef<DynamicTextInputHandle, DynamicTextInputProps>(({
  value,
  onChange,
  placeholder = '',
  className,
  fields,
}, ref) => {
  const [isEmpty, setIsEmpty] = useState(true);
  const [isFocused, setIsFocused] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      Document,
      Paragraph,
      Text,
      DynamicVariable,
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
      setIsEmpty(editor.isEmpty);
      if (newValue !== value) {
        onChange(newValue);
      }
    },
    onCreate: ({ editor }) => {
      // Set initial content
      const content = parseValueToContent(value, fields);
      editor.commands.setContent(content);
      setIsEmpty(editor.isEmpty);
    },
    onFocus: () => {
      setIsFocused(true);
    },
    onBlur: () => {
      setIsFocused(false);
    },
  });

  // Update editor content when value or fields change externally
  useEffect(() => {
    if (!editor) return;

    const currentValue = convertContentToValue(editor.getJSON());
    if (currentValue !== value) {
      const content = parseValueToContent(value, fields);
      editor.commands.setContent(content);
      setIsEmpty(editor.isEmpty);

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

  // Expose addFieldVariable function via ref
  useImperativeHandle(ref, () => ({
    addFieldVariable: (variableData: FieldVariableData) => {
      if (!editor) return;

      // Look up label from fields when type is 'field'
      let label: string = 'variable';
      if (variableData.type === 'field' && variableData.data?.field_id) {
        const field = fields?.find(f => f.id === variableData.data.field_id);
        label = field?.name || variableData.data.field_id;
      } else {
        label = variableData.type;
      }

      // Insert the variable node at the current cursor position
      editor.chain().focus().insertContent({
        type: 'dynamicVariable',
        attrs: {
          variable: variableData,
          label,
        },
      }).run();

      // Trigger onChange with updated value
      const newValue = convertContentToValue(editor.getJSON());
      onChange(newValue);
    },
  }), [editor, fields, onChange]);

  if (!editor) {
    return null;
  }

  return (
    <div className="relative flex-1">
      {isEmpty && (
        <div className="pointer-events-none absolute left-2 top-2 text-xs text-current/25 z-10">
          {placeholder}
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
});

DynamicTextInput.displayName = 'DynamicTextInput';

export default DynamicTextInput;
