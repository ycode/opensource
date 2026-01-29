'use client';

/**
 * Element Library Slide-Out Panel
 *
 * Displays categorized list of available elements that can be added to the page
 */

import React, { useState } from 'react';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { Component } from '@/types';
import Image from 'next/image';
import { getLayerFromTemplate, getBlockName, getBlockIcon, getLayoutTemplate, getLayoutCategory, getLayoutPreviewImage, getLayoutsByCategory, getAllLayoutKeys } from '@/lib/templates/blocks';
import { DEFAULT_ASSETS } from '@/lib/asset-constants';
import { canHaveChildren, assignOrderClassToNewLayer, collectAllSettingsIds, generateUniqueSettingsId } from '@/lib/layer-utils';
import { cn, generateId } from '@/lib/utils';
import { componentsApi } from '@/lib/api';
import type { Layer } from '@/types';
import SaveLayoutDialog from './SaveLayoutDialog';
import { usePagesStore } from '@/stores/usePagesStore';
import { useEditorStore } from '@/stores/useEditorStore';
import { useComponentsStore } from '@/stores/useComponentsStore';
import { useEditorActions } from '@/hooks/use-editor-url';
import type { UseLiveLayerUpdatesReturn } from '@/hooks/use-live-layer-updates';

interface ElementLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'elements' | 'layouts' | 'components';
  liveLayerUpdates?: UseLiveLayerUpdatesReturn | null;
}

// Category definitions
const elementCategories: Record<string, string[]> = {
  Structure: ['section', 'container', 'div', 'hr', 'columns', 'rows', 'grid', 'collection'],
  Content: ['heading', 'text'],
  Actions: ['button'],
  Media: ['image', 'icon', 'video', 'audio'],
  Form: ['form', 'input', 'textarea', 'select', 'checkbox', 'radio', 'label'],
  Utilities: ['localeSelector', 'htmlEmbed'],
};

/**
 * Check if a layer tree contains any inlined components
 */
function hasInlinedComponents(layer: Layer): boolean {
  if ((layer as any)._inlinedComponentName) return true;
  if (layer.children) {
    return layer.children.some(child => hasInlinedComponents(child));
  }
  return false;
}

/**
 * Process a layout layer tree to restore inlined components.
 * When a layout contains _inlinedComponentName, we create actual components
 * and replace the inlined content with component instances.
 */
async function restoreInlinedComponents(
  layer: Layer,
  existingComponents: { id: string; name: string }[],
  createdComponents: Map<string, string> // name -> componentId
): Promise<Layer> {
  const newLayer = { ...layer } as Layer & { 
    _inlinedComponentName?: string;
    _inlinedComponentVariables?: any[];
  };

  // Check if this layer has inlined component data
  if (newLayer._inlinedComponentName && newLayer.children?.length) {
    console.log(`[restoreInlinedComponents] Found inlined component: "${newLayer._inlinedComponentName}"`);
  
    const componentName = newLayer._inlinedComponentName;
    const componentVariables = newLayer._inlinedComponentVariables;
    
    // Check if we already created this component in this batch
    let componentId: string | undefined = createdComponents.get(componentName);
    
    if (!componentId) {
      // Check if a component with this name already exists
      const existing = existingComponents.find(c => c.name === componentName);
      
      if (existing) {
        componentId = existing.id;
      } else {
        // Create new component from inlined layers (including variables)
        try {
          const result = await componentsApi.create({
            name: componentName,
            layers: newLayer.children,
            variables: componentVariables,
          });
          const newId = result.data?.id;
          if (newId) {
            componentId = newId;
            createdComponents.set(componentName, newId);
            console.log(`✅ Created component "${componentName}" from inlined layout data${componentVariables?.length ? ` with ${componentVariables.length} variables` : ''}`);
          }
        } catch (error) {
          console.error(`Failed to create component "${componentName}":`, error);
        }
      }
    }

    if (componentId) {
      // Convert to component instance
      newLayer.componentId = componentId;
      newLayer.children = []; // Clear inlined children
      delete newLayer._inlinedComponentName;
      delete newLayer._inlinedComponentVariables;
    }
  }

  // Recursively process children that weren't converted to component instances
  // Process sequentially to avoid race conditions when creating components
  if (newLayer.children?.length && !newLayer.componentId) {
    const processedChildren: Layer[] = [];
    for (const child of newLayer.children) {
      const processed = await restoreInlinedComponents(child, existingComponents, createdComponents);
      processedChildren.push(processed);
    }
    newLayer.children = processedChildren;
  }

  return newLayer;
}

