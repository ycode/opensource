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
import { canHaveChildren } from '@/lib/layer-utils';
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
  const draftsByPageId = usePagesStore((state) => state.draftsByPageId);
  
  const clipboardLayer = useClipboardStore((state) => state.clipboardLayer);
  const clipboardMode = useClipboardStore((state) => state.clipboardMode);
  const copyToClipboard = useClipboardStore((state) => state.copyLayer);
  const cutToClipboard = useClipboardStore((state) => state.cutLayer);

  const hasClipboard = clipboardLayer !== null;

  // Check if the current layer can have children
  const canPasteInside = useMemo(() => {
    const draft = draftsByPageId[pageId];
    if (!draft) return false;

    // Find the layer recursively
    const findLayer = (layers: Layer[], id: string): Layer | null => {
      for (const layer of layers) {
        if (layer.id === id) return layer;
        if (layer.children) {
          const found = findLayer(layer.children, id);
          if (found) return found;
        }
      }
      return null;
    };

    const layer = findLayer(draft.layers, layerId);
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
      </ContextMenuContent>
    </ContextMenu>
  );
}

