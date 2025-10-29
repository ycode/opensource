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
  const { currentPageId, selectedLayerId } = useEditorStore();

  const handleAddElement = (elementType: string) => {
    if (!currentPageId) return;

    // Determine parent (selected container or Body)
    const parentId = selectedLayerId || 'body';

    // Add the layer using the template
    addLayerFromTemplate(currentPageId, parentId, elementType);

    // Close the panel
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed left-72 top-0 h-full w-[400px] bg-zinc-900 border-l border-zinc-800 z-50 overflow-y-auto shadow-2xl">
      {/* Header */}
      <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Add Element</h2>
        <Button 
          onClick={onClose}
          variant="ghost"
          size="icon-sm"
          aria-label="Close element library"
        >
          <Icon name="x" className="w-5 h-5" />
        </Button>
      </div>

        {/* Tabs */}
        <Tabs defaultValue="elements" className="flex-1">
          <TabsList className="w-full rounded-none border-b border-zinc-800 bg-transparent">
            <TabsTrigger value="elements">Elements</TabsTrigger>
            <TabsTrigger value="layouts">Layouts</TabsTrigger>
            <TabsTrigger value="components">Components</TabsTrigger>
          </TabsList>

          <TabsContent value="elements" className="p-4 space-y-6 mt-0">
            {/* Structure Category */}
            <div>
              <h3 className="text-sm font-semibold mb-3 text-zinc-400 uppercase tracking-wide">Structure</h3>
              <div className="grid grid-cols-2 gap-2">
                {structureElements.map((el) => (
                  <Button
                    key={el}
                    onClick={() => handleAddElement(el)}
                    variant="ghost"
                    className="flex flex-col items-center gap-2 p-4 h-auto bg-zinc-800 hover:bg-zinc-700"
                  >
                    <div className="w-12 h-12 rounded-lg bg-zinc-700 group-hover:bg-zinc-600 flex items-center justify-center transition-colors">
                      <Icon name={(getIcon(el) as any) || 'box'} className="w-6 h-6 text-zinc-300" />
                    </div>
                    <span className="text-xs text-zinc-300">{getBlockName(el)}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Content Category */}
            <div>
              <h3 className="text-sm font-semibold mb-3 text-zinc-400 uppercase tracking-wide">Content</h3>
              <div className="grid grid-cols-2 gap-2">
                {contentElements.map((el) => (
                  <Button
                    key={el}
                    onClick={() => handleAddElement(el)}
                    variant="ghost"
                    className="flex flex-col items-center gap-2 p-4 h-auto bg-zinc-800 hover:bg-zinc-700"
                  >
                    <div className="w-12 h-12 rounded-lg bg-zinc-700 group-hover:bg-zinc-600 flex items-center justify-center transition-colors">
                      <Icon name={(getIcon(el) as any) || 'type'} className="w-6 h-6 text-zinc-300" />
                    </div>
                    <span className="text-xs text-zinc-300">{getBlockName(el)}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Actions Category */}
            <div>
              <h3 className="text-sm font-semibold mb-3 text-zinc-400 uppercase tracking-wide">Actions</h3>
              <div className="grid grid-cols-2 gap-2">
                {actionElements.map((el) => (
                  <Button
                    key={el}
                    onClick={() => handleAddElement(el)}
                    variant="ghost"
                    className="flex flex-col items-center gap-2 p-4 h-auto bg-zinc-800 hover:bg-zinc-700"
                  >
                    <div className="w-12 h-12 rounded-lg bg-zinc-700 group-hover:bg-zinc-600 flex items-center justify-center transition-colors">
                      <Icon name={(getIcon(el) as any) || 'square'} className="w-6 h-6 text-zinc-300" />
                    </div>
                    <span className="text-xs text-zinc-300">{getBlockName(el)}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Media Category */}
            <div>
              <h3 className="text-sm font-semibold mb-3 text-zinc-400 uppercase tracking-wide">Media</h3>
              <div className="grid grid-cols-2 gap-2">
                {mediaElements.map((el) => (
                  <Button
                    key={el}
                    onClick={() => handleAddElement(el)}
                    variant="ghost"
                    className="flex flex-col items-center gap-2 p-4 h-auto bg-zinc-800 hover:bg-zinc-700"
                  >
                    <div className="w-12 h-12 rounded-lg bg-zinc-700 group-hover:bg-zinc-600 flex items-center justify-center transition-colors">
                      <Icon name={(getIcon(el) as any) || 'image'} className="w-6 h-6 text-zinc-300" />
                    </div>
                    <span className="text-xs text-zinc-300">{getBlockName(el)}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Forms Category */}
            <div>
              <h3 className="text-sm font-semibold mb-3 text-zinc-400 uppercase tracking-wide">Forms</h3>
              <div className="grid grid-cols-2 gap-2">
                {formElements.map((el) => (
                  <Button
                    key={el}
                    onClick={() => handleAddElement(el)}
                    variant="ghost"
                    className="flex flex-col items-center gap-2 p-4 h-auto bg-zinc-800 hover:bg-zinc-700"
                  >
                    <div className="w-12 h-12 rounded-lg bg-zinc-700 group-hover:bg-zinc-600 flex items-center justify-center transition-colors">
                      <Icon name={(getIcon(el) as any) || 'file-text'} className="w-6 h-6 text-zinc-300" />
                    </div>
                    <span className="text-xs text-zinc-300">{getBlockName(el)}</span>
                  </Button>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="layouts" className="p-4">
            <div className="text-center py-8 text-zinc-500">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-800 flex items-center justify-center">
                <Icon name="layout" className="w-8 h-8 text-zinc-600" />
              </div>
              <p className="text-sm text-zinc-400">Layouts coming soon</p>
              <p className="text-xs text-zinc-500 mt-1">Pre-built page layouts</p>
            </div>
          </TabsContent>

          <TabsContent value="components" className="p-4">
            <div className="text-center py-8 text-zinc-500">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-800 flex items-center justify-center">
                <Icon name="box" className="w-8 h-8 text-zinc-600" />
              </div>
              <p className="text-sm text-zinc-400">Components coming soon</p>
              <p className="text-xs text-zinc-500 mt-1">Reusable component library</p>
            </div>
          </TabsContent>
        </Tabs>
    </div>
  );
}

