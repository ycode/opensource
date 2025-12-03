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
import Image from 'next/image';
import { getTemplate, getBlockName, getBlockIcon, getLayoutTemplate, getLayoutCategory, getLayoutPreviewImage, getLayoutsByCategory, getAllLayoutKeys } from '@/lib/templates/blocks';
import { canHaveChildren } from '@/lib/layer-utils';
import { usePagesStore } from '@/stores/usePagesStore';
import { useEditorStore } from '@/stores/useEditorStore';
import { useComponentsStore } from '@/stores/useComponentsStore';

interface ElementLibraryProps {
  isOpen: boolean;
  onClose: () => void;
}

// Category definitions
const elementCategories: Record<string, string[]> = {
  Structure: ['section', 'container', 'div', 'hr', 'columns', 'rows', 'grid', 'collection'],
  Content: ['heading', 'p', 'richtext'],
  Actions: ['button', 'link'],
  Media: ['image', 'icon', 'video', 'audio'],
  Form: ['form', 'input', 'textarea', 'select', 'checkbox', 'radio', 'label'],
};

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

  const handleAddLayout = (layoutKey: string) => {
    // If editing component, use component draft instead
    if (editingComponentId) {
      const layers = componentDrafts[editingComponentId] || [];
      const parentId = selectedLayerId || layers[0]?.id || 'body';

      // Get layout template
      const layoutTemplate = getLayoutTemplate(layoutKey);
      if (!layoutTemplate) return;

      const newLayer = {
        ...layoutTemplate,
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

    // Get layout template
    const layoutTemplate = getLayoutTemplate(layoutKey);
    if (!layoutTemplate) return;

    const newLayer = {
      ...layoutTemplate,
    };

    // Use the internal addLayerFromTemplate logic but with our layout
    const draft = usePagesStore.getState().draftsByPageId[currentPageId];
    if (!draft) {
      const page = usePagesStore.getState().pages.find(p => p.id === currentPageId);
      if (!page) return;
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

    // Update the draft with the new layers
    usePagesStore.getState().setDraftLayers(currentPageId, newLayers);

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
    <div className="fixed left-64 top-14 bottom-0 w-64 bg-background border-r z-50 flex flex-col">
        {/* Tabs */}
        <Tabs defaultValue="elements" className="flex flex-col h-full overflow-hidden gap-0">
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
                <div className="py-4">
                  <Label>{categoryName}</Label>
                </div>
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
                      {getBlockName(el)}
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
              <div className="flex flex-col pb-5">
                {Object.entries(getLayoutsByCategory()).map(([category, layoutKeys]) => (
                  <div key={category} className="flex flex-col pb-5">
                    <div className="py-5">
                      <Label>{category}</Label>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {layoutKeys.map((layoutKey) => {
                        const previewImage = getLayoutPreviewImage(layoutKey);

                        return (
                          <Button
                            key={layoutKey}
                            onClick={() => handleAddLayout(layoutKey)}
                            size="sm"
                            variant="secondary"
                            className="justify-start flex-col items-start p-1.5 overflow-hidden hover:opacity-90 transition-opacity rounded-[10px] !h-auto"
                          >
                            {previewImage && (
                                <img
                                  src={previewImage}
                                  alt="Layout preview"
                                  className="object-contain w-full h-full rounded"
                                />
                            )}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                ))}
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
