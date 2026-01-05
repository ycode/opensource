'use client';

/**
 * Layer Context Menu Component
 *
 * Right-click context menu for layers with clipboard operations
 * Works in both LayersTree sidebar and canvas
 */

import React, { useMemo, useState } from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator, ContextMenuShortcut, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { useEditorStore } from '@/stores/useEditorStore';
import { usePagesStore } from '@/stores/usePagesStore';
import { useClipboardStore } from '@/stores/useClipboardStore';
import { useComponentsStore } from '@/stores/useComponentsStore';
import { canHaveChildren, findLayerById, getClassesString, regenerateIdsWithInteractionRemapping, regenerateInteractionIds, canCopyLayer, canDeleteLayer } from '@/lib/layer-utils';
import { useLiveLayerUpdates } from '@/hooks/use-live-layer-updates';
import type { Layer } from '@/types';
import CreateComponentDialog from './CreateComponentDialog';

interface LayerContextMenuProps {
  layerId: string;
  pageId: string;
  children: React.ReactNode;
  isLocked?: boolean;
  onLayerSelect?: (layerId: string) => void;
  selectedLayerId?: string | null;
}

export default function LayerContextMenu({
  layerId,
  pageId,
  children,
  isLocked = false,
  onLayerSelect,
  selectedLayerId,
}: LayerContextMenuProps) {
  const [isComponentDialogOpen, setIsComponentDialogOpen] = useState(false);
  const [layerName, setLayerName] = useState('');

  // Collaboration hooks
  const liveLayerUpdates = useLiveLayerUpdates(pageId);

  const copyLayer = usePagesStore((state) => state.copyLayer);
  const deleteLayer = usePagesStore((state) => state.deleteLayer);
  const duplicateLayer = usePagesStore((state) => state.duplicateLayer);
  const pasteAfter = usePagesStore((state) => state.pasteAfter);
  const pasteInside = usePagesStore((state) => state.pasteInside);
  const updateLayer = usePagesStore((state) => state.updateLayer);
  const draftsByPageId = usePagesStore((state) => state.draftsByPageId);
  const createComponentFromLayer = usePagesStore((state) => state.createComponentFromLayer);

  const loadComponents = useComponentsStore((state) => state.loadComponents);
  const getComponentById = useComponentsStore((state) => state.getComponentById);

  const clipboardLayer = useClipboardStore((state) => state.clipboardLayer);
  const clipboardMode = useClipboardStore((state) => state.clipboardMode);
  const copyToClipboard = useClipboardStore((state) => state.copyLayer);
  const cutToClipboard = useClipboardStore((state) => state.cutLayer);
  const copyStyleToClipboard = useClipboardStore((state) => state.copyStyle);
  const pasteStyleFromClipboard = useClipboardStore((state) => state.pasteStyle);
  const copiedStyle = useClipboardStore((state) => state.copiedStyle);
  const copyInteractionsToClipboard = useClipboardStore((state) => state.copyInteractions);
  const pasteInteractionsFromClipboard = useClipboardStore((state) => state.pasteInteractions);
  const copiedInteractions = useClipboardStore((state) => state.copiedInteractions);

  const hasClipboard = clipboardLayer !== null;
  const hasStyleClipboard = copiedStyle !== null;
  const hasInteractionsClipboard = copiedInteractions !== null;

  // Check if this layer is a component instance
  const draft = draftsByPageId[pageId];
  const layer = draft ? findLayerById(draft.layers, layerId) : null;

  // Debug logging for development
  if (process.env.NODE_ENV === 'development' && !layer) {
    console.warn(`[LayerContextMenu] Could not find layer ${layerId} in page ${pageId}. Draft exists:`, !!draft, 'Layers count:', draft?.layers?.length);
  }

  const isComponentInstance = !!(layer && layer.componentId);
  const componentName = isComponentInstance && layer?.componentId
    ? getComponentById(layer.componentId)?.name
    : null;

  // Check if the current layer can have children
  const canPasteInside = useMemo(() => {
    const draft = draftsByPageId[pageId];
    if (!draft) return false;

    const layer = findLayerById(draft.layers, layerId);
    if (!layer) return false;

    return canHaveChildren(layer);
  }, [draftsByPageId, pageId, layerId]);

  // Check layer restrictions
  const canCopy = useMemo(() => {
    if (!layer) return false;
    return canCopyLayer(layer);
  }, [layer]);

  const canDelete = useMemo(() => {
    if (!layer) return false;
    return canDeleteLayer(layer);
  }, [layer]);

  const handleCopy = () => {
    if (!canCopy) return;
    const layer = copyLayer(pageId, layerId);
    if (layer) {
      copyToClipboard(layer, pageId);
    }
  };

  const handleCut = () => {
    if (isLocked || !canCopy || !canDelete) return;
    const layer = copyLayer(pageId, layerId);
    if (layer) {
      cutToClipboard(layer, pageId);
      deleteLayer(pageId, layerId);

      // Broadcast delete to other collaborators
      if (liveLayerUpdates) {
        liveLayerUpdates.broadcastLayerDelete(pageId, layerId);
      }

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
    if (!canCopy) return;
    duplicateLayer(pageId, layerId);
  };

  const handleDelete = () => {
    if (isLocked || !canDelete) return;
    deleteLayer(pageId, layerId);

    // Broadcast delete to other collaborators
    if (liveLayerUpdates) {
      liveLayerUpdates.broadcastLayerDelete(pageId, layerId);
    }

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

  const handleCopyInteractions = () => {
    const draft = draftsByPageId[pageId];
    if (!draft) return;

    const layer = findLayerById(draft.layers, layerId);
    if (!layer || !layer.interactions || layer.interactions.length === 0) return;

    copyInteractionsToClipboard(layer.interactions, layerId);
  };

  const handlePasteInteractions = () => {
    const copiedData = pasteInteractionsFromClipboard();
    if (!copiedData) return;

    const { interactions, sourceLayerId } = copiedData;

    // Create layer ID map for remapping source layer to target layer
    const layerIdMap = new Map<string, string>();
    layerIdMap.set(sourceLayerId, layerId);

    // Regenerate IDs and remap layer_id references
    const updatedInteractions = regenerateInteractionIds(interactions, layerIdMap);

    // Apply interactions to the current layer
    updateLayer(pageId, layerId, {
      interactions: updatedInteractions,
    });
  };

  const handleCreateComponent = () => {
    // Get layer name for default component name
    const draft = draftsByPageId[pageId];
    if (!draft) return;

    const layer = findLayerById(draft.layers, layerId);
    if (!layer) return;

    const defaultName = layer.customName || layer.name || 'Component';
    setLayerName(defaultName);
    setIsComponentDialogOpen(true);
  };

  const handleConfirmCreateComponent = async (componentName: string) => {
    const componentId = await createComponentFromLayer(pageId, layerId, componentName);
    // No need to reload components - createComponentFromLayer already adds it to the store
  };

  const handleEditMasterComponent = () => {
    if (!layer?.componentId) return;

    const { setEditingComponentId, setSelectedLayerId } = useEditorStore.getState();
    const { loadComponentDraft, getComponentById } = useComponentsStore.getState();

    // Enter edit mode
    setEditingComponentId(layer.componentId, pageId);

    // Load component into draft
    loadComponentDraft(layer.componentId);

    // Select the first (top-level) layer of the component
    const component = getComponentById(layer.componentId);
    if (component && component.layers && component.layers.length > 0) {
      setSelectedLayerId(component.layers[0].id);
    } else {
      setSelectedLayerId(null);
    }
  };

  const handleDetachFromComponent = () => {
    if (!layer || !layer.componentId) return;

    // Get the component to extract its layers
    const component = getComponentById(layer.componentId);
    if (!component || !component.layers || component.layers.length === 0) {
      // If component not found or has no layers, just remove the componentId
      updateLayer(pageId, layerId, {
        componentId: undefined,
        componentOverrides: undefined,
      });
      return;
    }

    // Find the layer in the tree and replace it with component's layers
    const draft = draftsByPageId[pageId];
    if (!draft) return;

    // Helper to find and replace the layer with component layers
    const replaceLayerWithComponentLayers = (layers: Layer[]): Layer[] => {
      return layers.flatMap(currentLayer => {
        if (currentLayer.id === layerId) {
          // Replace this layer with the component's layers
          // Deep clone to avoid mutations and regenerate IDs with interaction remapping
          const clonedLayers = JSON.parse(JSON.stringify(component.layers));

          // Regenerate IDs and remap self-targeted interactions
          return clonedLayers.map(regenerateIdsWithInteractionRemapping);
        }

        // Recursively process children
        if (currentLayer.children && currentLayer.children.length > 0) {
          return {
            ...currentLayer,
            children: replaceLayerWithComponentLayers(currentLayer.children),
          };
        }

        return currentLayer;
      });
    };

    const newLayers = replaceLayerWithComponentLayers(draft.layers);

    // Update the draft with the new layer tree
    usePagesStore.getState().setDraftLayers(pageId, newLayers);

    // Clear selection since the layer ID no longer exists
    if (onLayerSelect) {
      onLayerSelect(null as any);
    }
  };

  const handleShowJSON = () => {
    if (!layer) return;
    console.log('Layer JSON:', JSON.stringify(layer, null, 2));
    console.log('Layer Object:', layer);
  };

  const handleOpenChange = (open: boolean) => {
    // When context menu opens, select this layer for visual feedback
    // Only select if the layer exists and is not already selected (prevent unnecessary re-renders)
    if (open && onLayerSelect && layer && selectedLayerId !== layerId) {
      onLayerSelect(layerId);
    }
  };

  const handleLogLayer = () => {
    if (!layer) return;
    console.log('Layer:', layer);
  };

  // Check if we're on localhost
  const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';

  return (
    <ContextMenu onOpenChange={handleOpenChange}>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-44">
        <ContextMenuItem onClick={handleCut} disabled={isLocked || !canCopy || !canDelete}>
          Cut
          <ContextMenuShortcut>⌘X</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuItem onClick={handleCopy} disabled={!canCopy}>
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

        <ContextMenuItem onClick={handleDuplicate} disabled={!canCopy}>
          Duplicate
          <ContextMenuShortcut>⌘D</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuItem
          onClick={handleDelete}
          disabled={isLocked || !canDelete}
        >
          Delete
          <ContextMenuShortcut>⌫</ContextMenuShortcut>
        </ContextMenuItem>

        {!isComponentInstance && (
          <>
            <ContextMenuSeparator />

            <ContextMenuItem onClick={handleCopyStyle}>
              Copy style
              <ContextMenuShortcut>⌥⌘C</ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuItem onClick={handlePasteStyle} disabled={!hasStyleClipboard}>
              Paste style
              <ContextMenuShortcut>⌥⌘V</ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuSeparator />

            <ContextMenuItem onClick={handleCopyInteractions} disabled={!layer?.interactions || layer.interactions.length === 0}>
              Copy interactions
            </ContextMenuItem>

            <ContextMenuItem onClick={handlePasteInteractions} disabled={!hasInteractionsClipboard}>
              Paste interactions
            </ContextMenuItem>

            <ContextMenuSeparator />
          </>
        )}

        {isComponentInstance ? (
          <>
          <ContextMenuSeparator />

            <ContextMenuItem onClick={handleEditMasterComponent}>
              Edit master component
            </ContextMenuItem>

            <ContextMenuItem onClick={handleDetachFromComponent}>
              Detach from component
            </ContextMenuItem>
          </>
        ) : (
          <ContextMenuItem onClick={handleCreateComponent} disabled={isLocked}>
            Create component
          </ContextMenuItem>
        )}

        {/* Development only: Show JSON */}
        {process.env.NODE_ENV === 'development' && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={handleShowJSON}>
              Show JSON
              <ContextMenuShortcut>🔍</ContextMenuShortcut>
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>

      <CreateComponentDialog
        open={isComponentDialogOpen}
        onOpenChange={setIsComponentDialogOpen}
        onConfirm={handleConfirmCreateComponent}
        layerName={layerName}
      />
    </ContextMenu>
  );
}