export default function ElementLibrary({ isOpen, onClose, defaultTab = 'elements', liveLayerUpdates }: ElementLibraryProps) {
  const { addLayerFromTemplate, updateLayer, setDraftLayers, draftsByPageId, pages } = usePagesStore();
  const { currentPageId, selectedLayerId, setSelectedLayerId, editingComponentId, activeBreakpoint, pushComponentNavigation } = useEditorStore();
  const { components, componentDrafts, updateComponentDraft, deleteComponent, getDeletePreview, loadComponentDraft, getComponentById, loadComponents } = useComponentsStore();
  const { openComponent } = useEditorActions();

  // Delete component state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [componentToDelete, setComponentToDelete] = useState<Component | null>(null);
  const [deletePreviewInfo, setDeletePreviewInfo] = useState<{ pageCount: number; componentCount: number } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = React.useState<'elements' | 'layouts' | 'components'>(() => {
    // Try to load from sessionStorage first
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('elementLibrary-activeTab');
      if (saved && ['elements', 'layouts', 'components'].includes(saved)) {
        return saved as 'elements' | 'layouts' | 'components';
      }
    }
    return defaultTab;
  });
  const [isEditLayoutDialogOpen, setIsEditLayoutDialogOpen] = useState(false);
  const [editingLayoutKey, setEditingLayoutKey] = useState<string>('');
  const [editingLayoutName, setEditingLayoutName] = useState<string>('');
  const [editingLayoutCategory, setEditingLayoutCategory] = useState<string>('Custom');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(() => {
    // Try to load from sessionStorage first
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('elementLibrary-collapsedCategories');
      if (saved) {
        try {
          return new Set(JSON.parse(saved));
        } catch (e) {
          // If parsing fails, fall through to default
        }
      }
    }
    // Initialize with all categories collapsed except "Navigation", "Hero", "Blog header" and "Blog posts"
    const allCategories = Object.keys(getLayoutsByCategory());
    return new Set(allCategories.filter(cat => cat !== 'Navigation' && cat !== 'Hero' && cat !== 'Blog header' && cat !== 'Blog posts'));
  });

  // Persist active tab to sessionStorage
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('elementLibrary-activeTab', activeTab);
    }
  }, [activeTab]);

  // Persist collapsed state to sessionStorage
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(
        'elementLibrary-collapsedCategories',
        JSON.stringify(Array.from(collapsedCategories))
      );
    }
  }, [collapsedCategories]);

  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const handleAddElement = (elementType: string) => {
    // If editing component, use component draft instead
    if (editingComponentId) {
      const layers = componentDrafts[editingComponentId] || [];
      const parentId = selectedLayerId || layers[0]?.id || 'body';

      // Create new layer from template
      const template = getLayerFromTemplate(elementType);
      const displayName = getBlockName(elementType);

      // Collect existing settings IDs to generate unique ones
      const existingSettingsIds = collectAllSettingsIds(layers);
      const usedSettingsIds = new Set<string>(existingSettingsIds);

      // Helper to normalize layer and generate unique settings IDs
      const normalizeLayerWithUniqueIds = (layer: any): any => {
        const normalized = { ...layer };

        // Generate unique settings.id if the layer has one
        if (normalized.settings?.id) {
          const uniqueId = generateUniqueSettingsId(normalized.settings.id, usedSettingsIds);
          usedSettingsIds.add(uniqueId);
          normalized.settings = {
            ...normalized.settings,
            id: uniqueId,
          };
        }

        // Recursively normalize children
        if (normalized.children) {
          normalized.children = normalized.children.map((child: any) => normalizeLayerWithUniqueIds(child));
        }

        return normalized;
      };

      const normalizedTemplate = normalizeLayerWithUniqueIds(template);
      const newLayer = {
        ...normalizedTemplate,
        id: generateId('lyr'),
        customName: displayName || undefined, // Set display name
      };

      // Detect if we're adding a Section layer
      const isAddingSection = elementType === 'section' || newLayer.name === 'section';

      // Find parent layer and check if it can have children
      const findLayerInTree = (tree: any[], targetId: string): any | null => {
        for (const node of tree) {
          if (node.id === targetId) return node;
          if (node.children) {
            const found = findLayerInTree(node.children, targetId);
            if (found) return found;
          }
        }
        return null;
      };

      const parentLayer = findLayerInTree(layers, parentId);

      // Find parent and add layer
      const addLayerToTree = (tree: any[], targetId: string, parentNode: any = null): { success: boolean; newLayers: any[]; newLayerId: string; parentToExpand: string | null } => {
        // Special handling for Section layers - add to Body level
        if (isAddingSection) {
          // Find the Body/root container
          const bodyLayer = tree.find(l => l.id === 'body' || l.name === 'body');
          if (bodyLayer) {
            const bodyIndex = tree.findIndex(l => l.id === bodyLayer.id);
            const updatedBody = {
              ...bodyLayer,
              children: [...(bodyLayer.children || []), newLayer]
            };
            return {
              success: true,
              newLayers: [...tree.slice(0, bodyIndex), updatedBody, ...tree.slice(bodyIndex + 1)],
              newLayerId: newLayer.id,
              parentToExpand: bodyLayer.id
            };
          }
        }

        // Regular logic for non-Section layers
        for (let i = 0; i < tree.length; i++) {
          const node = tree[i];
          if (node.id === targetId) {
            // Found target, check if it can have children
            if (canHaveChildren(node, newLayer.name)) {
              // Add as child
              const updatedNode = {
                ...node,
                children: [...(node.children || []), newLayer]
              };
              return {
                success: true,
                newLayers: [...tree.slice(0, i), updatedNode, ...tree.slice(i + 1)],
                newLayerId: newLayer.id,
                parentToExpand: targetId
              };
            } else {
              // Cannot have children, add as sibling after this node
              return {
                success: true,
                newLayers: [...tree.slice(0, i + 1), newLayer, ...tree.slice(i + 1)],
                newLayerId: newLayer.id,
                parentToExpand: parentNode ? parentNode.id : null
              };
            }
          }
          if (node.children) {
            const result = addLayerToTree(node.children, targetId, node);
            if (result.success) {
              return {
                success: true,
                newLayers: [
                  ...tree.slice(0, i),
                  { ...node, children: result.newLayers },
                  ...tree.slice(i + 1)
                ],
                newLayerId: result.newLayerId,
                parentToExpand: result.parentToExpand
              };
            }
          }
        }
        return { success: false, newLayers: tree, newLayerId: '', parentToExpand: null };
      };

      const result = addLayerToTree(layers, parentId);
      if (result.success) {
        // Apply order class to new layer if siblings have responsive order classes
        let finalLayers = result.newLayers;
        if (result.parentToExpand) {
          finalLayers = assignOrderClassToNewLayer(
            result.newLayers,
            result.parentToExpand,
            result.newLayerId,
            activeBreakpoint
          );
        }

        updateComponentDraft(editingComponentId, finalLayers);
        setSelectedLayerId(result.newLayerId);
        if (result.parentToExpand) {
          window.dispatchEvent(new CustomEvent('expandLayer', {
            detail: { layerId: result.parentToExpand }
          }));
        }
      }

      onClose();
      return;
    }

    // Regular page mode
    if (!currentPageId) return;

    // Determine parent (selected container or Body)
    let parentId = selectedLayerId || 'body';

    // Special handling for Section layers - always add to Body
    const isAddingSection = elementType === 'section';
    if (isAddingSection) {
      parentId = 'body';
    }

    // Add the layer using the template
    const result = addLayerFromTemplate(currentPageId, parentId, elementType);

    // Select the newly added layer
    if (result) {
      setSelectedLayerId(result.newLayerId);

      // Assign order class to new layer if siblings have responsive order classes
      if (result.parentToExpand) {
        const freshDraft = usePagesStore.getState().draftsByPageId[currentPageId];
        if (freshDraft) {
          const updatedLayers = assignOrderClassToNewLayer(
            freshDraft.layers,
            result.parentToExpand,
            result.newLayerId,
            activeBreakpoint
          );
          // Only update if layers actually changed
          if (updatedLayers !== freshDraft.layers) {
            setDraftLayers(currentPageId, updatedLayers);
          }
        }
      }

      // Broadcast layer add to other collaborators
      if (liveLayerUpdates && currentPageId) {
        // Get FRESH state from store (not stale draftsByPageId from render)
        const freshDraft = usePagesStore.getState().draftsByPageId[currentPageId];
        if (freshDraft) {
          // Find the new layer AND its actual parent (may differ from requested parentId)
          const findLayerWithParent = (layers: any[], id: string, parent: any = null): { layer: any; parent: any } | null => {
            for (const layer of layers) {
              if (layer.id === id) return { layer, parent };
              if (layer.children) {
                const found = findLayerWithParent(layer.children, id, layer);
                if (found) return found;
              }
            }
            return null;
          };
          const found = findLayerWithParent(freshDraft.layers, result.newLayerId);
          if (found?.layer) {
            // Use the ACTUAL parent ID where the layer was placed
            const actualParentId = found.parent?.id || null;
            liveLayerUpdates.broadcastLayerAdd(currentPageId, actualParentId, elementType, found.layer);
          }
        }
      }

      // Note: parentToExpand is handled by LayersTree component
      // We dispatch a custom event for LayersTree to listen to
      if (result.parentToExpand) {
        window.dispatchEvent(new CustomEvent('expandLayer', {
          detail: { layerId: result.parentToExpand }
        }));
      }
    }

    // Close the panel
    onClose();
  };

  const handleAddLayout = async (layoutKey: string) => {
    // If editing component, use component draft instead
    if (editingComponentId) {
      const layers = componentDrafts[editingComponentId] || [];

      // Get layout template first (we need it to check if it's a section)
      const layoutTemplate = getLayoutTemplate(layoutKey);
      if (!layoutTemplate) return;

      // Special handling for Section layouts - always add to Body/root level
      const isAddingSection = layoutTemplate.name === 'section';
      let parentId = selectedLayerId || layers[0]?.id || 'body';
      if (isAddingSection) {
        parentId = layers[0]?.id || 'body'; // Add to root/body level
      }

      // Collect existing settings IDs to generate unique ones
      const existingSettingsIds = collectAllSettingsIds(layers);
      const usedSettingsIds = new Set<string>(existingSettingsIds);

      // Helper to normalize layer and generate unique settings IDs
      const normalizeLayerWithUniqueIds = (layer: any): any => {
        const normalized = { ...layer };

        // Generate unique settings.id if the layer has one
        if (normalized.settings?.id) {
          const uniqueId = generateUniqueSettingsId(normalized.settings.id, usedSettingsIds);
          usedSettingsIds.add(uniqueId);
          normalized.settings = {
            ...normalized.settings,
            id: uniqueId,
          };
        }

        // Recursively normalize children
        if (normalized.children) {
          normalized.children = normalized.children.map((child: any) => normalizeLayerWithUniqueIds(child));
        }

        return normalized;
      };

      // getLayoutTemplate already handles ID regeneration and interaction remapping
      let newLayer = normalizeLayerWithUniqueIds(layoutTemplate);

      // Restore inlined components (create actual components from inlined data)
      if (hasInlinedComponents(newLayer)) {
        console.log('[handleAddLayout] Layout contains inlined components, restoring...');
        const createdComponents = new Map<string, string>();
        newLayer = await restoreInlinedComponents(
          newLayer,
          components.map(c => ({ id: c.id, name: c.name })),
          createdComponents
        );
        console.log('[handleAddLayout] Created components:', Array.from(createdComponents.entries()));
        
        // Refresh components store if new components were created
        if (createdComponents.size > 0) {
          await loadComponents();
        }
      }

      // Find parent layer and check if it can have children
      const findLayerInTree = (tree: any[], targetId: string): any | null => {
        for (const node of tree) {
          if (node.id === targetId) return node;
          if (node.children) {
            const found = findLayerInTree(node.children, targetId);
            if (found) return found;
          }
        }
        return null;
      };

      const parentLayer = findLayerInTree(layers, parentId);

      // Find parent and add layer
      const addLayerToTree = (tree: any[], targetId: string, parentNode: any = null): { success: boolean; newLayers: any[]; newLayerId: string; parentToExpand: string | null } => {
        for (let i = 0; i < tree.length; i++) {
          const node = tree[i];
          if (node.id === targetId) {
            // Found target, check if it can have children
            if (canHaveChildren(node)) {
              // Add as child
              const updatedNode = {
                ...node,
                children: [...(node.children || []), newLayer]
              };
              return {
                success: true,
                newLayers: [...tree.slice(0, i), updatedNode, ...tree.slice(i + 1)],
                newLayerId: newLayer.id,
                parentToExpand: targetId
              };
            } else {
              // Cannot have children, add as sibling after this node
              return {
                success: true,
                newLayers: [...tree.slice(0, i + 1), newLayer, ...tree.slice(i + 1)],
                newLayerId: newLayer.id,
                parentToExpand: parentNode ? parentNode.id : null
              };
            }
          }
          if (node.children) {
            const result = addLayerToTree(node.children, targetId, node);
            if (result.success) {
              return {
                success: true,
                newLayers: [
                  ...tree.slice(0, i),
                  { ...node, children: result.newLayers },
                  ...tree.slice(i + 1)
                ],
                newLayerId: result.newLayerId,
                parentToExpand: result.parentToExpand
              };
            }
          }
        }
        return { success: false, newLayers: tree, newLayerId: '', parentToExpand: null };
      };

      const result = addLayerToTree(layers, parentId);
      if (result.success) {
        // Apply order class to new layer if siblings have responsive order classes
        let finalLayers = result.newLayers;
        if (result.parentToExpand) {
          finalLayers = assignOrderClassToNewLayer(
            result.newLayers,
            result.parentToExpand,
            result.newLayerId,
            activeBreakpoint
          );
        }

        updateComponentDraft(editingComponentId, finalLayers);
        setSelectedLayerId(result.newLayerId);
        if (result.parentToExpand) {
          window.dispatchEvent(new CustomEvent('expandLayer', {
            detail: { layerId: result.parentToExpand }
          }));
        }
      }

      onClose();
      return;
    }

    // Regular page mode
    if (!currentPageId) return;

    // Get layout template first (we need it to check if it's a section)
    const layoutTemplate = getLayoutTemplate(layoutKey);
    if (!layoutTemplate) return;

    // Determine parent (selected container or Body)
    // Special handling for Section layouts - always add to Body
    const isAddingSection = layoutTemplate.name === 'section';
    let parentId = selectedLayerId || 'body';
    if (isAddingSection) {
      parentId = 'body';
    }

    // Use the internal addLayerFromTemplate logic but with our layout
    const draft = usePagesStore.getState().draftsByPageId[currentPageId];
    if (!draft) {
      const page = usePagesStore.getState().pages.find(p => p.id === currentPageId);
      if (!page) return;
    }

    // Collect existing settings IDs to generate unique ones
    const existingSettingsIds = collectAllSettingsIds(draft?.layers || []);
    const usedSettingsIds = new Set<string>(existingSettingsIds);

    // Helper to normalize layer and generate unique settings IDs
    const normalizeLayerWithUniqueIds = (layer: any): any => {
      const normalized = { ...layer };

      // Generate unique settings.id if the layer has one
      if (normalized.settings?.id) {
        const uniqueId = generateUniqueSettingsId(normalized.settings.id, usedSettingsIds);
        usedSettingsIds.add(uniqueId);
        normalized.settings = {
          ...normalized.settings,
          id: uniqueId,
        };
      }

      // Recursively normalize children
      if (normalized.children) {
        normalized.children = normalized.children.map((child: any) => normalizeLayerWithUniqueIds(child));
      }

      return normalized;
    };

    // getLayoutTemplate already handles ID regeneration and interaction remapping
    let newLayer = normalizeLayerWithUniqueIds(layoutTemplate);

    // Restore inlined components (create actual components from inlined data)
    if (hasInlinedComponents(newLayer)) {
      console.log('[handleAddLayout] Layout contains inlined components, restoring...');
      const createdComponents = new Map<string, string>();
      newLayer = await restoreInlinedComponents(
        newLayer,
        components.map(c => ({ id: c.id, name: c.name })),
        createdComponents
      );
      console.log('[handleAddLayout] Created components:', Array.from(createdComponents.entries()));
      
      // Refresh components store if new components were created
      if (createdComponents.size > 0) {
        await loadComponents();
      }
    }

    // Find parent layer
    const findLayerWithParent = (tree: any[], id: string, parent: any | null = null): { layer: any; parent: any | null } | null => {
      for (const node of tree) {
        if (node.id === id) return { layer: node, parent };
        if (node.children) {
          const found = findLayerWithParent(node.children, id, node);
          if (found) return found;
        }
      }
      return null;
    };

    const currentDraft = usePagesStore.getState().draftsByPageId[currentPageId] || {
      id: `draft-${currentPageId}`,
      page_id: currentPageId,
      layers: [],
      is_published: false,
      created_at: new Date().toISOString(),
      deleted_at: null,
    };

    const result = findLayerWithParent(currentDraft.layers, parentId);
    let newLayers;
    let parentToExpand: string | null = null;

    if (!result) {
      // Add to root
      newLayers = [...currentDraft.layers, newLayer];
    } else {
      // Check if parent can have children
      if (canHaveChildren(result.layer)) {
        // Add as child
        const updateLayerInTree = (tree: any[], layerId: string, updater: (l: any) => any): any[] => {
          return tree.map((node) => {
            if (node.id === layerId) {
              return updater(node);
            }
            if (node.children && node.children.length > 0) {
              return { ...node, children: updateLayerInTree(node.children, layerId, updater) };
            }
            return node;
          });
        };

        newLayers = updateLayerInTree(currentDraft.layers, parentId, (parent) => ({
          ...parent,
          children: [...(parent.children || []), newLayer],
        }));
        parentToExpand = parentId;
      } else {
        // Insert after the selected layer
        if (result.parent) {
          const updateLayerInTree = (tree: any[], layerId: string, updater: (l: any) => any): any[] => {
            return tree.map((node) => {
              if (node.id === layerId) {
                return updater(node);
              }
              if (node.children && node.children.length > 0) {
                return { ...node, children: updateLayerInTree(node.children, layerId, updater) };
              }
              return node;
            });
          };

          newLayers = updateLayerInTree(currentDraft.layers, result.parent.id, (grandparent) => {
            const children = grandparent.children || [];
            const selectedIndex = children.findIndex((c: any) => c.id === parentId);
            const newChildren = [...children];
            newChildren.splice(selectedIndex + 1, 0, newLayer);
            return { ...grandparent, children: newChildren };
          });
          parentToExpand = result.parent.id;
        } else {
          // Selected layer is at root level, insert after it
          const selectedIndex = currentDraft.layers.findIndex((l: any) => l.id === parentId);
          newLayers = [...currentDraft.layers];
          newLayers.splice(selectedIndex + 1, 0, newLayer);
        }
      }
    }

    // Assign order class to new layer if siblings have responsive order classes
    let finalLayers = newLayers;
    if (parentToExpand) {
      finalLayers = assignOrderClassToNewLayer(
        newLayers,
        parentToExpand,
        newLayer.id,
        activeBreakpoint
      );
    }

    // Update the draft with the new layers
    usePagesStore.getState().setDraftLayers(currentPageId, finalLayers);

    // Broadcast layout add to other collaborators - find actual parent
    if (liveLayerUpdates) {
      const findLayerWithParent = (layers: any[], id: string, parent: any = null): { layer: any; parent: any } | null => {
        for (const layer of layers) {
          if (layer.id === id) return { layer, parent };
          if (layer.children) {
            const found = findLayerWithParent(layer.children, id, layer);
            if (found) return found;
          }
        }
        return null;
      };
      const found = findLayerWithParent(newLayers, newLayer.id);
      const actualParentId = found?.parent?.id || null;
      liveLayerUpdates.broadcastLayerAdd(currentPageId, actualParentId, layoutKey, newLayer);
    }

    // Select the root layer of the layout
    setSelectedLayerId(newLayer.id);

    // Expand parent if needed
    if (parentToExpand) {
      window.dispatchEvent(new CustomEvent('expandLayer', {
        detail: { layerId: parentToExpand }
      }));
    }

    // Close the panel
    onClose();
  };

  const handleDeleteLayout = async (layoutKey: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the add layout action

    if (!confirm(`Are you sure you want to delete the layout "${layoutKey}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/layouts/${layoutKey}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete layout');
      }

      console.log('✅ Layout deleted successfully:', layoutKey);

      // Refresh the page to reload layouts
      window.location.reload();
    } catch (error) {
      console.error('Failed to delete layout:', error);
      alert('Failed to delete layout. Check console for details.');
    }
  };

  const handleEditLayout = async (layoutKey: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the add layout action

    // Get current category
    const category = getLayoutCategory(layoutKey) || 'Custom';

    // Convert layout-key to Layout Name
    const layoutName = layoutKey
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    // Set state and open dialog
    setEditingLayoutKey(layoutKey);
    setEditingLayoutName(layoutName);
    setEditingLayoutCategory(category);
    setIsEditLayoutDialogOpen(true);
  };

  const handleConfirmEditLayout = async (layoutName: string, category: string, imageFile: File | null, oldLayoutKey?: string) => {
    if (!oldLayoutKey) return;

    try {
      // Generate new layout key from name
      const newLayoutKey = layoutName.toLowerCase().replace(/\s+/g, '-');

      // Call API to update layout
      const response = await fetch(`/api/layouts/${oldLayoutKey}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newLayoutKey,
          newLayoutName: layoutName,
          category,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update layout');
      }

      console.log('✅ Layout updated successfully:', layoutName);

      // Refresh the page to reload layouts
      window.location.reload();
    } catch (error) {
      console.error('Failed to update layout:', error);
      throw error;
    }
  };

  const handleAddComponent = (componentId: string) => {
    if (!currentPageId) return;

    // Determine parent (selected container or Body)
    const parentId = selectedLayerId || 'body';

    // Find the component
    const component = components.find(c => c.id === componentId);
    if (!component) return;

    // Create a component instance layer directly
    const componentInstanceLayer = {
      id: generateId('lyr'),
      name: 'div',
      customName: component.name,
      componentId: component.id,
      classes: ['block'], // Ensure it renders as a block element
      children: [], // Will be populated by resolveComponents on published pages
    };

    // Use the internal addLayerFromTemplate to properly add to tree
    // But we need to add it more directly through the pages store
    const draft = usePagesStore.getState().draftsByPageId[currentPageId];
    if (!draft) return;

    // Find parent layer
    const findLayerWithParent = (tree: any[], id: string, parent: any | null = null): { layer: any; parent: any | null } | null => {
      for (const node of tree) {
        if (node.id === id) return { layer: node, parent };
        if (node.children) {
          const found = findLayerWithParent(node.children, id, node);
          if (found) return found;
        }
      }
      return null;
    };

    const result = findLayerWithParent(draft.layers, parentId);
    let newLayers;
    let parentToExpand: string | null = null;

    if (!result) {
      // Add to root
      newLayers = [...draft.layers, componentInstanceLayer];
    } else {
      // Check if parent can have children
      if (canHaveChildren(result.layer)) {
        // Add as child
        const updateLayerInTree = (tree: any[], layerId: string, updater: (l: any) => any): any[] => {
          return tree.map((node) => {
            if (node.id === layerId) {
              return updater(node);
            }
            if (node.children && node.children.length > 0) {
              return { ...node, children: updateLayerInTree(node.children, layerId, updater) };
            }
            return node;
          });
        };

        newLayers = updateLayerInTree(draft.layers, parentId, (parent) => ({
          ...parent,
          children: [...(parent.children || []), componentInstanceLayer],
        }));
        parentToExpand = parentId;
      } else {
        // Insert after the selected layer
        if (result.parent) {
          const updateLayerInTree = (tree: any[], layerId: string, updater: (l: any) => any): any[] => {
            return tree.map((node) => {
              if (node.id === layerId) {
                return updater(node);
              }
              if (node.children && node.children.length > 0) {
                return { ...node, children: updateLayerInTree(node.children, layerId, updater) };
              }
              return node;
            });
          };

          newLayers = updateLayerInTree(draft.layers, result.parent.id, (grandparent) => {
            const children = grandparent.children || [];
            const selectedIndex = children.findIndex((c: any) => c.id === parentId);
            const newChildren = [...children];
            newChildren.splice(selectedIndex + 1, 0, componentInstanceLayer);
            return { ...grandparent, children: newChildren };
          });
          parentToExpand = result.parent.id;
        } else {
          // Selected layer is at root level, insert after it
          const selectedIndex = draft.layers.findIndex((l: any) => l.id === parentId);
          newLayers = [...draft.layers];
          newLayers.splice(selectedIndex + 1, 0, componentInstanceLayer);
        }
      }
    }

    // Update the draft with the new layers (this should trigger autosave)
    usePagesStore.getState().setDraftLayers(currentPageId, newLayers);

    // Broadcast component add to other collaborators - find actual parent
    if (liveLayerUpdates) {
      const findLayerWithParent = (layers: any[], id: string, parent: any = null): { layer: any; parent: any } | null => {
        for (const layer of layers) {
          if (layer.id === id) return { layer, parent };
          if (layer.children) {
            const found = findLayerWithParent(layer.children, id, layer);
            if (found) return found;
          }
        }
        return null;
      };
      const found = findLayerWithParent(newLayers, componentInstanceLayer.id);
      const actualParentId = found?.parent?.id || null;
      liveLayerUpdates.broadcastLayerAdd(currentPageId, actualParentId, `component:${componentId}`, componentInstanceLayer);
    }

    // Select the new layer
    setSelectedLayerId(componentInstanceLayer.id);

    // Expand parent if needed
    if (parentToExpand) {
      window.dispatchEvent(new CustomEvent('expandLayer', {
        detail: { layerId: parentToExpand }
      }));
    }

    // Close the panel
    onClose();
  };

  const handleEditComponent = async (component: Component, e: React.MouseEvent) => {
    e.stopPropagation();

    const { setSelectedLayerId: setLayerId } = useEditorStore.getState();

    setLayerId(null);

    if (editingComponentId) {
      const currentComponent = getComponentById(editingComponentId);
      if (currentComponent) {
        pushComponentNavigation({
          type: 'component',
          id: editingComponentId,
          name: currentComponent.name,
          layerId: selectedLayerId,
        });
      }
    } else if (currentPageId) {
      const currentPage = pages.find((p) => p.id === currentPageId);
      if (currentPage) {
        pushComponentNavigation({
          type: 'page',
          id: currentPageId,
          name: currentPage.name,
          layerId: selectedLayerId,
        });
      }
    }

    await loadComponentDraft(component.id);
    openComponent(component.id, currentPageId, undefined, undefined);

    if (component.layers?.length) {
      setLayerId(component.layers[0].id);
    }

    onClose();
  };

  const handleDeleteClick = async (component: Component, e: React.MouseEvent) => {
    e.stopPropagation();
    setComponentToDelete(component);

    // Get preview of affected entities
    const preview = await getDeletePreview(component.id);
    if (preview) {
      const pageCount = preview.affectedEntities.filter(e => e.type === 'page').length;
      const componentCount = preview.affectedEntities.filter(e => e.type === 'component').length;
      setDeletePreviewInfo({ pageCount, componentCount });
    } else {
      setDeletePreviewInfo({ pageCount: 0, componentCount: 0 });
    }

    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!componentToDelete) return;

    setIsDeleting(true);
    try {
      await deleteComponent(componentToDelete.id);
    } catch (error) {
      console.error('Failed to delete component:', error);
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setComponentToDelete(null);
      setDeletePreviewInfo(null);
    }
  };

  const componentName = componentToDelete?.name ?? '';
  let usageSuffix = 'This component is not used anywhere.';
  if (deletePreviewInfo && (deletePreviewInfo.pageCount > 0 || deletePreviewInfo.componentCount > 0)) {
    const parts: string[] = [];
    if (deletePreviewInfo.pageCount > 0) {
      parts.push(`${deletePreviewInfo.pageCount} ${deletePreviewInfo.pageCount === 1 ? 'page' : 'pages'}`);
    }
    if (deletePreviewInfo.componentCount > 0) {
      parts.push(`${deletePreviewInfo.componentCount} ${deletePreviewInfo.componentCount === 1 ? 'component' : 'components'}`);
    }
    usageSuffix = `This component is used in ${parts.join(' and ')}.`;
  }

  const deleteConfirmDescription = `Are you sure you want to delete "${componentName}"? ${usageSuffix}`;

  if (!isOpen) return null;

  return (
    <div className="fixed left-64 top-14 bottom-0 w-64 bg-background border-r z-50 flex flex-col">
        {/* Tabs */}
        <Tabs
          value={activeTab} onValueChange={(value) => setActiveTab(value as 'elements' | 'layouts' | 'components')}
          className="flex flex-col h-full overflow-hidden gap-0"
        >
          <div className="flex flex-col flex-shrink-0 gap-2">
            <div className="p-4 pb-0">
              <TabsList className="w-full">
                <TabsTrigger value="elements">Elements</TabsTrigger>
                <TabsTrigger value="layouts">Layouts</TabsTrigger>
                <TabsTrigger value="components">Components</TabsTrigger>
              </TabsList>
            </div>

            <hr className="mt-2 mb-0 mx-4 flex-shrink-0" />
          </div>

          <TabsContent value="elements" className="flex flex-col divide-y overflow-y-auto flex-1 px-4 pb-4 no-scrollbar">
            {Object.entries(elementCategories).map(([categoryName, elements]) => (
              <div key={categoryName} className="flex flex-col pb-5">
                <header className="py-5">
                  <Label>{categoryName}</Label>
                </header>
                <div className="grid grid-cols-2 gap-2">
                  {elements.map((el) => (
                    <Button
                      key={el}
                      onClick={() => handleAddElement(el)}
                      size="sm"
                      variant="secondary"
                      className="justify-start"
                    >
                      <Icon name={getBlockIcon(el)} />
                      <span className="truncate">{getBlockName(el)}</span>
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="layouts" className="flex flex-col overflow-y-auto flex-1 px-4 pb-4 no-scrollbar">
            {getAllLayoutKeys().length === 0 ? (
              <Empty>
                <EmptyTitle>No layouts available</EmptyTitle>
                <EmptyDescription>Pre-built page layouts will appear here</EmptyDescription>
              </Empty>
            ) : (
              <div className="flex flex-col divide-y pb-5">
                {Object.entries(getLayoutsByCategory()).map(([category, layoutKeys]) => {
                  const isCollapsed = collapsedCategories.has(category);

                  return (
                    <div key={category} className="flex flex-col">
                      <header
                        className="py-5 flex items-center gap-2 cursor-pointer hover:opacity-70 transition-opacity"
                        onClick={() => toggleCategory(category)}
                      >
                        <Icon
                          name="triangle-down"
                          className={cn(
                            'size-3 opacity-25 transition-transform',
                            isCollapsed && '-rotate-90'
                          )}
                        />
                        <Label className="cursor-pointer">{category}</Label>
                      </header>
                      {!isCollapsed && (
                        <div className="grid grid-cols-1 gap-1.5 pb-5">
                      {layoutKeys.map((layoutKey) => {
                        const previewImage = getLayoutPreviewImage(layoutKey);

                        return (
                          <ContextMenu key={layoutKey}>
                            <ContextMenuTrigger asChild>
                              <Button
                                onClick={() => handleAddLayout(layoutKey)}
                                size="sm"
                                variant="secondary"
                                className="justify-start flex-col items-start p-1.5 overflow-hidden hover:opacity-90 transition-opacity rounded-[10px] !h-auto"
                              >
                                {previewImage && (
                                  <Image
                                    src={previewImage}
                                    width={640}
                                    height={262}
                                    alt="Layout preview"
                                    className="object-contain w-full h-full rounded"
                                  />
                                )}
                              </Button>
                            </ContextMenuTrigger>

                            <ContextMenuContent>
                              <ContextMenuItem onClick={() => handleAddLayout(layoutKey)}>
                                <Icon name="plus" className="size-3" />
                                Add to Canvas
                              </ContextMenuItem>

                              {process.env.NODE_ENV === 'development' && (
                                <>
                                  <ContextMenuSeparator />
                                  <ContextMenuItem onClick={(e) => handleEditLayout(layoutKey, e)}>
                                    <Icon name="pencil" className="size-3" />
                                    Edit
                                  </ContextMenuItem>
                                  <ContextMenuItem
                                    onClick={(e) => handleDeleteLayout(layoutKey, e)}
                                    className="text-red-500 focus:text-red-500"
                                  >
                                    <Icon name="trash" className="size-3" />
                                    Delete
                                  </ContextMenuItem>
                                </>
                              )}
                            </ContextMenuContent>
                          </ContextMenu>
                        );
                      })}
                    </div>
                      )}
                </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="components" className="flex flex-col overflow-y-auto flex-1 px-4 pb-4 no-scrollbar">
            {components.length === 0 ? (
              <Empty>
                <EmptyTitle>No components yet</EmptyTitle>
                <EmptyDescription>
                  Right-click a layer and select &quot;Create component&quot; to make it reusable
                </EmptyDescription>
              </Empty>
            ) : (
              <div className="flex flex-col pb-5">
                <div className="py-5 h-14">
                  <Label>Components</Label>
                </div>
                <div className="grid grid-cols-1 gap-1.5 pb-5">
                  {components.map((component) => (
                    <div key={component.id} className="group flex flex-col gap-1.5">
                      <Button
                        onClick={() => handleAddComponent(component.id)}
                        size="sm"
                        variant="secondary"
                        className="justify-start flex-col items-start p-1.5 overflow-hidden hover:opacity-90 transition-opacity rounded-[10px] !h-auto"
                      >
                        <Image
                          src={DEFAULT_ASSETS.IMAGE}
                          alt=""
                          width={640}
                          height={262}
                          unoptimized
                          className="object-contain w-full h-full rounded"
                        />
                      </Button>
                      <div className="flex items-center gap-1 px-0.5 min-w-0">
                        <span className="flex-1 truncate text-xs font-medium" title={component.name}>
                          {component.name}
                        </span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="size-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Icon name="more" className="size-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => handleEditComponent(component, e)}>Edit</DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => handleDeleteClick(component, e)}>Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <SaveLayoutDialog
          open={isEditLayoutDialogOpen}
          onOpenChange={setIsEditLayoutDialogOpen}
          onConfirm={handleConfirmEditLayout}
          defaultName={editingLayoutName}
          defaultCategory={editingLayoutCategory}
          mode="edit"
          layoutKey={editingLayoutKey}
        />

        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Delete component"
          description={deleteConfirmDescription}
          confirmLabel={isDeleting ? 'Deleting...' : 'Delete'}
          confirmVariant="destructive"
          onConfirm={handleConfirmDelete}
          onCancel={() => {
            setComponentToDelete(null);
            setDeletePreviewInfo(null);
          }}
        />
    </div>
  );
}
