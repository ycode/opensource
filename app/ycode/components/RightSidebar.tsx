'use client';

/**
 * Right Sidebar - Properties Panel
 * 
 * Shows properties for selected layer with Tailwind class editor
 */

// 1. React/Next.js
import { useCallback, useMemo, useState } from 'react';

// 2. External libraries
import debounce from 'lodash.debounce';
import { X } from 'lucide-react';

// 3. ShadCN UI
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

// 4. Internal components
import AddAttributeModal from './AddAttributeModal';
import BackgroundsControls from './BackgroundsControls';
import BorderControls from './BorderControls';
import ClassAutocompleteInput from './ClassAutocompleteInput';
import EffectControls from './EffectControls';
import LayoutControls from './LayoutControls';
import PositioningControls from './PositioningControls';
import SettingsPanel from './SettingsPanel';
import SizingControls from './SizingControls';
import SpacingControls from './SpacingControls';
import ToggleGroup from './ToggleGroup';
import TypographyControls from './TypographyControls';

// 5. Stores
import { useEditorStore } from '../../../stores/useEditorStore';
import { usePagesStore } from '../../../stores/usePagesStore';

// 6. Utils, APIs, lib
import { classesToDesign, mergeDesign, removeConflictsForClass } from '../../../lib/tailwind-class-mapper';

// 7. Types
import type { Layer } from '../../../types';

interface RightSidebarProps {
  selectedLayerId: string | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
}

