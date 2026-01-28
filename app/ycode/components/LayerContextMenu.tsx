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
import { canHaveChildren, findLayerById, getClassesString, regenerateInteractionIds, canCopyLayer, canDeleteLayer } from '@/lib/layer-utils';
import { detachSpecificLayerFromComponent } from '@/lib/component-utils';
import type { UseLiveLayerUpdatesReturn } from '@/hooks/use-live-layer-updates';
import type { UseLiveComponentUpdatesReturn } from '@/hooks/use-live-component-updates';
import type { Layer } from '@/types';
import CreateComponentDialog from './CreateComponentDialog';
import SaveLayoutDialog from './SaveLayoutDialog';

interface LayerContextMenuProps {
  layerId: string;
  pageId: string;
  children: React.ReactNode;
  isLocked?: boolean;
  onLayerSelect?: (layerId: string) => void;
  selectedLayerId?: string | null;
  liveLayerUpdates?: UseLiveLayerUpdatesReturn | null;
  liveComponentUpdates?: UseLiveComponentUpdatesReturn | null;
  /** When set, we're editing a component; resolve layer from component draft so "Detach" works for nested instances */
  editingComponentId?: string | null;
}

export default function LayerContextMenu({
  layerId,
  pageId,
  children,
  isLocked = false,
  onLayerSelect,
  selectedLayerId,
  liveLayerUpdates,
  liveComponentUpdates,
  editingComponentId = null,
}: LayerContextMenuProps) {
  const [isComponentDialogOpen, setIsComponentDialogOpen] = useState(false);
  const [isLayoutDialogOpen, setIsLayoutDialogOpen] = useState(false);
  const [layerName, setLayerName] = useState('');

  const copyLayer = usePagesStore((state) => state.copyLayer);
  const deleteLayer = usePagesStore((state) => state.deleteLayer);
  const duplicateLayer = usePagesStore((state) => state.duplicateLayer);
  const pasteAfter = usePagesStore((state) => state.pasteAfter);
  const pasteInside = usePagesStore((state) => state.pasteInside);
  const updateLayer = usePagesStore((state) => state.updateLayer);
  const setDraftLayers = usePagesStore((state) => state.setDraftLayers);
  const draftsByPageId = usePagesStore((state) => state.draftsByPageId);
  const createComponentFromLayer = usePagesStore((state) => state.createComponentFromLayer);

  const loadComponents = useComponentsStore((state) => state.loadComponents);
  const getComponentById = useComponentsStore((state) => state.getComponentById);
  const components = useComponentsStore((state) => state.components);
  const componentDrafts = useComponentsStore((state) => state.componentDrafts);
  const updateComponentDraft = useComponentsStore((state) => state.updateComponentDraft);
  const createComponentFromComponentLayer = useComponentsStore((state) => state.createComponentFromLayer);

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

  // Resolve layers: component draft when editing a component, else page draft
  const isComponentContext = !!editingComponentId;
  const layers = useMemo(
    () =>
      isComponentContext
        ? (componentDrafts[editingComponentId!] || [])
        : (draftsByPageId[pageId]?.layers || []),
    [isComponentContext, editingComponentId, componentDrafts, draftsByPageId, pageId]
  );
  const layer = findLayerById(layers, layerId);

  const isComponentInstance = !!(layer && layer.componentId);
  const componentName = isComponentInstance && layer?.componentId
    ? getComponentById(layer.componentId)?.name
    : null;

  // Check if the current layer can have children
  const canPasteInside = useMemo(() => {
    const targetLayer = findLayerById(layers, layerId);
    if (!targetLayer) return false;
    return canHaveChildren(targetLayer);
  }, [layers, layerId]);

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
    const pastedLayer = pasteAfter(pageId, layerId, clipboardLayer);
    // Broadcast the pasted layer
    if (liveLayerUpdates && pastedLayer) {
      liveLayerUpdates.broadcastLayerAdd(pageId, null, 'paste', pastedLayer);
    }
  };

  const handlePasteInside = () => {
    if (!clipboardLayer || !canPasteInside) return;
    const pastedLayer = pasteInside(pageId, layerId, clipboardLayer);
    // Broadcast the pasted layer
    if (liveLayerUpdates && pastedLayer) {
      liveLayerUpdates.broadcastLayerAdd(pageId, layerId, 'paste', pastedLayer);
    }
  };

  const handleDuplicate = () => {
    if (!canCopy) return;
    const duplicatedLayer = duplicateLayer(pageId, layerId);
    // Broadcast the duplicated layer
    if (liveLayerUpdates && duplicatedLayer) {
      liveLayerUpdates.broadcastLayerAdd(pageId, null, 'duplicate', duplicatedLayer);
    }
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
    // Use the already-resolved layer (works in both page and component context)
    if (!layer) return;

    const defaultName = layer.customName || layer.name || 'Component';
    setLayerName(defaultName);
    setIsComponentDialogOpen(true);
  };

  const handleConfirmCreateComponent = async (componentName: string) => {
    // Use appropriate creation function based on context
    const componentId = isComponentContext && editingComponentId
      ? await createComponentFromComponentLayer(editingComponentId, layerId, componentName)
      : await createComponentFromLayer(pageId, layerId, componentName);

    if (!componentId) return;

    // Broadcast to collaborators
    if (liveComponentUpdates) {
      const component = getComponentById(componentId);
      if (component) {
        liveComponentUpdates.broadcastComponentCreate(component);
      }
    }
  };

  const handleEditMasterComponent = async () => {
    if (!layer?.componentId) return;

    const { setEditingComponentId, setSelectedLayerId, pushComponentNavigation, editingComponentId } = useEditorStore.getState();
    const { loadComponentDraft, getComponentById } = useComponentsStore.getState();
    const { pages } = usePagesStore.getState();

    // Capture the current layer ID BEFORE clearing selection
    // This is the layer we'll return to when exiting component edit mode
    const componentInstanceLayerId = layer.id;

    // Push current context to navigation stack before entering component edit mode
    if (editingComponentId) {
      // We're currently editing a component, push it to stack
      const currentComponent = getComponentById(editingComponentId);
      if (currentComponent) {
        pushComponentNavigation({
          type: 'component',
          id: editingComponentId,
          name: currentComponent.name,
          layerId: layer.id,
        });
      }
    } else if (pageId) {
      // We're on a page, push it to stack
      const currentPage = pages.find((p) => p.id === pageId);
      if (currentPage) {
        pushComponentNavigation({
          type: 'page',
          id: pageId,
          name: currentPage.name,
          layerId: componentInstanceLayerId,
        });
      }
    }

    // Clear selection FIRST to release lock on current page's channel
    // before switching to component's channel
    setSelectedLayerId(null);

    // Enter edit mode (changes lock channel to component)
    // Pass the component instance layer ID so we can restore it when exiting
    setEditingComponentId(layer.componentId, pageId, componentInstanceLayerId);

    // Load component into draft (async to ensure proper cache sync)
    await loadComponentDraft(layer.componentId);

    // Select the first (top-level) layer of the component (now on component channel)
    const component = getComponentById(layer.componentId);
    if (component && component.layers && component.layers.length > 0) {
      setSelectedLayerId(component.layers[0].id);
    }
  };

  const handleDetachFromComponent = () => {
    if (!layer || !layer.componentId) return;

    const component = getComponentById(layer.componentId);

    // Use the shared utility function for detaching
    const newLayers = detachSpecificLayerFromComponent(layers, layerId, component || undefined);

    if (isComponentContext && editingComponentId) {
      updateComponentDraft(editingComponentId, newLayers);
    } else {
      setDraftLayers(pageId, newLayers);
    }

    if (onLayerSelect) {
      onLayerSelect(null as any);
    }
  };

  const handleShowJSON = () => {
    if (!layer) return;
    console.log('Layer object:', layer);
  };

  const handleSaveAsLayout = () => {
    if (!layer) return;

    // Set default name from layer
    const defaultName = layer.customName || layer.name || 'Custom Layout';
    setLayerName(defaultName);

    // Open dialog
    setIsLayoutDialogOpen(true);
  };

  const handleConfirmSaveLayout = async (layoutName: string, category: string, imageFile: File | null) => {
    if (!layer) return;

    try {
      // Strip IDs to convert Layer to LayerTemplate
      const stripIds = (l: Layer): any => {
        const { id, ...rest } = l;
        const result: any = { ...rest };

        if (result.children && Array.isArray(result.children)) {
          result.children = result.children.map((child: Layer) => stripIds(child));
        }

        return result;
      };

      const template = stripIds(layer);

      // Generate layout key from name
      const layoutKey = layoutName.toLowerCase().replace(/\s+/g, '-');

      // Use FormData to send file + data
      const formData = new FormData();
      formData.append('layoutKey', layoutKey);
      formData.append('layoutName', layoutName);
      formData.append('category', category);
      formData.append('template', JSON.stringify(template));

      if (imageFile) {
        formData.append('image', imageFile);
      }

      // Call API to save layout
      const response = await fetch('/api/layouts', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save layout');
      }

      console.log('✅ Layout saved successfully:', layoutName);
      console.log('Layout key:', layoutKey);
      console.log('Category:', category);
    } catch (error) {
      console.error('Failed to save layout:', error);
      throw error;
    }
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
            <ContextMenuItem onClick={handleSaveAsLayout}>
              Save as Layout
              <ContextMenuShortcut>📐</ContextMenuShortcut>
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

      <SaveLayoutDialog
        open={isLayoutDialogOpen}
        onOpenChange={setIsLayoutDialogOpen}
        onConfirm={handleConfirmSaveLayout}
        defaultName={layerName}
      />
    </ContextMenu>
  );
}
