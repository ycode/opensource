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

import { usePagesStore } from '@/stores/usePagesStore';
import { useEditorStore } from '@/stores/useEditorStore';

interface ElementLibraryProps {
  isOpen: boolean;
  onClose: () => void;
}

// Category definitions
const structureElements = ['div', 'section', 'container', 'hr', 'columns', 'rows', 'grid'];
const contentElements = ['heading', 'p', 'span', 'richtext'];
const actionElements = ['button', 'link'];
const mediaElements = ['image', 'icon', 'video', 'audio', 'youtube', 'iframe'];
const formElements = ['form', 'input', 'textarea', 'select', 'checkbox', 'radio', 'label', 'submit'];

export default function ElementLibrary({ isOpen, onClose }: ElementLibraryProps) {
  const { addLayerFromTemplate } = usePagesStore();
  const { currentPageId, selectedLayerId, setSelectedLayerId } = useEditorStore();

  const handleAddElement = (elementType: string) => {
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

  if (!isOpen) return null;

  return (
    <div className="fixed left-72 top-14 h-full w-72 bg-background border-r z-50 overflow-y-auto p-4 flex flex-col">
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
            <Empty>
              <EmptyTitle>Coming soon</EmptyTitle>
              <EmptyDescription>Reusable component library are coming soon</EmptyDescription>
            </Empty>
          </TabsContent>
        </Tabs>
    </div>
  );
}

