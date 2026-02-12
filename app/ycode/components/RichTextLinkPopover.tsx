'use client';

/**
 * Rich Text Link Popover Component
 *
 * Popover for editing links in TipTap rich text editors.
 * Wraps RichTextLinkSettings and provides apply/remove actions.
 */

import React, { useState, useCallback } from 'react';
import { Editor } from '@tiptap/core';

import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import RichTextLinkSettings from './RichTextLinkSettings';
import { getLinkSettingsFromMark } from '@/lib/tiptap-extensions/rich-text-link';
import type { Layer, CollectionField, Collection, LinkSettings, LinkType } from '@/types';
import type { FieldGroup } from './CollectionFieldSelector';

export interface RichTextLinkPopoverProps {
  /** TipTap editor instance */
  editor: Editor;
  /** Field groups with labels and sources for inline variable selection */
  fieldGroups?: FieldGroup[];
  /** All fields by collection ID */
  allFields?: Record<string, CollectionField[]>;
  /** Available collections */
  collections?: Collection[];
  /** Whether inside a collection layer */
  isInsideCollectionLayer?: boolean;
  /** Current layer (for context) */
  layer?: Layer | null;
  /** Custom trigger button (optional) */
  trigger?: React.ReactNode;
  /** Whether popover is open (controlled) */
  open?: boolean;
  /** Callback when open state changes (controlled) */
  onOpenChange?: (open: boolean) => void;
  /** Whether the link button is disabled */
  disabled?: boolean;
  /** Link types to exclude from the dropdown */
  excludedLinkTypes?: LinkType[];
}

/**
 * Popover for managing rich text links
 */
