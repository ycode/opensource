'use client';

/**
 * Rich Text Editor
 *
 * Tiptap-based rich text editor that displays variable badges inline
 * Supports custom objects like { type: 'field', data: { field_id: ... } }
 * Data is stored in data-variable attribute as JSON-encoded string
 */

import React, { useEffect, useState, useImperativeHandle, forwardRef, useCallback, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { useEditor, EditorContent } from '@tiptap/react';
import { Node, Mark, mergeAttributes } from '@tiptap/core';
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
import Heading from '@tiptap/extension-heading';
import Blockquote from '@tiptap/extension-blockquote';
import Code from '@tiptap/extension-code';
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import FieldTreeSelect, { MultiSourceFieldTreeSelect, type FieldSourceType } from './FieldTreeSelect';
import { flattenFieldGroups, hasFieldsMatching, DISPLAYABLE_FIELD_TYPES, type FieldGroup } from '@/lib/collection-field-utils';
import { RichTextLink, getLinkSettingsFromMark } from '@/lib/tiptap-extensions/rich-text-link';
import RichTextLinkPopover from './RichTextLinkPopover';
import type { Layer, LinkSettings, LinkType } from '@/types';
import { DEFAULT_TEXT_STYLES } from '@/lib/text-format-utils';

interface RichTextEditorProps {
  value: string | any; // string for simple text, Tiptap JSON when withFormatting=true
  onChange: (value: string | any) => void;
  onBlur?: (value: string | any) => void;
  placeholder?: string;
  className?: string;
  /** Field groups with labels and sources for inline variable selection */
  fieldGroups?: FieldGroup[];
  /** All fields keyed by collection ID for resolving nested references */
  allFields?: Record<string, CollectionField[]>;
  /** All collections for reference field lookups */
  collections?: Collection[];
  /** Disable editing and hide database button */
  disabled?: boolean;
  /** Enable formatting toolbar (bold, italic, underline, strikethrough) - uses Tiptap JSON format */
  withFormatting?: boolean;
  /** Show or hide the formatting toolbar (defaults to true when withFormatting is enabled) */
  showFormattingToolbar?: boolean;
  /** Disable link support (useful when RichTextEditor is used inside link settings) */
  disableLinks?: boolean;
  /** Whether this is inside a collection layer */
  isInsideCollectionLayer?: boolean;
  /** Current layer for context */
  layer?: Layer | null;
  /** UI variant: 'compact' for layer content, 'full' for CMS rich-text fields */
  variant?: 'compact' | 'full';
  /** Size variant for compact mode: 'xs' for smaller text, 'sm' for larger text */
  size?: 'xs' | 'sm';
  /** Link types to exclude from the link settings dropdown */
  excludedLinkTypes?: LinkType[];
}

export interface RichTextEditorHandle {
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
                className="size-4! p-0! -mr-1"
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

/**
 * Custom Tiptap mark for dynamic text styles
 * Preserves the style keys from canvas text editor without applying visual styling
 */
const DynamicStyle = Mark.create({
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
    const lastKey = styleKeys[styleKeys.length - 1] || null;

    return ['span', mergeAttributes(HTMLAttributes, {
      'data-style-keys': JSON.stringify(styleKeys),
      'data-style-key': lastKey,
    }), 0];
  },
});

const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(({
  value,
  onChange,
  onBlur: onBlurProp,
  placeholder = '',
  className,
  fieldGroups,
  allFields,
  collections,
  disabled = false,
  withFormatting = false,
  showFormattingToolbar = true,
  disableLinks = false,
  isInsideCollectionLayer = false,
  layer,
  variant = 'compact',
  size = 'xs',
  excludedLinkTypes = [],
}, ref) => {
  const isFullVariant = variant === 'full';
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
  // Track if update is coming from editor to prevent infinite loop
  const isInternalUpdateRef = useRef(false);

  // Derive a flat list of fields from fieldGroups (for internal use like parseValueToContent)
  const fields = useMemo(() => flattenFieldGroups(fieldGroups), [fieldGroups]);

  // Check if there are any displayable fields (exclude multi_reference)
  const canShowVariables = useMemo(
    () => hasFieldsMatching(fieldGroups, f => DISPLAYABLE_FIELD_TYPES.includes(f.type)),
    [fieldGroups]
  );

  const extensions = useMemo(() => {
    const baseExtensions = [
      Document,
      Paragraph,
      Text,
      DynamicVariable,
      DynamicStyle,
      Placeholder.configure({
        placeholder,
      }),
    ];

    if (withFormatting) {
      const formattingExtensions = [
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
        Blockquote,
        Code,
      ];

      // Add heading extension for full variant (CMS rich-text)
      if (isFullVariant) {
        formattingExtensions.push(
          Heading.configure({
            levels: [1, 2, 3, 4, 5, 6],
          })
        );
      }

      // Add link extension unless explicitly disabled
      if (!disableLinks) {
        formattingExtensions.push(
          RichTextLink.extend({
            addOptions() {
              return {
                ...this.parent?.(),
                HTMLAttributes: {
                  class: DEFAULT_TEXT_STYLES.link?.classes || '',
                },
              };
            },
          })
        );
      }

      return formattingExtensions;
    }

    return baseExtensions;
  }, [placeholder, withFormatting, disableLinks, isFullVariant]);

  const editor = useEditor({
    immediatelyRender: true,
    extensions,
    content: (() => {
      if (withFormatting) {
        // For formatting mode, expect TipTap JSON
        if (typeof value === 'object' && value !== null) {
          return value;
        }
        // Try to parse JSON string (in case DB returned stringified JSON)
        if (typeof value === 'string' && value.startsWith('{')) {
          try {
            return JSON.parse(value);
          } catch {
            // Not valid JSON, fall through
          }
        }
        // Return empty doc for empty/invalid values
        return { type: 'doc', content: [{ type: 'paragraph' }] };
      }
      // For non-formatting mode, parse string with inline variables
      return parseValueToContent(typeof value === 'string' ? value : '', fields, undefined, allFields);
    })(),
    editorProps: {
      attributes: {
        class: cn(
          'w-full min-w-0 border border-transparent bg-input transition-[color,box-shadow] outline-none rounded-lg',
          'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[0px]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'rich-text-editor',
          // Compact variant (default) - size-based text and padding
          !isFullVariant && size === 'xs' && 'min-h-[2rem] text-xs leading-5.5 px-2 py-1',
          !isFullVariant && size === 'sm' && 'min-h-[2.5rem] text-sm leading-6 px-3 py-1.5',
          // Full variant - larger text, more padding
          // Element styles (h1-h6, p, ul, ol, li, blockquote, code) defined in globals.css
          isFullVariant && 'rich-text-editor-full min-h-[200px] leading-relaxed px-3 py-2.5',
          className
        ),
      },
      handleKeyDown: (view, event) => {
        // Allow line breaks (Enter key)
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      // Don't trigger updates if editor is disabled (e.g., during canvas text editing)
      if (!editor.isEditable) {
        return;
      }

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

    // Skip updates when editor is disabled (e.g., during canvas text editing)
    if (!editor.isEditable) {
      return;
    }

    // Skip update if it's coming from the editor itself
    if (isInternalUpdateRef.current) {
      isInternalUpdateRef.current = false;
      return;
    }

    // Compare current editor content with incoming value
    const currentEditorContent = editor.getJSON();
    let hasChanged = false;

    if (withFormatting) {
      // For formatting mode, compare TipTap JSON
      let incomingContent = value;
      if (typeof value === 'string' && value.startsWith('{')) {
        try {
          incomingContent = JSON.parse(value);
        } catch {
          incomingContent = null;
        }
      }
      if (typeof incomingContent === 'object' && incomingContent !== null) {
        hasChanged = JSON.stringify(currentEditorContent) !== JSON.stringify(incomingContent);
      } else {
        // Empty or invalid value - check if editor has content
        hasChanged = currentEditorContent.content?.some((block: any) =>
          block.content && block.content.length > 0
        ) ?? false;
      }
    } else if (typeof value === 'string') {
      // Compare string representations
      const currentValue = convertContentToValue(currentEditorContent);
      hasChanged = currentValue !== value;
    }

    if (hasChanged) {
      // Check if editor was focused before updating content
      const wasFocused = editor.isFocused;
      let content: any;
      if (withFormatting) {
        if (typeof value === 'object' && value !== null) {
          content = value;
        } else if (typeof value === 'string' && value.startsWith('{')) {
          try {
            content = JSON.parse(value);
          } catch {
            content = { type: 'doc', content: [{ type: 'paragraph' }] };
          }
        } else {
          content = { type: 'doc', content: [{ type: 'paragraph' }] };
        }
      } else {
        content = parseValueToContent(typeof value === 'string' ? value : '', fields, undefined, allFields);
      }
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

  const handleFieldSelect = (fieldId: string, relationshipPath: string[], source?: FieldSourceType) => {
    const field = fields.find(f => f.id === fieldId);
    addFieldVariableInternal({
      type: 'field',
      data: {
        field_id: fieldId,
        relationships: relationshipPath,
        source,
        field_type: field?.type || null,
      },
    });

    // Close the dropdown after selection
    setIsDropdownOpen(false);
  };

  return (
    <div className={cn('flex-1 rich-text-editor relative', isFullVariant && 'flex flex-col gap-2')}>
      {/* Formatting toolbar - Full variant (CMS style like original TiptapEditor) */}
      {withFormatting && showFormattingToolbar && isFullVariant && (
        <div className="flex items-center gap-2">
          <Select
            value={
              editor.isActive('heading', { level: 1 }) ? 'h1' :
                editor.isActive('heading', { level: 2 }) ? 'h2' :
                  editor.isActive('heading', { level: 3 }) ? 'h3' :
                    editor.isActive('heading', { level: 4 }) ? 'h4' :
                      editor.isActive('heading', { level: 5 }) ? 'h5' :
                        editor.isActive('heading', { level: 6 }) ? 'h6' :
                          'paragraph'
            }
            onValueChange={(value) => {
              if (value === 'paragraph') {
                editor.chain().focus().setParagraph().run();
              } else {
                const level = parseInt(value.replace('h', '')) as 1 | 2 | 3 | 4 | 5 | 6;
                editor.chain().focus().setHeading({ level }).run();
              }
            }}
            disabled={disabled}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="paragraph">Paragraph</SelectItem>
              <SelectItem value="h1">Heading 1</SelectItem>
              <SelectItem value="h2">Heading 2</SelectItem>
              <SelectItem value="h3">Heading 3</SelectItem>
              <SelectItem value="h4">Heading 4</SelectItem>
              <SelectItem value="h5">Heading 5</SelectItem>
              <SelectItem value="h6">Heading 6</SelectItem>
            </SelectContent>
          </Select>

          {/* Link button */}
          {!disableLinks && (
            <ToggleGroup
              type="single"
              size="xs"
              variant="secondary"
              spacing={1}
            >
              <RichTextLinkPopover
                editor={editor}
                fieldGroups={fieldGroups}
                allFields={allFields}
                collections={collections}
                isInsideCollectionLayer={isInsideCollectionLayer}
                layer={layer}
                open={linkPopoverOpen}
                onOpenChange={setLinkPopoverOpen}
                excludedLinkTypes={excludedLinkTypes}
                trigger={
                  <ToggleGroupItem
                    value="link"
                    data-state={editor.isActive('richTextLink') ? 'on' : 'off'}
                    asChild
                  >
                    <button
                      type="button"
                      disabled={disabled}
                      title="Link"
                      className="w-auto min-w-0 shrink-0"
                    >
                      <Icon name="link" className="size-3" />
                    </button>
                  </ToggleGroupItem>
                }
              />
            </ToggleGroup>
          )}

          {/* Text formatting */}
          <ToggleGroup
            type="multiple"
            size="xs"
            variant="secondary"
            spacing={1}
          >
            <ToggleGroupItem
              value="bold"
              data-state={editor.isActive('bold') ? 'on' : 'off'}
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              <Icon name="bold" className="size-3" />
            </ToggleGroupItem>
            <ToggleGroupItem
              value="italic"
              data-state={editor.isActive('italic') ? 'on' : 'off'}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              <Icon name="italic" className="size-3" />
            </ToggleGroupItem>
            <ToggleGroupItem
              value="underline"
              data-state={editor.isActive('underline') ? 'on' : 'off'}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
            >
              <Icon name="underline" className="size-3" />
            </ToggleGroupItem>
            <ToggleGroupItem
              value="strike"
              data-state={editor.isActive('strike') ? 'on' : 'off'}
              onClick={() => editor.chain().focus().toggleStrike().run()}
            >
              <Icon name="strikethrough" className="size-3" />
            </ToggleGroupItem>
            <ToggleGroupItem
              value="superscript"
              data-state={editor.isActive('superscript') ? 'on' : 'off'}
              onClick={() => editor.chain().focus().toggleSuperscript().run()}
            >
              <Icon name="superscript" className="size-3" />
            </ToggleGroupItem>
            <ToggleGroupItem
              value="subscript"
              data-state={editor.isActive('subscript') ? 'on' : 'off'}
              onClick={() => editor.chain().focus().toggleSubscript().run()}
            >
              <Icon name="subscript" className="size-3" />
            </ToggleGroupItem>
          </ToggleGroup>

          {/* Lists */}
          <ToggleGroup
            type="multiple"
            size="xs"
            variant="secondary"
            spacing={1}
          >
            <ToggleGroupItem
              value="bulletList"
              data-state={editor.isActive('bulletList') ? 'on' : 'off'}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            >
              <Icon name="listUnordered" className="size-3" />
            </ToggleGroupItem>
            <ToggleGroupItem
              value="orderedList"
              data-state={editor.isActive('orderedList') ? 'on' : 'off'}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
            >
              <Icon name="listOrdered" className="size-3" />
            </ToggleGroupItem>
          </ToggleGroup>

          {/* Block formatting */}
          <ToggleGroup
            type="multiple"
            size="xs"
            variant="secondary"
            spacing={1}
          >
            <ToggleGroupItem
              value="blockquote"
              data-state={editor.isActive('blockquote') ? 'on' : 'off'}
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
            >
              <Icon name="quote" className="size-3" />
            </ToggleGroupItem>
            <ToggleGroupItem
              value="code"
              data-state={editor.isActive('code') ? 'on' : 'off'}
              onClick={() => editor.chain().focus().toggleCode().run()}
            >
              <Icon name="code" className="size-3" />
            </ToggleGroupItem>
          </ToggleGroup>

          {/* Inline Variable Button */}
          {canShowVariables && (
            <ToggleGroup
              type="single"
              size="xs"
              variant="secondary"
              spacing={1}
            >
              <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <ToggleGroupItem value="variable" asChild>
                    <button
                      type="button"
                      title="Insert Variable"
                      disabled={disabled}
                      className="w-auto min-w-0 shrink-0"
                    >
                      <Icon name="database" className="size-3" />
                    </button>
                  </ToggleGroupItem>
                </DropdownMenuTrigger>
                {fieldGroups && (
                  <DropdownMenuContent
                    className="w-56 py-0 px-1 max-h-80 overflow-y-auto"
                    align="start"
                    sideOffset={4}
                  >
                    <MultiSourceFieldTreeSelect
                      fieldGroups={fieldGroups}
                      allFields={allFields || {}}
                      collections={collections || []}
                      onSelect={handleFieldSelect}
                    />
                  </DropdownMenuContent>
                )}
              </DropdownMenu>
            </ToggleGroup>
          )}
        </div>
      )}

      {/* Formatting toolbar - Compact variant */}
      {withFormatting && showFormattingToolbar && !isFullVariant && (
        <div className="flex gap-0.5 bg-popover border border-border rounded-md shadow-sm p-0.5 mb-2">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className={cn('size-6!', editor.isActive('bold') && 'bg-accent')}
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
            type="button"
            variant="ghost"
            size="xs"
            className={cn('size-6!', editor.isActive('italic') && 'bg-accent')}
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
            type="button"
            variant="ghost"
            size="xs"
            className={cn('size-6!', editor.isActive('underline') && 'bg-accent')}
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
            type="button"
            variant="ghost"
            size="xs"
            className={cn('size-6!', editor.isActive('strike') && 'bg-accent')}
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
            type="button"
            variant="ghost"
            size="xs"
            className={cn('size-6!', editor.isActive('superscript') && 'bg-accent')}
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
            type="button"
            variant="ghost"
            size="xs"
            className={cn('size-6!', editor.isActive('subscript') && 'bg-accent')}
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
            type="button"
            variant="ghost"
            size="xs"
            className={cn('size-6!', editor.isActive('bulletList') && 'bg-accent')}
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
            type="button"
            variant="ghost"
            size="xs"
            className={cn('size-6!', editor.isActive('orderedList') && 'bg-accent')}
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
          <div className="w-px h-4 bg-border mx-0.5" />
          <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="size-6!"
                title={canShowVariables ? 'Insert Variable' : 'No variables available'}
                disabled={!canShowVariables || disabled}
              >
                <Icon name="database" className="size-3" />
              </Button>
            </DropdownMenuTrigger>

            {canShowVariables && fieldGroups && (
              <DropdownMenuContent
                className="w-56 py-0 px-1 max-h-80 overflow-y-auto"
                align="start"
                sideOffset={4}
              >
                <MultiSourceFieldTreeSelect
                  fieldGroups={fieldGroups}
                  allFields={allFields || {}}
                  collections={collections || []}
                  onSelect={handleFieldSelect}
                />
              </DropdownMenuContent>
            )}
          </DropdownMenu>

          {/* Link Button */}
          {!disableLinks && (
            <>
              <div className="w-px h-4 bg-border mx-0.5" />
              <RichTextLinkPopover
                editor={editor}
                fieldGroups={fieldGroups}
                allFields={allFields}
                collections={collections}
                isInsideCollectionLayer={isInsideCollectionLayer}
                layer={layer}
                open={linkPopoverOpen}
                onOpenChange={setLinkPopoverOpen}
                excludedLinkTypes={excludedLinkTypes}
                trigger={
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className={cn('size-6!', editor.isActive('richTextLink') && 'bg-accent')}
                    disabled={disabled}
                    title="Link"
                  >
                    <Icon name="link" className="size-3" />
                  </Button>
                }
              />
            </>
          )}
        </div>
      )}

      <div className="relative">
        <EditorContent editor={editor} />
      </div>

      {/* Inline Variable Button - absolute positioned (when no formatting toolbar is shown) */}
      {!disabled && (!withFormatting || !showFormattingToolbar) && canShowVariables && (
        <div className="absolute top-1 right-1">
          <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                size="xs"
                title="Insert Variable"
              >
                <Icon name="database" className="size-2.5" />
              </Button>
            </DropdownMenuTrigger>

            {fieldGroups && (
              <DropdownMenuContent
                className="w-56 py-0 px-1 max-h-80 overflow-y-auto"
                align="end"
                sideOffset={4}
              >
                <MultiSourceFieldTreeSelect
                  fieldGroups={fieldGroups}
                  allFields={allFields || {}}
                  collections={collections || []}
                  onSelect={handleFieldSelect}
                />
              </DropdownMenuContent>
            )}
          </DropdownMenu>
        </div>
      )}
    </div>
  );
});

RichTextEditor.displayName = 'RichTextEditor';

export default RichTextEditor;
