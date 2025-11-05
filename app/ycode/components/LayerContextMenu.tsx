'use client';

/**
 * Layer Context Menu Component
 * 
 * Right-click context menu for layers with clipboard operations
 * Works in both LayersTree sidebar and canvas
 */

import React, { useMemo } from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator, ContextMenuShortcut, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { usePagesStore } from '@/stores/usePagesStore';
import { useClipboardStore } from '@/stores/useClipboardStore';
import { Copy, Scissors, Clipboard, ClipboardPaste, CopyPlus, Trash2 } from 'lucide-react';
import { canHaveChildren, findLayerById, getClassesString } from '@/lib/layer-utils';
import type { Layer } from '@/types';

interface LayerContextMenuProps {
  layerId: string;
  pageId: string;
  children: React.ReactNode;
  isLocked?: boolean;
  onLayerSelect?: (layerId: string) => void;
}

export default function LayerContextMenu({
  layerId,
  pageId,
  children,
  isLocked = false,
  onLayerSelect,
}: LayerContextMenuProps) {
  const copyLayer = usePagesStore((state) => state.copyLayer);
  const deleteLayer = usePagesStore((state) => state.deleteLayer);
  const duplicateLayer = usePagesStore((state) => state.duplicateLayer);
  const pasteAfter = usePagesStore((state) => state.pasteAfter);
  const pasteInside = usePagesStore((state) => state.pasteInside);
  const updateLayer = usePagesStore((state) => state.updateLayer);
  const draftsByPageId = usePagesStore((state) => state.draftsByPageId);
  
  const clipboardLayer = useClipboardStore((state) => state.clipboardLayer);
  const clipboardMode = useClipboardStore((state) => state.clipboardMode);
  const copyToClipboard = useClipboardStore((state) => state.copyLayer);
  const cutToClipboard = useClipboardStore((state) => state.cutLayer);
  const copyStyleToClipboard = useClipboardStore((state) => state.copyStyle);
  const pasteStyleFromClipboard = useClipboardStore((state) => state.pasteStyle);
  const copiedStyle = useClipboardStore((state) => state.copiedStyle);

  const hasClipboard = clipboardLayer !== null;
  const hasStyleClipboard = copiedStyle !== null;

  // Check if the current layer can have children
  const canPasteInside = useMemo(() => {
    const draft = draftsByPageId[pageId];
    if (!draft) return false;

    const layer = findLayerById(draft.layers, layerId);
    if (!layer) return false;

    return canHaveChildren(layer);
  }, [draftsByPageId, pageId, layerId]);

  const handleCopy = () => {
    const layer = copyLayer(pageId, layerId);
    if (layer) {
      copyToClipboard(layer, pageId);
    }
  };

  const handleCut = () => {
    if (isLocked) return;
    const layer = copyLayer(pageId, layerId);
    if (layer) {
      cutToClipboard(layer, pageId);
      deleteLayer(pageId, layerId);
      // Clear selection after cut to match keyboard shortcut behavior
      if (onLayerSelect) {
        onLayerSelect(null as any);
      }
    }
  };

  const handlePasteAfter = () => {
    if (!clipboardLayer) return;
    pasteAfter(pageId, layerId, clipboardLayer);
  };

  const handlePasteInside = () => {
    if (!clipboardLayer || !canPasteInside) return;
    pasteInside(pageId, layerId, clipboardLayer);
  };

  const handleDuplicate = () => {
    duplicateLayer(pageId, layerId);
  };

  const handleDelete = () => {
    if (isLocked) return;
    deleteLayer(pageId, layerId);
    // Clear selection after delete to match keyboard shortcut behavior
    if (onLayerSelect) {
      onLayerSelect(null as any);
    }
  };

  const handleCopyStyle = () => {
    const draft = draftsByPageId[pageId];
    if (!draft) return;

    const layer = findLayerById(draft.layers, layerId);
    if (!layer) return;

    // Copy complete style information using utility
    const classes = getClassesString(layer);
    copyStyleToClipboard(classes, layer.design, layer.styleId, layer.styleOverrides);
  };

  const handlePasteStyle = () => {
    const style = pasteStyleFromClipboard();
    if (!style) return;

    // Apply all copied style properties to the current layer
    updateLayer(pageId, layerId, {
      classes: style.classes,
      design: style.design,
      styleId: style.styleId,
      styleOverrides: style.styleOverrides,
    });
  };

  const handleOpenChange = (open: boolean) => {
    // When context menu opens, select this layer for visual feedback
    if (open && onLayerSelect) {
      onLayerSelect(layerId);
    }
  };

  return (
    <ContextMenu onOpenChange={handleOpenChange}>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-44">
        <ContextMenuItem onClick={handleCut} disabled={isLocked}>
          Cut
          <ContextMenuShortcut>⌘X</ContextMenuShortcut>
        </ContextMenuItem>
        
        <ContextMenuItem onClick={handleCopy}>
          Copy
          <ContextMenuShortcut>⌘C</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuSub>
          <ContextMenuSubTrigger>Paste</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem onClick={handlePasteAfter} disabled={!hasClipboard}>
              Paste after
              <ContextMenuShortcut>⌘V</ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuItem onClick={handlePasteInside} disabled={!hasClipboard || !canPasteInside}>
              Paste inside
              <ContextMenuShortcut>⌘⇧V</ContextMenuShortcut>
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        
        <ContextMenuSeparator />
        
        <ContextMenuItem onClick={handleDuplicate}>
          Duplicate
          <ContextMenuShortcut>⌘D</ContextMenuShortcut>
        </ContextMenuItem>
        
        <ContextMenuItem 
          onClick={handleDelete} 
          disabled={isLocked}
        >
          Delete
          <ContextMenuShortcut>⌫</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem onClick={handleCopyStyle}>
          Copy style
          <ContextMenuShortcut>⌥⌘C</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuItem onClick={handlePasteStyle} disabled={!hasStyleClipboard}>
          Paste style
          <ContextMenuShortcut>⌥⌘V</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

