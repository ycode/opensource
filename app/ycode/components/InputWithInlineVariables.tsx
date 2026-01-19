'use client';

/**
 * Input With Inline Variables
 *
 * Tiptap-based input that displays variable badges inline
 * Supports custom objects like { type: 'field', data: { field_id: ... } }
 * Data is stored in data-variable attribute as JSON-encoded string
 */

import React, { useEffect, useState, useImperativeHandle, forwardRef, useCallback, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { useEditor, EditorContent } from '@tiptap/react';
import { Node, mergeAttributes } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Text from '@tiptap/extension-text';
import Paragraph from '@tiptap/extension-paragraph';
import Placeholder from '@tiptap/extension-placeholder';
import Bold from '@tiptap/extension-bold';
import Italic from '@tiptap/extension-italic';
import Underline from '@tiptap/extension-underline';
import Strike from '@tiptap/extension-strike';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import ListItem from '@tiptap/extension-list-item';
import { cn } from '@/lib/utils';
import type { CollectionField, Collection } from '@/types';
import {
  parseValueToContent,
  convertContentToValue,
  getVariableLabel,
} from '@/lib/cms-variables-utils';
import type { FieldVariable } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import FieldTreeSelect from './FieldTreeSelect';

interface InputWithInlineVariablesProps {
  value: string | any; // string for simple text, Tiptap JSON when withFormatting=true
  onChange: (value: string | any) => void;
  onBlur?: (value: string | any) => void;
  placeholder?: string;
  className?: string;
  fields?: CollectionField[];
  fieldSourceLabel?: string;
  /** All fields keyed by collection ID for resolving nested references */
  allFields?: Record<string, CollectionField[]>;
  /** All collections for reference field lookups */
  collections?: Collection[];
  /** Disable editing and hide database button */
  disabled?: boolean;
  /** Enable formatting toolbar (bold, italic, underline, strikethrough) - uses Tiptap JSON format */
  withFormatting?: boolean;
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

      const renderBadge = () => {
        const isEditable = editor.isEditable;
        root.render(
          <Badge variant="secondary">
            <span>{label}</span>
            {isEditable && (
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

      // Re-render when editor editable state changes
      const updateListener = () => {
        renderBadge();
      };
      editor.on('update', updateListener);

      return {
        dom: container,
        destroy: () => {
          editor.off('update', updateListener);
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
  onBlur: onBlurProp,
  placeholder = '',
  className,
  fields,
  fieldSourceLabel,
  allFields,
  collections,
  disabled = false,
  withFormatting = false,
}, ref) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  // Track if update is coming from editor to prevent infinite loop
  const isInternalUpdateRef = useRef(false);

  const extensions = useMemo(() => {
    const baseExtensions = [
      Document,
      Paragraph,
      Text,
      DynamicVariable,
      Placeholder.configure({
        placeholder,
      }),
    ];

    if (withFormatting) {
      return [
        ...baseExtensions,
        Bold,
        Italic,
        Underline,
        Strike,
        Subscript,
        Superscript,
        BulletList,
        OrderedList,
        ListItem,
      ];
    }

    return baseExtensions;
  }, [placeholder, withFormatting]);

  const editor = useEditor({
    immediatelyRender: true,
    extensions,
    content: withFormatting && typeof value === 'object'
      ? value
      : parseValueToContent(typeof value === 'string' ? value : '', fields, undefined, allFields),
    editorProps: {
      attributes: {
        class: cn(
          'min-h-[2rem] text-xs leading-5.5 px-2 py-1 rounded-lg',
          'w-full min-w-0 border border-transparent bg-input transition-[color,box-shadow] outline-none',
          'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[0px]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'input-with-inline-variables-editor',
          className
        ),
      },
      handleKeyDown: (view, event) => {
        // Allow line breaks (Enter key)
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      // Mark that this update is coming from the editor
      isInternalUpdateRef.current = true;

      // When withFormatting is enabled, emit full Tiptap JSON
      // Otherwise emit string format for backward compatibility
      const newValue = withFormatting
        ? editor.getJSON()
        : convertContentToValue(editor.getJSON());

      if (withFormatting) {
        // Compare JSON objects
        if (JSON.stringify(newValue) !== JSON.stringify(value)) {
          onChange(newValue);
        }
      } else {
        // Compare strings
        if (newValue !== value) {
          onChange(newValue);
        }
      }
    },
    onCreate: ({ editor }) => {
      // Set initial content
      const content = withFormatting && typeof value === 'object'
        ? value
        : parseValueToContent(typeof value === 'string' ? value : '', fields, undefined, allFields);
      editor.commands.setContent(content);
    },
    onFocus: () => {},
    onBlur: () => {
      if (onBlurProp && editor) {
        const currentValue = withFormatting
          ? editor.getJSON()
          : convertContentToValue(editor.getJSON());
        onBlurProp(currentValue);
      }
    },
  }, [placeholder, extensions, withFormatting]);

  // Update editor editable state when disabled prop changes
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  // Update editor content when value or fields change externally
  useEffect(() => {
    if (!editor) return;

    // Skip update if it's coming from the editor itself
    if (isInternalUpdateRef.current) {
      isInternalUpdateRef.current = false;
      return;
    }

    // Compare current editor content with incoming value
    const currentEditorContent = editor.getJSON();
    let hasChanged = false;

    if (withFormatting && typeof value === 'object') {
      // Compare Tiptap JSON objects
      hasChanged = JSON.stringify(currentEditorContent) !== JSON.stringify(value);
    } else if (typeof value === 'string') {
      // Compare string representations
      const currentValue = convertContentToValue(currentEditorContent);
      hasChanged = currentValue !== value;
    }

    if (hasChanged) {
      // Check if editor was focused before updating content
      const wasFocused = editor.isFocused;
      const content = withFormatting && typeof value === 'object'
        ? value
        : parseValueToContent(typeof value === 'string' ? value : '', fields, undefined, allFields);
      editor.commands.setContent(content);

      // Only focus if editor was already focused (user was actively editing)
      if (wasFocused) {
        setTimeout(() => { editor.commands.focus('end'); }, 0);
      }
    } else if (fields) {
      // Update labels for existing nodes when fields change
      const json = editor.getJSON();
      let updated = false;

      const updateNodeLabels = (content: any[]): any[] => {
        return content.map((node: any) => {
          if (node.type === 'dynamicVariable' && node.attrs?.variable) {
            const variable = node.attrs.variable;
            if (variable.type === 'field' && variable.data?.field_id) {
              const newLabel = getVariableLabel(variable, fields, allFields);
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
  }, [value, fields, allFields, editor, withFormatting]);

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

    // Trigger onChange with updated value
    // When withFormatting is enabled, emit full Tiptap JSON
    // Otherwise emit string format for backward compatibility
    const newValue = withFormatting
      ? editor.getJSON()
      : convertContentToValue(editor.getJSON());
    onChange(newValue);

    let finalPosition = from;
    if (needsSpaceBefore) finalPosition += 1;
    finalPosition += 1;
    if (needsSpaceAfter) finalPosition += 1;

    setTimeout(() => {
      editor.commands.focus(finalPosition);
    }, 0);
  }, [editor, fields, allFields, onChange, withFormatting]);

  // Expose addFieldVariable function via ref
  useImperativeHandle(ref, () => ({
    addFieldVariable: addFieldVariableInternal,
  }), [addFieldVariableInternal]);

  if (!editor) {
    return null;
  }

  const handleFieldSelect = (fieldId: string, relationshipPath: string[]) => {
    if (!fields) return;

    addFieldVariableInternal({
      type: 'field',
      data: {
        field_id: fieldId,
        relationships: relationshipPath,
      },
    });

    // Close the dropdown after selection
    setIsDropdownOpen(false);
  };

  return (
    <div className="flex-1 input-with-inline-variables">
      {/* Formatting toolbar */}
      {withFormatting && (
        <div className="flex gap-0.5 bg-popover border border-border rounded-md shadow-sm p-0.5 mb-2">
          <Button
            variant="ghost"
            size="xs"
            className={cn('!size-6', editor.isActive('bold') && 'bg-accent')}
            disabled={disabled}
            onMouseDown={(e) => {
              e.preventDefault();
              if (!disabled) {
                editor.chain().focus().run();
                editor.commands.toggleMark('bold', {}, { extendEmptyMarkRange: true });
              }
            }}
            title="Bold"
          >
            <Icon name="bold" className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="xs"
            className={cn('!size-6', editor.isActive('italic') && 'bg-accent')}
            disabled={disabled}
            onMouseDown={(e) => {
              e.preventDefault();
              if (!disabled) {
                editor.chain().focus().run();
                editor.commands.toggleMark('italic', {}, { extendEmptyMarkRange: true });
              }
            }}
            title="Italic"
          >
            <Icon name="italic" className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="xs"
            className={cn('!size-6', editor.isActive('underline') && 'bg-accent')}
            disabled={disabled}
            onMouseDown={(e) => {
              e.preventDefault();
              if (!disabled) {
                editor.chain().focus().run();
                editor.commands.toggleMark('underline', {}, { extendEmptyMarkRange: true });
              }
            }}
            title="Underline"
          >
            <Icon name="underline" className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="xs"
            className={cn('!size-6', editor.isActive('strike') && 'bg-accent')}
            disabled={disabled}
            onMouseDown={(e) => {
              e.preventDefault();
              if (!disabled) {
                editor.chain().focus().run();
                editor.commands.toggleMark('strike', {}, { extendEmptyMarkRange: true });
              }
            }}
            title="Strikethrough"
          >
            <Icon name="strikethrough" className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="xs"
            className={cn('!size-6', editor.isActive('superscript') && 'bg-accent')}
            disabled={disabled}
            onMouseDown={(e) => {
              e.preventDefault();
              if (!disabled) {
                editor.chain().focus().run();
                editor.commands.toggleSuperscript();
              }
            }}
            title="Superscript"
          >
            <Icon name="superscript" className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="xs"
            className={cn('!size-6', editor.isActive('subscript') && 'bg-accent')}
            disabled={disabled}
            onMouseDown={(e) => {
              e.preventDefault();
              if (!disabled) {
                editor.chain().focus().run();
                editor.commands.toggleSubscript();
              }
            }}
            title="Subscript"
          >
            <Icon name="subscript" className="size-3" />
          </Button>
          <div className="w-px h-4 bg-border mx-0.5" />
          <Button
            variant="ghost"
            size="xs"
            className={cn('!size-6', editor.isActive('bulletList') && 'bg-accent')}
            disabled={disabled}
            onMouseDown={(e) => {
              e.preventDefault();
              if (!disabled) {
                editor.chain().focus().toggleBulletList().run();
              }
            }}
            title="Bullet List"
          >
            <Icon name="listUnordered" className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="xs"
            className={cn('!size-6', editor.isActive('orderedList') && 'bg-accent')}
            disabled={disabled}
            onMouseDown={(e) => {
              e.preventDefault();
              if (!disabled) {
                editor.chain().focus().toggleOrderedList().run();
              }
            }}
            title="Numbered List"
          >
            <Icon name="listOrdered" className="size-3" />
          </Button>

          {/* Inline Variable Button - in formatting toolbar */}
          {(() => {
            // Check if there are any displayable fields (exclude multi_reference)
            const displayableFields = fields?.filter((f) => f.type !== 'multi_reference') || [];
            const hasDisplayableFields = displayableFields.length > 0;

            return (
              <>
                <div className="w-px h-4 bg-border mx-0.5" />
                <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="xs"
                      className="!size-6"
                      title={hasDisplayableFields ? 'Insert Variable' : 'No variables available'}
                      disabled={!hasDisplayableFields || disabled}
                    >
                      <Icon name="database" className="size-3" />
                    </Button>
                  </DropdownMenuTrigger>

                  {hasDisplayableFields && (
                    <DropdownMenuContent
                      className="w-56 py-0 px-1 max-h-80 overflow-y-auto"
                      align="start"
                      sideOffset={4}
                    >
                      <FieldTreeSelect
                        fields={fields || []}
                        allFields={allFields || {}}
                        collections={collections || []}
                        onSelect={handleFieldSelect}
                        collectionLabel={fieldSourceLabel}
                      />
                    </DropdownMenuContent>
                  )}
                </DropdownMenu>
              </>
            );
          })()}
        </div>
      )}

      <div className="relative">
        <EditorContent editor={editor} />
      </div>

      {/* Inline Variable Button - absolute positioned (only when no formatting toolbar) */}
      {!disabled && !withFormatting && (() => {
        // Check if there are any displayable fields (exclude multi_reference)
        const displayableFields = fields?.filter((f) => f.type !== 'multi_reference') || [];
        const hasDisplayableFields = displayableFields.length > 0;

        return (
          <div className="absolute top-1 right-1">
            <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="secondary"
                  size="xs"
                  disabled={!hasDisplayableFields}
                  title={hasDisplayableFields ? 'Insert Variable' : 'No variables available'}
                >
                  <Icon name="database" className="size-2.5" />
                </Button>
              </DropdownMenuTrigger>

              {hasDisplayableFields && (
                <DropdownMenuContent
                  className="w-56 py-0 px-1 max-h-80 overflow-y-auto"
                  align="end"
                  sideOffset={4}
                >
                  <FieldTreeSelect
                    fields={fields || []}
                    allFields={allFields || {}}
                    collections={collections || []}
                    onSelect={handleFieldSelect}
                    collectionLabel={fieldSourceLabel}
                  />
                </DropdownMenuContent>
              )}
            </DropdownMenu>
          </div>
        );
      })()}
    </div>
  );
});

InputWithInlineVariables.displayName = 'InputWithInlineVariables';

export default InputWithInlineVariables;