export default function RichTextLinkPopover({
  editor,
  fieldGroups,
  allFields,
  collections,
  isInsideCollectionLayer = false,
  layer,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  disabled = false,
  excludedLinkTypes = [],
}: RichTextLinkPopoverProps) {
  // Use controlled state if provided, otherwise internal state
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  // Link settings state
  const [linkSettings, setLinkSettings] = useState<LinkSettings | null>(null);

  // Save selection range and hasLink state when popover opens
  const [savedSelection, setSavedSelection] = useState<{ from: number; to: number } | null>(null);
  const [hadLinkOnOpen, setHadLinkOnOpen] = useState(false);

  // Check if text has link mark (for display only)
  const hasLink = editor.isActive('richTextLink');

  // Custom open change handler that captures selection before opening
  const handleOpenChange = useCallback((newOpen: boolean) => {
    // Prevent opening if disabled
    if (newOpen && disabled) {
      return;
    }

    if (newOpen) {
      // Capture selection and link state BEFORE opening
      let { from, to } = editor.state.selection;

      const currentHasLink = editor.isActive('richTextLink');
      setHadLinkOnOpen(currentHasLink);

      // If cursor is on a link but no text is selected, extend to full mark range
      if (currentHasLink && from === to) {
        const markType = editor.schema.marks.richTextLink;
        if (markType) {
          const $pos = editor.state.doc.resolve(from);
          const start = $pos.parent.childAfter($pos.parentOffset);

          if (start.node) {
            // Find the mark on the current node
            const mark = start.node.marks.find(m => m.type === markType);
            if (mark) {
              // Calculate mark boundaries within the parent
              let markStart = $pos.start();
              let markEnd = $pos.start();
              let foundStart = false;

              $pos.parent.forEach((node, offset) => {
                const hasMark = node.marks.some(m => m.type === markType && m.eq(mark));
                if (hasMark) {
                  if (!foundStart) {
                    markStart = $pos.start() + offset;
                    foundStart = true;
                  }
                  markEnd = $pos.start() + offset + node.nodeSize;
                } else if (foundStart) {
                  // We've passed the mark range
                  return false;
                }
              });

              from = markStart;
              to = markEnd;
            }
          }
        }
      }

      setSavedSelection({ from, to });

      if (currentHasLink) {
        // Get current link attributes from selection
        const attrs = editor.getAttributes('richTextLink');
        setLinkSettings(getLinkSettingsFromMark(attrs));
      } else {
        // Default to URL type for new links
        setLinkSettings({
          type: 'url',
          url: { type: 'dynamic_text', data: { content: '' } },
        });
      }
    }

    // Update the open state
    if (isControlled) {
      controlledOnOpenChange!(newOpen);
    } else {
      setInternalOpen(newOpen);
    }
  }, [editor, isControlled, controlledOnOpenChange, disabled]);

  // For closing without going through handleOpenChange
  const closePopover = useCallback(() => {
    if (isControlled) {
      controlledOnOpenChange!(false);
    } else {
      setInternalOpen(false);
    }
  }, [isControlled, controlledOnOpenChange]);

  // Handle settings change
  const handleSettingsChange = useCallback((settings: LinkSettings | null) => {
    setLinkSettings(settings);
  }, []);

  // Apply link to selection
  const handleApply = useCallback(() => {
    if (!savedSelection) {
      closePopover();
      return;
    }

    const { from, to } = savedSelection;

    if (!linkSettings) {
      // Remove link if settings are null
      editor.chain()
        .focus()
        .setTextSelection({ from, to })
        .unsetRichTextLink()
        .run();
      closePopover();
      return;
    }

    // Get the mark type from schema
    const markType = editor.schema.marks.richTextLink;
    if (!markType) {
      closePopover();
      return;
    }

    // Use a direct transaction to update/add the mark
    editor.chain().focus().setTextSelection({ from, to }).run();

    // Create and dispatch a transaction that removes old mark (if any) and adds new one
    const { state } = editor;
    const tr = state.tr;

    // Remove any existing richTextLink marks in the range
    tr.removeMark(from, to, markType);
    // Add the new mark with updated settings
    tr.addMark(from, to, markType.create(linkSettings as any));

    // Dispatch the transaction
    editor.view.dispatch(tr);

    closePopover();
  }, [editor, linkSettings, savedSelection, closePopover]);

  // Remove link from selection
  const handleRemove = useCallback(() => {
    if (!savedSelection) {
      editor.chain().focus().unsetRichTextLink().run();
      closePopover();
      return;
    }

    const { from, to } = savedSelection;
    editor.chain()
      .focus()
      .setTextSelection({ from, to })
      .unsetRichTextLink()
      .run();
    closePopover();
  }, [editor, savedSelection, closePopover]);

  // Default trigger button
  const defaultTrigger = (
    <Button
      variant={hasLink ? 'default' : 'ghost'}
      size="icon"
      className="size-7"
      title={disabled ? 'Links cannot be nested' : 'Link'}
      disabled={disabled}
    >
      <Icon name="link" className="size-3.5" />
    </Button>
  );

  return (
    <Popover
      open={open}
      onOpenChange={handleOpenChange}
    >
      <PopoverTrigger asChild>
        {trigger || defaultTrigger}
      </PopoverTrigger>

      <PopoverContent
        className="w-64 p-0 bg-background border-border overflow-hidden"
        align="start"
        side="bottom"
        sideOffset={8}
      >
        <div className="flex flex-col">
          <div className="px-3 py-3.5 border-b bg-input/50">
            <h4 className="text-xs font-medium">Link settings</h4>
          </div>

          <div className="p-1 py-2">
            <RichTextLinkSettings
              value={linkSettings}
              onChange={handleSettingsChange}
              fieldGroups={fieldGroups}
              allFields={allFields}
              collections={collections}
              isInsideCollectionLayer={isInsideCollectionLayer}
              layer={layer}
              excludedLinkTypes={excludedLinkTypes}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between p-3 gap-2">
            {hadLinkOnOpen && (
              <Button
                variant="ghost"
                size="xs"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleRemove}
                className="text-destructive hover:text-destructive"
              >
                Remove
              </Button>
            )}

            <div className="flex-1" />

            <Button
              variant="ghost"
              size="xs"
              onClick={closePopover}
            >
              Cancel
            </Button>

            <Button
              size="xs"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleApply}
              disabled={!linkSettings || (linkSettings.type === 'url' && !linkSettings.url?.data?.content)}
            >
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