export default function RightSidebar({
  selectedLayerId,
  onLayerUpdate,
}: RightSidebarProps) {
  const [activeTab, setActiveTab] = useState<'design' | 'settings' | 'content'>('design');
  const [currentClassInput, setCurrentClassInput] = useState<string>('');
  const [attributesOpen, setAttributesOpen] = useState(true);
  const [customId, setCustomId] = useState<string>('');
  const [isHidden, setIsHidden] = useState<boolean>(false);
  const [headingTag, setHeadingTag] = useState<string>('h1');
  const [containerTag, setContainerTag] = useState<string>('div');
  const [customAttributesOpen, setCustomAttributesOpen] = useState(true);
  const [showAddAttributeModal, setShowAddAttributeModal] = useState(false);

  const { currentPageId, activeBreakpoint } = useEditorStore();
  const { draftsByPageId } = usePagesStore();

  const selectedLayer: Layer | null = useMemo(() => {
    if (! currentPageId || ! selectedLayerId) return null;
    const draft = draftsByPageId[currentPageId];
    if (! draft) return null;
    const stack: Layer[] = [...draft.layers];
    while (stack.length) {
      const node = stack.shift()!;
      if (node.id === selectedLayerId) return node;
      if (node.children) stack.push(...node.children);
    }
    return null;
  }, [currentPageId, selectedLayerId, draftsByPageId]);

  // Helper function to check if layer is a heading
  const isHeadingLayer = (layer: Layer | null): boolean => {
    if (!layer) return false;
    const headingTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'heading'];
    return headingTags.includes(layer.type || '') || 
           headingTags.includes(layer.name || '') ||
           headingTags.includes(layer.settings?.tag || '');
  };

  // Helper function to check if layer is a container/section/block
  const isContainerLayer = (layer: Layer | null): boolean => {
    if (!layer) return false;
    const containerTags = [
      'div', 'container', 'section', 'nav', 'main', 'aside', 
      'header', 'footer', 'article', 'figure', 'figcaption',
      'details', 'summary'
    ];
    return containerTags.includes(layer.type || '') || 
           containerTags.includes(layer.name || '') ||
           containerTags.includes(layer.settings?.tag || '');
  };

  // Get default heading tag based on layer type/name
  const getDefaultHeadingTag = (layer: Layer | null): string => {
    if (!layer) return 'h1';
    if (layer.settings?.tag) return layer.settings.tag;
    if (layer.name && ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(layer.name)) {
      return layer.name;
    }
    return 'h1'; // Default to h1
  };

  // Get default container tag based on layer type/name
  const getDefaultContainerTag = (layer: Layer | null): string => {
    if (!layer) return 'div';
    if (layer.settings?.tag) return layer.settings.tag;
    
    // Check if layer.name is already a valid semantic tag
    if (layer.name && ['div', 'section', 'nav', 'main', 'aside', 'header', 'footer', 'article', 'figure', 'figcaption', 'details', 'summary'].includes(layer.name)) {
      return layer.name;
    }
    
    // Map element types to their default tags:
    // Section = section, Container = div, Block = div
    if (layer.name === 'section') return 'section';
    if (layer.type === 'container' || layer.name === 'container') return 'div';
    
    return 'div'; // Default fallback
  };

  // Derive classes input directly from selectedLayer (reactive to changes)
  const classesInput = useMemo(() => {
    if (!selectedLayer?.classes) return '';
    return Array.isArray(selectedLayer.classes) 
      ? selectedLayer.classes.join(' ') 
      : selectedLayer.classes;
  }, [selectedLayer?.classes]);

  // Parse classes into array for badge display
  const classesArray = useMemo(() => {
    return classesInput.split(' ').filter(cls => cls.trim() !== '');
  }, [classesInput]);

  // Update local state when selected layer changes (for settings fields)
  const [prevSelectedLayerId, setPrevSelectedLayerId] = useState<string | null>(null);
  if (selectedLayerId !== prevSelectedLayerId) {
    setPrevSelectedLayerId(selectedLayerId);
    setCustomId(selectedLayer?.settings?.id || '');
    setIsHidden(selectedLayer?.settings?.hidden || false);
    setHeadingTag(selectedLayer?.settings?.tag || getDefaultHeadingTag(selectedLayer));
    setContainerTag(selectedLayer?.settings?.tag || getDefaultContainerTag(selectedLayer));
  }

  // Add a new class
  const addClass = useCallback((newClass: string) => {
    if (!newClass.trim() || !selectedLayer) return;
    
    const trimmedClass = newClass.trim();
    if (classesArray.includes(trimmedClass)) return; // Don't add duplicates
    
    // Remove any conflicting classes before adding the new one
    const classesWithoutConflicts = removeConflictsForClass(classesArray, trimmedClass);
    
    // Parse the new class to extract design properties
    const parsedDesign = classesToDesign([trimmedClass]);
    
    // Merge with existing design
    const updatedDesign = mergeDesign(selectedLayer.design, parsedDesign);
    
    // Add the new class (after removing conflicts)
    const newClasses = [...classesWithoutConflicts, trimmedClass].join(' ');
    
    // Update layer with both classes AND design object
    onLayerUpdate(selectedLayer.id, { 
      classes: newClasses,
      design: updatedDesign 
    });
    
    setCurrentClassInput('');
  }, [classesArray, selectedLayer, onLayerUpdate]);

  // Remove a class
  const removeClass = useCallback((classToRemove: string) => {
    if (!selectedLayer) return;
    const newClasses = classesArray.filter(cls => cls !== classToRemove).join(' ');
    onLayerUpdate(selectedLayer.id, { classes: newClasses });
  }, [classesArray, selectedLayer, onLayerUpdate]);

  // Handle Enter key press
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addClass(currentClassInput);
    }
  }, [currentClassInput, addClass]);

  const debouncedUpdate = useMemo(
    () =>
      debounce((layerId: string, classes: string) => {
        onLayerUpdate(layerId, { classes });
      }, 500),
    [onLayerUpdate]
  );

  const handleClassesChange = (value: string) => {
    if (selectedLayerId) {
      debouncedUpdate(selectedLayerId, value);
    }
  };

  const addClasses = (newClasses: string) => {
    if (!selectedLayerId) return;
    const currentClasses = classesInput;
    const updated = currentClasses + ' ' + newClasses;
    onLayerUpdate(selectedLayerId, { classes: updated.trim() });
  };

  // Handle custom ID change
  const handleIdChange = (value: string) => {
    setCustomId(value);
    if (selectedLayerId) {
      const currentSettings = selectedLayer?.settings || {};
      onLayerUpdate(selectedLayerId, {
        settings: { ...currentSettings, id: value }
      });
    }
  };

  // Handle visibility toggle
  const handleVisibilityChange = (hidden: boolean) => {
    setIsHidden(hidden);
    if (selectedLayerId) {
      const currentSettings = selectedLayer?.settings || {};
      onLayerUpdate(selectedLayerId, { 
        settings: { ...currentSettings, hidden }
      });
    }
  };

  // Handle heading tag change
  const handleHeadingTagChange = (tag: string) => {
    setHeadingTag(tag);
    if (selectedLayerId) {
      const currentSettings = selectedLayer?.settings || {};
      onLayerUpdate(selectedLayerId, { 
        settings: { ...currentSettings, tag }
      });
    }
  };

  // Handle container tag change
  const handleContainerTagChange = (tag: string) => {
    setContainerTag(tag);
    if (selectedLayerId) {
      const currentSettings = selectedLayer?.settings || {};
      onLayerUpdate(selectedLayerId, { 
        settings: { ...currentSettings, tag }
      });
    }
  };

  // Handle adding custom attribute
  const handleAddAttribute = (name: string, value: string) => {
    if (selectedLayerId) {
      const currentSettings = selectedLayer?.settings || {};
      const currentAttributes = currentSettings.customAttributes || {};
      onLayerUpdate(selectedLayerId, {
        settings: {
          ...currentSettings,
          customAttributes: { ...currentAttributes, [name]: value }
        }
      });
    }
  };

  // Handle removing custom attribute
  const handleRemoveAttribute = (name: string) => {
    if (selectedLayerId) {
      const currentSettings = selectedLayer?.settings || {};
      const currentAttributes = { ...currentSettings.customAttributes };
      delete currentAttributes[name];
      onLayerUpdate(selectedLayerId, {
        settings: {
          ...currentSettings,
          customAttributes: currentAttributes
        }
      });
    }
  };

  if (! selectedLayerId || ! selectedLayer) {
    return (
      <div className="w-64 shrink-0 bg-neutral-950 border-l border-white/10 flex items-center justify-center h-screen">
        <span className="text-xs text-white/50">Select layer</span>
      </div>
    );
  }

  return (
    <div className="w-64 shrink-0 bg-neutral-950 border-l border-white/10 flex flex-col h-screen">
      {/* Tabs */}
      <Tabs
        value={activeTab} onValueChange={(value) => setActiveTab(value as 'design' | 'settings' | 'content')}
        className="flex flex-col flex-1 min-h-0"
      >
        <div className="p-4 pb-0">
          <TabsList className="w-full">
            <TabsTrigger value="design">Design</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
        </div>

        <hr className="mt-4 mx-4" />

        {/* Breakpoint Indicator (only show on Design tab) */}
        {activeTab === 'design' && (
          <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900/50 border-b border-zinc-800">
            <span className="text-xs text-zinc-400">
              Editing: <span className="text-white font-medium capitalize">{activeBreakpoint}</span>
            </span>
          </div>
        )}

        {/* Content */}
        <TabsContent value="design" className="flex-1 flex flex-col divide-y overflow-y-auto data-[state=inactive]:hidden overflow-x-hidden px-4 mt-0 pb-12">

          <LayoutControls layer={selectedLayer} onLayerUpdate={onLayerUpdate} />

          <SpacingControls layer={selectedLayer} onLayerUpdate={onLayerUpdate} />

          <SizingControls layer={selectedLayer} onLayerUpdate={onLayerUpdate} />

          <TypographyControls layer={selectedLayer} onLayerUpdate={onLayerUpdate} />

          <BackgroundsControls layer={selectedLayer} onLayerUpdate={onLayerUpdate} />

          <BorderControls layer={selectedLayer} onLayerUpdate={onLayerUpdate} />

          <EffectControls layer={selectedLayer} onLayerUpdate={onLayerUpdate} />

          <PositioningControls layer={selectedLayer} onLayerUpdate={onLayerUpdate} />

          <div className="flex flex-col gap-4 py-5">
            <ClassAutocompleteInput
              value={currentClassInput}
              onChange={setCurrentClassInput}
              onAccept={addClass}
              placeholder="Type class and press Enter..."
            />
            <div className="flex flex-wrap gap-1.5">
              {classesArray.length === 0 ? (
                  <div></div>
              ) : (
                classesArray.map((cls, index) => (
                      <Badge
                        variant="secondary"
                        key={index}
                      >
                        <span>{cls}</span>
                        <Button
                          onClick={() => removeClass(cls)} className="!size-4 !p-0 -mr-1"
                          variant="outline"
                        >
                          <Icon name="x" className="size-2" />
                        </Button>
                      </Badge>
                ))
              )}
            </div>
          </div>

        </TabsContent>

        <TabsContent value="settings" className="flex-1 overflow-y-auto mt-0 data-[state=inactive]:hidden px-4 pb-12">
          <div className="flex flex-col gap-4 py-2">
            {/* Attributes Panel */}
            <SettingsPanel
              title="Attributes"
              isOpen={attributesOpen}
              onToggle={() => setAttributesOpen(!attributesOpen)}
            >
              {/* ID Field */}
              <div>
                <label className="block text-xs text-zinc-400 mb-2">ID</label>
                <Input
                  type="text"
                  value={customId}
                  onChange={(e) => handleIdChange(e.target.value)}
                  placeholder="Identifier"
                  className="w-full bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600"
                />
              </div>

              {/* Element Visibility Toggle */}
              <div>
                <label className="block text-xs text-zinc-400 mb-2">Element</label>
                <ToggleGroup
                  options={[
                    { label: 'Shown', value: false },
                    { label: 'Hidden', value: true },
                  ]}
                  value={isHidden}
                  onChange={(value) => handleVisibilityChange(value as boolean)}
                />
              </div>

              {/* Heading Tag Selector - Only for headings */}
              {isHeadingLayer(selectedLayer) && (
                <div>
                  <label className="block text-xs text-zinc-400 mb-2">Tag</label>
                  <ToggleGroup
                    options={[
                      { label: 'H1', value: 'h1' },
                      { label: 'H2', value: 'h2' },
                      { label: 'H3', value: 'h3' },
                      { label: 'H4', value: 'h4' },
                      { label: 'H5', value: 'h5' },
                      { label: 'H6', value: 'h6' },
                    ]}
                    value={headingTag}
                    onChange={(value) => handleHeadingTagChange(value as string)}
                  />
                </div>
              )}

              {/* Container Tag Selector - Only for containers/sections/blocks */}
              {isContainerLayer(selectedLayer) && !isHeadingLayer(selectedLayer) && (
                <div>
                  <label className="block text-xs text-zinc-400 mb-2">Tag</label>
                  <Select value={containerTag} onValueChange={handleContainerTagChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="div">Div</SelectItem>
                        <SelectItem value="nav">Nav</SelectItem>
                        <SelectItem value="main">Main</SelectItem>
                        <SelectItem value="aside">Aside</SelectItem>
                        <SelectItem value="header">Header</SelectItem>
                        <SelectItem value="figure">Figure</SelectItem>
                        <SelectItem value="footer">Footer</SelectItem>
                        <SelectItem value="article">Article</SelectItem>
                        <SelectItem value="section">Section</SelectItem>
                        <SelectItem value="figcaption">Figcaption</SelectItem>
                        <SelectItem value="details">Details</SelectItem>
                        <SelectItem value="summary">Summary</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </SettingsPanel>

            {/* Custom Attributes Panel */}
            <SettingsPanel
              title="Custom attributes"
              isOpen={customAttributesOpen}
              onToggle={() => setCustomAttributesOpen(!customAttributesOpen)}
              action={
                <button
                  onClick={() => setShowAddAttributeModal(true)}
                  className="text-zinc-400 hover:text-white transition-colors"
                >
                  <Icon name="plus" className="size-4" />
                </button>
              }
            >
              {selectedLayer?.settings?.customAttributes && 
               Object.keys(selectedLayer.settings.customAttributes).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(selectedLayer.settings.customAttributes).map(([name, value]) => (
                    <div
                      key={name}
                      className="flex items-center justify-between px-3 py-2 bg-zinc-900 rounded-lg text-sm text-zinc-300"
                    >
                      <span>{name}=&quot;{value}&quot;</span>
                      <button
                        onClick={() => handleRemoveAttribute(name)}
                        className="text-zinc-500 hover:text-white transition-colors"
                      >
                        <Icon name="x" className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-zinc-500 text-xs">
                  HTML attributes can be used to append additional information to your elements.
                </div>
              )}
            </SettingsPanel>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Attribute Modal */}
      <AddAttributeModal
        isOpen={showAddAttributeModal}
        onClose={() => setShowAddAttributeModal(false)}
        onAdd={handleAddAttribute}
      />
    </div>
  );
}
