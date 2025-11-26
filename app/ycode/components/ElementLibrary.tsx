'use client';

/**
 * Element Library Slide-Out Panel
 *
 * Displays categorized list of available elements that can be added to the page
 */

import React from 'react';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty';

import { getTemplate, getBlockName, getIcon } from '@/lib/templates/blocks';
import { canHaveChildren } from '@/lib/layer-utils';

import { usePagesStore } from '@/stores/usePagesStore';
import { useEditorStore } from '@/stores/useEditorStore';
import { useComponentsStore } from '@/stores/useComponentsStore';

interface ElementLibraryProps {
  isOpen: boolean;
  onClose: () => void;
}

// Category definitions
const structureElements = ['section', 'container', 'div', 'hr', 'columns', 'rows', 'grid'];
const contentElements = ['heading', 'p', 'span', 'richtext'];
const actionElements = ['button', 'link'];
const mediaElements = ['image', 'icon', 'video', 'audio', 'youtube', 'iframe'];
const formElements = ['form', 'input', 'textarea', 'select', 'checkbox', 'radio', 'label', 'submit'];

export default function ElementLibrary({ isOpen, onClose }: ElementLibraryProps) {
  const { addLayerFromTemplate, updateLayer, setDraftLayers, draftsByPageId } = usePagesStore();
  const { currentPageId, selectedLayerId, setSelectedLayerId, editingComponentId } = useEditorStore();
  const { components, componentDrafts, updateComponentDraft } = useComponentsStore();

  const handleAddElement = (elementType: string) => {
    // If editing component, use component draft instead
    if (editingComponentId) {
      const layers = componentDrafts[editingComponentId] || [];
      const parentId = selectedLayerId || layers[0]?.id || 'body';

      // Create new layer from template
      const template = getTemplate(elementType);
      const displayName = getBlockName(elementType);
      const newLayer = {
        ...template,
        id: `layer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        customName: displayName || undefined, // Set display name
      };

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
        updateComponentDraft(editingComponentId, result.newLayers);
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
    const parentId = selectedLayerId || 'body';

    // Add the layer using the template
    const result = addLayerFromTemplate(currentPageId, parentId, elementType);

    // Select the newly added layer
    if (result) {
      setSelectedLayerId(result.newLayerId);

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

  const handleAddComponent = (componentId: string) => {
    if (!currentPageId) return;

    // Determine parent (selected container or Body)
    const parentId = selectedLayerId || 'body';

    // Find the component
    const component = components.find(c => c.id === componentId);
    if (!component) return;

    // Create a component instance layer directly
    const componentInstanceLayer = {
      id: `layer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
      const canHaveChildrenUtil = (layer: any) => {
        const nonContainerElements = ['img', 'input', 'hr', 'br'];
        const tag = layer.name || layer.type || 'div';
        return !nonContainerElements.includes(tag);
      };

      if (canHaveChildrenUtil(result.layer)) {
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

  if (!isOpen) return null;

  return (
    <div className="fixed left-64 top-14 h-full w-64 bg-background border-r z-50 overflow-y-auto p-4 flex flex-col">
        {/* Tabs */}
        <Tabs defaultValue="elements" className="flex-1 gap-0">
          <TabsList className="w-full">
            <TabsTrigger value="elements">Elements</TabsTrigger>
            <TabsTrigger value="layouts">Layouts</TabsTrigger>
            <TabsTrigger value="components">Components</TabsTrigger>
          </TabsList>

          <hr className="mt-4" />

          <TabsContent value="elements" className="flex flex-col divide-y">
            {/* Structure Category */}
            <div className="flex flex-col pb-5">
              <div className="py-5 h-14">
                <Label>Structure</Label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {structureElements.map((el) => (
                  <Button
                    key={el}
                    onClick={() => handleAddElement(el)}
                    size="sm"
                    variant="secondary"
                    className="justify-start"
                  >
                    <Icon name={getIcon(el) || 'box'} />
                    {getBlockName(el)}
                  </Button>
                ))}
              </div>
            </div>

            {/* Content Category */}
            <div className="flex flex-col pb-5">
              <div className="py-5 h-14">
                <Label>Content</Label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {contentElements.map((el) => (
                  <Button
                    key={el}
                    onClick={() => handleAddElement(el)}
                    size="sm"
                    variant="secondary"
                    className="justify-start"
                  >
                    <Icon name={getIcon(el) || 'box'} />
                    {getBlockName(el)}
                  </Button>
                ))}
              </div>
            </div>

            {/* Actions Category */}
            <div className="flex flex-col pb-5">
              <div className="py-5 h-14">
                <Label>Actions</Label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {actionElements.map((el) => (
                  <Button
                    key={el}
                    onClick={() => handleAddElement(el)}
                    size="sm"
                    variant="secondary"
                    className="justify-start"
                  >
                    <Icon name={getIcon(el) || 'box'} />
                    {getBlockName(el)}
                  </Button>
                ))}
              </div>
            </div>

            {/* Media Category */}
            <div className="flex flex-col pb-5">
              <div className="py-5 h-14">
                <Label>Media</Label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {mediaElements.map((el) => (
                  <Button
                    key={el}
                    onClick={() => handleAddElement(el)}
                    size="sm"
                    variant="secondary"
                    className="justify-start"
                  >
                    <Icon name={getIcon(el) || 'box'} />
                    {getBlockName(el)}
                  </Button>
                ))}
              </div>
            </div>

            {/* Forms Category */}
            <div className="flex flex-col pb-5">
              <div className="py-5 h-14">
                <Label>Form</Label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {formElements.map((el) => (
                  <Button
                    key={el}
                    onClick={() => handleAddElement(el)}
                    size="sm"
                    variant="secondary"
                    className="justify-start"
                  >
                    <Icon name={getIcon(el) || 'box'} />
                    {getBlockName(el)}
                  </Button>
                ))}
              </div>
            </div>

          </TabsContent>

          <TabsContent value="layouts" className="flex flex-col">
            <Empty>
              <EmptyTitle>Coming soon</EmptyTitle>
              <EmptyDescription>Pre-built page layouts are coming soon</EmptyDescription>
            </Empty>
          </TabsContent>

          <TabsContent value="components" className="flex flex-col">
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
                <div className="grid grid-cols-2 gap-2">
                  {components.map((component) => (
                    <Button
                      key={component.id}
                      onClick={() => handleAddComponent(component.id)}
                      size="sm"
                      variant="secondary"
                      className="justify-start"
                    >
                      <Icon name="box" />
                      {component.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
    </div>
  );
}
