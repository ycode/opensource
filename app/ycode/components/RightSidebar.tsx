'use client';

/**
 * Right Sidebar - Properties Panel
 *
 * Shows properties for selected layer with Tailwind class editor
 */

// 1. React/Next.js
import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';

// 2. External libraries
import debounce from 'lodash.debounce';

// 3. ShadCN UI
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import Icon from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectLabel, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

// 4. Internal components
import AddAttributeModal from './AddAttributeModal';
import BackgroundsControls from './BackgroundsControls';
import BorderControls from './BorderControls';
import EffectControls from './EffectControls';
import CollectionFiltersSettings from './CollectionFiltersSettings';
import ConditionalVisibilitySettings from './ConditionalVisibilitySettings';
import ImageSettings from './ImageSettings';
import InputWithInlineVariables from './InputWithInlineVariables';
import InteractionsPanel from './InteractionsPanel';
import LayoutControls from './LayoutControls';
import LayerStylesPanel from './LayerStylesPanel';
import PositionControls from './PositionControls';
import SettingsPanel from './SettingsPanel';
import SizingControls from './SizingControls';
import SpacingControls from './SpacingControls';
import ToggleGroup from './ToggleGroup';
import TypographyControls from './TypographyControls';
import UIStateSelector from './UIStateSelector';

// 5. Stores
import { useEditorStore } from '@/stores/useEditorStore';
import { useComponentsStore } from '@/stores/useComponentsStore';
import { usePagesStore } from '@/stores/usePagesStore';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import { useEditorActions, useEditorUrl } from '@/hooks/use-editor-url';

// 6. Utils, APIs, lib
import { classesToDesign, mergeDesign, removeConflictsForClass } from '@/lib/tailwind-class-mapper';
import { cn } from '@/lib/utils';
import { isFieldVariable, getCollectionVariable, findParentCollectionLayer, isTextEditable, findLayerWithParent } from '@/lib/layer-utils';
import { convertContentToValue, parseValueToContent } from '@/lib/cms-variables-utils';

// 7. Types
import type { Layer, FieldVariable, CollectionField } from '@/types';
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty';
import {
  DropdownMenu,
  DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuShortcut,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

interface RightSidebarProps {
  selectedLayerId: string | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
}

const RightSidebar = React.memo(function RightSidebar({
  selectedLayerId,
  onLayerUpdate,
}: RightSidebarProps) {
  const { openComponent, urlState, updateQueryParams } = useEditorActions();
  const { routeType } = useEditorUrl();

  // Local state for immediate UI feedback
  const [activeTab, setActiveTab] = useState<'design' | 'settings' | 'interactions'>(
    urlState.rightTab || 'design'
  );

  // Track last user-initiated change to prevent URL→state sync loops
  const lastUserChangeRef = useRef<number>(0);

  // Handle tab change: optimistic UI update + background URL sync
  const handleTabChange = useCallback((value: string) => {
    const newTab = value as 'design' | 'settings' | 'interactions';

    // Immediate UI update
    setActiveTab(newTab);

    // Mark as user-initiated (prevents URL→state sync for 100ms)
    lastUserChangeRef.current = Date.now();

    // Background URL update
    if (routeType === 'page' || routeType === 'layers' || routeType === 'component') {
      updateQueryParams({ tab: newTab });
    }
  }, [routeType, updateQueryParams]);

  // Sync URL→state only for external navigation (back/forward, direct URL)
  useEffect(() => {
    // Skip if this was a recent user-initiated change (within 100ms)
    if (Date.now() - lastUserChangeRef.current < 100) {
      return;
    }

    const urlTab = urlState.rightTab || 'design';
    if (urlTab !== activeTab) {
      setActiveTab(urlTab);
    }
  }, [urlState.rightTab, activeTab]);

  const [currentClassInput, setCurrentClassInput] = useState<string>('');
  const [attributesOpen, setAttributesOpen] = useState(true);
  const [customId, setCustomId] = useState<string>('');
  const [isHidden, setIsHidden] = useState<boolean>(false);
  const [headingTag, setHeadingTag] = useState<string>('h1');
  const [containerTag, setContainerTag] = useState<string>('div');
  const [customAttributesOpen, setCustomAttributesOpen] = useState(true);
  const [showAddAttributePopover, setShowAddAttributePopover] = useState(false);
  const [newAttributeName, setNewAttributeName] = useState('');
  const [newAttributeValue, setNewAttributeValue] = useState('');
  const [classesOpen, setClassesOpen] = useState(true);
  const [collectionBindingOpen, setCollectionBindingOpen] = useState(true);
  const [fieldBindingOpen, setFieldBindingOpen] = useState(true);
  const [contentOpen, setContentOpen] = useState(true);
  const [localeLabelOpen, setLocaleLabelOpen] = useState(true);
  const [interactionOwnerLayerId, setInteractionOwnerLayerId] = useState<string | null>(null);
  const [selectedTriggerId, setSelectedTriggerId] = useState<string | null>(null);
  const [interactionResetKey, setInteractionResetKey] = useState(0);

  // Optimize store subscriptions - use selective selectors
  const currentPageId = useEditorStore((state) => state.currentPageId);
  const activeBreakpoint = useEditorStore((state) => state.activeBreakpoint);
  const editingComponentId = useEditorStore((state) => state.editingComponentId);
  const setSelectedLayerId = useEditorStore((state) => state.setSelectedLayerId);
  const setInteractionHighlights = useEditorStore((state) => state.setInteractionHighlights);
  const setActiveInteraction = useEditorStore((state) => state.setActiveInteraction);
  const clearActiveInteraction = useEditorStore((state) => state.clearActiveInteraction);

  const draftsByPageId = usePagesStore((state) => state.draftsByPageId);
  const pages = usePagesStore((state) => state.pages);

  const getComponentById = useComponentsStore((state) => state.getComponentById);
  const componentDrafts = useComponentsStore((state) => state.componentDrafts);

  const collections = useCollectionsStore((state) => state.collections);
  const fields = useCollectionsStore((state) => state.fields);
  const loadFields = useCollectionsStore((state) => state.loadFields);

  // Get all layers (for interactions target selection)
  const allLayers: Layer[] = useMemo(() => {
    if (editingComponentId) {
      return componentDrafts[editingComponentId] || [];
    } else if (currentPageId) {
      const draft = draftsByPageId[currentPageId];
      return draft ? draft.layers : [];
    }
    return [];
  }, [editingComponentId, componentDrafts, currentPageId, draftsByPageId]);

  // Helper to find layer by ID
  const findLayerById = useCallback((layerId: string | null): Layer | null => {
    if (!layerId || !allLayers.length) return null;

    const stack: Layer[] = [...allLayers];
    while (stack.length) {
      const node = stack.shift()!;
      if (node.id === layerId) return node;
      if (node.children) stack.push(...node.children);
    }
    return null;
  }, [allLayers]);

  const selectedLayer: Layer | null = useMemo(() => {
    return findLayerById(selectedLayerId);
  }, [selectedLayerId, findLayerById]);

  // Get the layer whose interactions we're editing (different from selected layer during target selection)
  const interactionOwnerLayer: Layer | null = useMemo(() => {
    return findLayerById(interactionOwnerLayerId);
  }, [interactionOwnerLayerId, findLayerById]);

  // Check if selected layer is at root level (has no parent) - used to disable pagination
  const isSelectedLayerAtRoot: boolean = useMemo(() => {
    if (!selectedLayerId || !allLayers.length) return false;
    const result = findLayerWithParent(allLayers, selectedLayerId);
    return result?.parent === null;
  }, [selectedLayerId, allLayers]);

  // Check if selected collection is nested inside another collection
  // If so, we hide the pagination option entirely (not just disable it)
  const isNestedInCollection: boolean = useMemo(() => {
    if (!selectedLayer || !selectedLayerId) return false;

    const collectionVar = getCollectionVariable(selectedLayer);
    if (!collectionVar) return false;

    const parentCollection = findParentCollectionLayer(allLayers, selectedLayerId);
    return !!parentCollection;
  }, [selectedLayer, selectedLayerId, allLayers]);

  // Check if pagination should be disabled (only for root-level case where we show a message)
  const isPaginationDisabled: boolean = useMemo(() => {
    if (!selectedLayer) return true;

    const collectionVar = getCollectionVariable(selectedLayer);
    if (!collectionVar) return true;

    // If at root level (no parent container at all), pagination is disabled (need a container for sibling)
    return isSelectedLayerAtRoot;
  }, [selectedLayer, isSelectedLayerAtRoot]);

  // Get the reason why pagination is disabled (only for actionable messages)
  const paginationDisabledReason: string | null = useMemo(() => {
    if (!selectedLayer) return null;

    const collectionVar = getCollectionVariable(selectedLayer);
    if (!collectionVar) return null;

    if (isSelectedLayerAtRoot) {
      return 'Wrap collection in a container to enable pagination';
    }

    return null;
  }, [selectedLayer, isSelectedLayerAtRoot]);

  // Set interaction owner when interactions tab becomes active
  useEffect(() => {
    if (activeTab === 'interactions' && selectedLayerId && !interactionOwnerLayerId) {
      setInteractionOwnerLayerId(selectedLayerId);
    }
  }, [activeTab, selectedLayerId, interactionOwnerLayerId]);

  // Update interaction owner layer when selected layer changes (only if no trigger is selected)
  useEffect(() => {
    if (activeTab === 'interactions' && selectedLayerId && !selectedTriggerId) {
      setInteractionOwnerLayerId(selectedLayerId);
    }
  }, [activeTab, selectedLayerId, selectedTriggerId]);

  // Clear interaction owner when tab changes away from interactions
  useEffect(() => {
    if (activeTab !== 'interactions' && interactionOwnerLayerId) {
      setInteractionOwnerLayerId(null);
    }
  }, [activeTab, interactionOwnerLayerId]);

  // Update active interaction (current trigger and its target layers from tweens)
  useEffect(() => {
    if (activeTab === 'interactions' && interactionOwnerLayer) {
      const interactions = interactionOwnerLayer.interactions || [];
      const targetIds = new Set<string>();

      interactions.forEach(interaction => {
        (interaction.tweens || []).forEach(tween => {
          targetIds.add(tween.layer_id);
        });
      });

      if (targetIds.size > 0) {
        setActiveInteraction(interactionOwnerLayer.id, Array.from(targetIds));
      } else {
        clearActiveInteraction();
      }
    } else {
      clearActiveInteraction();
    }
  }, [activeTab, interactionOwnerLayer, setActiveInteraction, clearActiveInteraction]);

  // Compute interaction highlights from all layers (always shown, styling varies by tab)
  useEffect(() => {
    const triggerIds = new Set<string>();
    const targetIds = new Set<string>();

    const collectInteractions = (layers: Layer[]) => {
      layers.forEach(layer => {
        const interactions = layer.interactions || [];
        const hasTweens = interactions.some(i => (i.tweens || []).length > 0);

        if (hasTweens) {
          triggerIds.add(layer.id);
          interactions.forEach(interaction => {
            (interaction.tweens || []).forEach(tween => {
              targetIds.add(tween.layer_id);
            });
          });
        }

        if (layer.children) {
          collectInteractions(layer.children);
        }
      });
    };

    collectInteractions(allLayers);
    setInteractionHighlights(Array.from(triggerIds), Array.from(targetIds));
  }, [allLayers, setInteractionHighlights]);

  // Handle all interaction state changes from InteractionsPanel
  const handleInteractionStateChange = useCallback((state: {
    selectedTriggerId?: string | null;
    shouldRefresh?: boolean;
  }) => {
    // Handle trigger selection
    if (state.selectedTriggerId !== undefined) {
      setSelectedTriggerId(state.selectedTriggerId);
    }

    // Handle refresh request
    if (state.shouldRefresh && selectedLayerId) {
      setInteractionOwnerLayerId(selectedLayerId);
      setSelectedTriggerId(null);
      setInteractionResetKey(prev => prev + 1);
    }
  }, [selectedLayerId]);

  // Helper function to check if layer is a heading
  const isHeadingLayer = (layer: Layer | null): boolean => {
    if (!layer) return false;
    const headingTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'heading'];
    return headingTags.includes(layer.name || '') ||
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
    return containerTags.includes(layer.name || '') ||
           containerTags.includes(layer.settings?.tag || '');
  };

  // Helper function to check if layer is a text element
  const isTextLayer = (layer: Layer | null): boolean => {
    if (!layer) return false;
    const layerName = (layer.name || '').toLowerCase();
    const textTypes = ['text', 'heading', 'p', 'span', 'label', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
    return textTypes.includes(layerName) || isHeadingLayer(layer);
  };

  // Helper function to check if layer is an image element
  const isImageLayer = (layer: Layer | null): boolean => {
    if (!layer) return false;
    return layer.name === 'image';
  };

  // Helper function to check if layer is a button element
  const isButtonLayer = (layer: Layer | null): boolean => {
    if (!layer) return false;
    return layer.name === 'button' || layer.settings?.tag === 'button';
  };

  // Control visibility rules based on layer type
  const shouldShowControl = (controlName: string, layer: Layer | null): boolean => {
    if (!layer) return false;

    switch (controlName) {
      case 'layout':
        // Layout controls: show for containers, hide for text-only elements
        return !isTextLayer(layer) || isButtonLayer(layer);

      case 'spacing':
        // Spacing controls: show for all elements
        return true;

      case 'sizing':
        // Sizing controls: show for all elements
        return true;

      case 'typography':
        // Typography controls: only show for text elements
        return isTextLayer(layer) || isButtonLayer(layer);

      case 'backgrounds':
        // Background controls: hide for text elements, show for buttons and containers
        return !isTextLayer(layer) || isButtonLayer(layer);

      case 'borders':
        // Border controls: hide for pure text elements, show for everything else
        return !isTextLayer(layer) || isButtonLayer(layer);

      case 'effects':
        // Effect controls (opacity, shadow): show for all
        return true;

      case 'position':
        // Position controls: show for all
        return true;

      default:
        return true;
    }
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

    return 'div'; // Default fallback
  };

  // Classes input state (synced with selectedLayer)
  const [classesInput, setClassesInput] = useState<string>('');

  // Sync classesInput when selectedLayer changes
  useEffect(() => {
    if (!selectedLayer?.classes) {
      setClassesInput('');
    } else {
      const classes = Array.isArray(selectedLayer.classes)
        ? selectedLayer.classes.join(' ')
        : selectedLayer.classes;
      setClassesInput(classes);
    }
  }, [selectedLayer]);

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

  // Debounced updater for classes
  const debouncedUpdate = useMemo(
    () =>
      debounce((layerId: string, classes: string) => {
        onLayerUpdate(layerId, { classes });
      }, 500),
    [onLayerUpdate]
  );

  const handleClassesChange = useCallback((value: string) => {
    setClassesInput(value);
    if (selectedLayerId) {
      debouncedUpdate(selectedLayerId, value);
    }
  }, [debouncedUpdate, selectedLayerId]);

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
    // Note: Use join instead of cn() here because removeConflictsForClass
    // already handles property-aware conflict resolution
    const newClasses = [...classesWithoutConflicts, trimmedClass].join(' ');

    // Update layer with both classes AND design object
    onLayerUpdate(selectedLayer.id, {
      classes: newClasses,
      design: updatedDesign
    });

    setCurrentClassInput('');
  }, [classesArray, onLayerUpdate, selectedLayer]);

  // Remove a class
  const removeClass = useCallback((classToRemove: string) => {
    if (!selectedLayer) return;
    const newClasses = classesArray.filter(cls => cls !== classToRemove).join(' ');
    setClassesInput(newClasses);
    handleClassesChange(newClasses);
  }, [classesArray, handleClassesChange, selectedLayer]);

  // Handle Enter key press
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addClass(currentClassInput);
    }
  }, [currentClassInput, addClass]);

  const addClasses = (newClasses: string) => {
    if (!selectedLayerId) return;
    const currentClasses = classesInput;
    // Use cn() to ensure proper merging and avoid duplicates
    const updated = cn(currentClasses, newClasses);
    onLayerUpdate(selectedLayerId, { classes: updated });
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

  // Handle content change (with inline variables)
  const handleContentChange = useCallback((value: string) => {
    if (!selectedLayerId) return;

    // Always create a DynamicTextVariable (even for plain text)
    const textVariable = value ? {
      type: 'dynamic_text' as const,
      data: { content: value },
    } : undefined;

    onLayerUpdate(selectedLayerId, {
      variables: {
        ...selectedLayer?.variables,
        text: textVariable,
      },
    });
  }, [selectedLayerId, selectedLayer, onLayerUpdate]);

  // Get content value for display
  const getContentValue = useCallback((layer: Layer | null): string => {
    if (!layer) return '';

    // Check layer.variables.text (DynamicTextVariable with embedded JSON)
    if (layer.variables?.text && layer.variables.text.type === 'dynamic_text') {
      return layer.variables.text.data.content;
    }

    return '';
  }, []);

  // Handle collection binding change
  const handleCollectionChange = (collectionId: string) => {
    if (selectedLayerId && selectedLayer) {
      const currentCollectionVariable = getCollectionVariable(selectedLayer);
      onLayerUpdate(selectedLayerId, {
        variables: {
          ...selectedLayer?.variables,
          collection: collectionId ? {
            id: collectionId,
            // Preserve existing sort settings when changing collection
            sort_by: currentCollectionVariable?.sort_by,
            sort_order: currentCollectionVariable?.sort_order,
          } : undefined
        }
      });
    }
  };

  // Handle sort by change
  const handleSortByChange = (sortBy: string) => {
    if (selectedLayerId && selectedLayer) {
      const currentCollectionVariable = getCollectionVariable(selectedLayer);
      if (currentCollectionVariable) {
        onLayerUpdate(selectedLayerId, {
          variables: {
            ...selectedLayer?.variables,
            collection: {
              ...currentCollectionVariable,
              sort_by: sortBy,
              // Reset sort_order to 'asc' when changing sort_by
              sort_order: (sortBy !== 'none' && sortBy !== 'manual' && sortBy !== 'random') ? 'asc' : currentCollectionVariable.sort_order,
            }
          }
        });
      }
    }
  };

  // Handle reference field selection (for reference or multi-reference as collection source)
  const handleReferenceFieldChange = (fieldId: string) => {
    if (selectedLayerId && selectedLayer) {
      const currentCollectionVariable = getCollectionVariable(selectedLayer);
      // Find the selected field to get its reference_collection_id and type
      const selectedField = parentCollectionFields.find(f => f.id === fieldId);
      if (selectedField?.reference_collection_id) {
        onLayerUpdate(selectedLayerId, {
          variables: {
            ...selectedLayer?.variables,
            collection: {
              ...currentCollectionVariable,
              id: selectedField.reference_collection_id, // Set collection ID from reference field's target
              source_field_id: fieldId, // Store the field ID for runtime filtering
              source_field_type: selectedField.type as 'reference' | 'multi_reference', // Store field type for behavior
            }
          }
        });
      }
    }
  };

  // Handle dynamic page source selection (unified handler for field or collection)
  // Value format: "field:{fieldId}" or "collection:{collectionId}" or "none"
  const handleDynamicPageSourceChange = (value: string) => {
    if (!selectedLayerId || !selectedLayer) return;

    const currentCollectionVariable = getCollectionVariable(selectedLayer);

    if (value === 'none' || !value) {
      // Clear collection binding
      onLayerUpdate(selectedLayerId, {
        variables: {
          ...selectedLayer?.variables,
          collection: {
            id: '',
            source_field_id: undefined,
            source_field_type: undefined,
          }
        }
      });
      return;
    }

    if (value.startsWith('field:')) {
      // Reference field from CMS page data
      const fieldId = value.replace('field:', '');
      const selectedField = dynamicPageReferenceFields.find(f => f.id === fieldId);
      if (selectedField?.reference_collection_id) {
        onLayerUpdate(selectedLayerId, {
          variables: {
            ...selectedLayer?.variables,
            collection: {
              ...currentCollectionVariable,
              id: selectedField.reference_collection_id,
              source_field_id: fieldId,
              source_field_type: selectedField.type as 'reference' | 'multi_reference',
            }
          }
        });
      }
    } else if (value.startsWith('collection:')) {
      // Direct collection selection
      const collectionId = value.replace('collection:', '');
      onLayerUpdate(selectedLayerId, {
        variables: {
          ...selectedLayer?.variables,
          collection: {
            id: collectionId,
            source_field_id: undefined,
            source_field_type: undefined,
            sort_by: currentCollectionVariable?.sort_by,
            sort_order: currentCollectionVariable?.sort_order,
          }
        }
      });
    }
  };

  // Get current value for dynamic page source dropdown
  const getDynamicPageSourceValue = useMemo(() => {
    if (!selectedLayer) return 'none';
    const collectionVariable = getCollectionVariable(selectedLayer);
    if (!collectionVariable?.id) return 'none';

    // If source_field_id is set, it's a field reference
    if (collectionVariable.source_field_id) {
      return `field:${collectionVariable.source_field_id}`;
    }

    // Otherwise it's a direct collection
    return `collection:${collectionVariable.id}`;
  }, [selectedLayer]);

  // Handle sort order change
  const handleSortOrderChange = (sortOrder: 'asc' | 'desc') => {
    if (selectedLayerId && selectedLayer) {
      const currentCollectionVariable = getCollectionVariable(selectedLayer);
      if (currentCollectionVariable) {
        onLayerUpdate(selectedLayerId, {
          variables: {
            ...selectedLayer?.variables,
            collection: {
              ...currentCollectionVariable,
              sort_order: sortOrder,
            }
          }
        });
      }
    }
  };

  // Handle limit change
  const handleLimitChange = (value: string) => {
    if (selectedLayerId && selectedLayer) {
      const currentCollectionVariable = getCollectionVariable(selectedLayer);
      if (currentCollectionVariable) {
        const limit = value === '' ? undefined : parseInt(value, 10);
        onLayerUpdate(selectedLayerId, {
          variables: {
            ...selectedLayer?.variables,
            collection: {
              ...currentCollectionVariable,
              limit: limit && limit > 0 ? limit : undefined,
            }
          }
        });
      }
    }
  };

  // Handle offset change
  const handleOffsetChange = (value: string) => {
    if (selectedLayerId && selectedLayer) {
      const currentCollectionVariable = getCollectionVariable(selectedLayer);
      if (currentCollectionVariable) {
        const offset = value === '' ? undefined : parseInt(value, 10);
        onLayerUpdate(selectedLayerId, {
          variables: {
            ...selectedLayer?.variables,
            collection: {
              ...currentCollectionVariable,
              offset: offset && offset >= 0 ? offset : undefined,
            }
          }
        });
      }
    }
  };

  // Helper: Create pagination wrapper for "pages" mode (Prev/Next buttons)
  const createPagesWrapper = (collectionLayerId: string): Layer => ({
    id: `${collectionLayerId}-pagination-wrapper`,
    name: 'div',
    customName: 'Pagination',
    classes: 'flex items-center justify-center gap-4 mt-4',
    attributes: {
      'data-pagination-for': collectionLayerId,
      'data-pagination-mode': 'pages',
    },
    children: [
      {
        id: `${collectionLayerId}-pagination-prev`,
        name: 'button',
        customName: 'Previous Button',
        classes: 'px-4 py-2 rounded bg-[#e5e7eb] hover:bg-[#d1d5db] transition-colors cursor-pointer',
        settings: { tag: 'button' },
        attributes: {
          'data-pagination-action': 'prev',
          'data-collection-layer-id': collectionLayerId,
        },
        children: [
          {
            id: `${collectionLayerId}-pagination-prev-text`,
            name: 'span',
            customName: 'Previous Text',
            classes: '',
            variables: {
              text: {
                type: 'dynamic_text',
                data: { content: 'Previous' }
              }
            }
          } as Layer,
        ],
      } as Layer,
      {
        id: `${collectionLayerId}-pagination-info`,
        name: 'span',
        customName: 'Page Info',
        classes: 'text-sm text-[#4b5563]',
        variables: {
          text: {
            type: 'dynamic_text',
            data: { content: 'Page 1 of 1' }
          }
        }
      } as Layer,
      {
        id: `${collectionLayerId}-pagination-next`,
        name: 'button',
        customName: 'Next Button',
        classes: 'px-4 py-2 rounded bg-[#e5e7eb] hover:bg-[#d1d5db] transition-colors cursor-pointer',
        settings: { tag: 'button' },
        attributes: {
          'data-pagination-action': 'next',
          'data-collection-layer-id': collectionLayerId,
        },
        children: [
          {
            id: `${collectionLayerId}-pagination-next-text`,
            name: 'span',
            customName: 'Next Text',
            classes: '',
            variables: {
              text: {
                type: 'dynamic_text',
                data: { content: 'Next' }
              }
            }
          } as Layer,
        ],
      } as Layer,
    ],
  });

  // Helper: Create pagination wrapper for "load_more" mode (Load more button + count)
  const createLoadMoreWrapper = (collectionLayerId: string): Layer => ({
    id: `${collectionLayerId}-pagination-wrapper`,
    name: 'div',
    customName: 'Load More',
    classes: 'flex flex-col items-center gap-2 mt-4',
    attributes: {
      'data-pagination-for': collectionLayerId,
      'data-pagination-mode': 'load_more',
    },
    children: [
      {
        id: `${collectionLayerId}-pagination-loadmore`,
        name: 'button',
        customName: 'Load More Button',
        classes: 'px-6 py-2 rounded bg-[#e5e7eb] hover:bg-[#d1d5db] transition-colors cursor-pointer',
        settings: { tag: 'button' },
        attributes: {
          'data-pagination-action': 'load_more',
          'data-collection-layer-id': collectionLayerId,
        },
        children: [
          {
            id: `${collectionLayerId}-pagination-loadmore-text`,
            name: 'span',
            customName: 'Load More Text',
            classes: '',
            variables: {
              text: {
                type: 'dynamic_text',
                data: { content: 'Load More' }
              }
            }
          } as Layer,
        ],
      } as Layer,
      {
        id: `${collectionLayerId}-pagination-count`,
        name: 'span',
        customName: 'Items Count',
        classes: 'text-sm text-[#4b5563]',
        variables: {
          text: {
            type: 'dynamic_text',
            data: { content: 'Showing items' }
          }
        }
      } as Layer,
    ],
  });

  // Helper: Get current layers from the appropriate store
  const getCurrentLayersFromStore = (): Layer[] => {
    if (editingComponentId) {
      return useComponentsStore.getState().componentDrafts[editingComponentId] || [];
    } else if (currentPageId) {
      const draft = usePagesStore.getState().draftsByPageId[currentPageId];
      return draft ? draft.layers : [];
    }
    return [];
  };

  // Helper: Add or replace pagination wrapper
  const addOrReplacePaginationWrapper = (collectionLayerId: string, mode: 'pages' | 'load_more') => {
    const currentLayers = getCurrentLayersFromStore();
    const parentResult = findLayerWithParent(currentLayers, collectionLayerId);
    const parentLayer = parentResult?.parent;

    if (!parentLayer) {
      console.warn('Pagination at root level not yet supported - collection layer should be inside a container');
      return;
    }

    const paginationWrapperId = `${collectionLayerId}-pagination-wrapper`;
    const paginationWrapper = mode === 'pages'
      ? createPagesWrapper(collectionLayerId)
      : createLoadMoreWrapper(collectionLayerId);

    // Get parent's CURRENT children from fresh lookup
    const freshParentResult = findLayerWithParent(currentLayers, parentLayer.id);
    const freshParent = freshParentResult?.layer || parentLayer;
    const parentChildren = freshParent.children || [];

    const collectionIndex = parentChildren.findIndex(c => c.id === collectionLayerId);
    const existingPaginationIndex = parentChildren.findIndex(c => c.id === paginationWrapperId);

    let newChildren: Layer[];
    if (existingPaginationIndex === -1) {
      // Add new wrapper after collection
      newChildren = [
        ...parentChildren.slice(0, collectionIndex + 1),
        paginationWrapper,
        ...parentChildren.slice(collectionIndex + 1),
      ];
    } else {
      // Replace existing wrapper
      newChildren = parentChildren.map(c => c.id === paginationWrapperId ? paginationWrapper : c);
    }

    onLayerUpdate(parentLayer.id, { children: newChildren });
  };

  // Helper: Remove pagination wrapper
  const removePaginationWrapper = (collectionLayerId: string) => {
    const currentLayers = getCurrentLayersFromStore();
    const parentResult = findLayerWithParent(currentLayers, collectionLayerId);
    const parentLayer = parentResult?.parent;

    if (!parentLayer) return;

    const paginationWrapperId = `${collectionLayerId}-pagination-wrapper`;
    const freshParentResult = findLayerWithParent(currentLayers, parentLayer.id);
    const freshParent = freshParentResult?.layer || parentLayer;
    const parentChildren = freshParent.children || [];

    const newChildren = parentChildren.filter(c => c.id !== paginationWrapperId);
    onLayerUpdate(parentLayer.id, { children: newChildren });
  };

  // Handle pagination enabled toggle
  const handlePaginationEnabledChange = (checked: boolean) => {
    if (selectedLayerId && selectedLayer) {
      const currentCollectionVariable = getCollectionVariable(selectedLayer);
      if (currentCollectionVariable) {
        const mode = currentCollectionVariable.pagination?.mode || 'pages';

        if (checked) {
          addOrReplacePaginationWrapper(selectedLayerId, mode);
        } else {
          removePaginationWrapper(selectedLayerId);
        }

        // Update the collection layer's pagination config
        onLayerUpdate(selectedLayerId, {
          variables: {
            ...selectedLayer?.variables,
            collection: {
              ...currentCollectionVariable,
              pagination: checked
                ? { enabled: true, mode, items_per_page: 10 }
                : undefined,
            }
          }
        });
      }
    }
  };

  // Handle items per page change
  const handleItemsPerPageChange = (value: string) => {
    if (selectedLayerId && selectedLayer) {
      const currentCollectionVariable = getCollectionVariable(selectedLayer);
      if (currentCollectionVariable?.pagination) {
        const itemsPerPage = parseInt(value, 10);
        if (!isNaN(itemsPerPage) && itemsPerPage > 0) {
          onLayerUpdate(selectedLayerId, {
            variables: {
              ...selectedLayer?.variables,
              collection: {
                ...currentCollectionVariable,
                pagination: {
                  ...currentCollectionVariable.pagination,
                  items_per_page: itemsPerPage,
                }
              }
            }
          });
        }
      }
    }
  };

  // Handle pagination mode change
  const handlePaginationModeChange = (mode: 'pages' | 'load_more') => {
    if (selectedLayerId && selectedLayer) {
      const currentCollectionVariable = getCollectionVariable(selectedLayer);
      if (currentCollectionVariable?.pagination) {
        // Recreate the pagination wrapper with the new mode
        addOrReplacePaginationWrapper(selectedLayerId, mode);

        // Update the collection layer's pagination config
        onLayerUpdate(selectedLayerId, {
          variables: {
            ...selectedLayer?.variables,
            collection: {
              ...currentCollectionVariable,
              pagination: {
                ...currentCollectionVariable.pagination,
                mode,
              }
            }
          }
        });
      }
    }
  };

  // Handle field binding change
  const handleFieldBindingChange = (fieldId: string) => {
    if (selectedLayerId) {
      if (fieldId && fieldId !== 'none') {
        onLayerUpdate(selectedLayerId, {
          variables: {
            ...selectedLayer?.variables,
            text: {
              type: 'field',
              data: {
                field_id: fieldId,
                relationships: [],
              }
            } as any
          }
        });
      } else {
        // Clear field binding
        onLayerUpdate(selectedLayerId, {
          variables: {
            ...selectedLayer?.variables,
            text: undefined
          }
        });
      }
    }
  };

  // Handle image field binding change
  const handleImageFieldBindingChange = (fieldId: string) => {
    if (selectedLayerId) {
      if (fieldId && fieldId !== 'none') {
        onLayerUpdate(selectedLayerId, {
          variables: {
            ...selectedLayer?.variables,
            image: {
              src: {
                type: 'field',
                data: {
                  field_id: fieldId,
                  relationships: [],
                }
              } as any,
              alt: selectedLayer?.variables?.image?.alt || {
                type: 'dynamic_text',
                data: { content: '' }
              }
            }
          }
        });
      } else {
        // Clear field binding
        onLayerUpdate(selectedLayerId, {
          variables: {
            ...selectedLayer?.variables,
            image: {
              src: {
                type: 'dynamic_text',
                data: { content: '' }
              },
              alt: selectedLayer?.variables?.image?.alt || {
                type: 'dynamic_text',
                data: { content: '' }
              }
            }
          }
        });
      }
    }
  };

  // Get parent collection layer for the selected layer
  const parentCollectionLayer = useMemo(() => {
    if (!selectedLayerId || !currentPageId) return null;

    // Get layers from either component draft or page draft
    let layers: Layer[] = [];
    if (editingComponentId) {
      layers = componentDrafts[editingComponentId] || [];
    } else {
      const draft = draftsByPageId[currentPageId];
      layers = draft ? draft.layers : [];
    }

    if (!layers.length) return null;

    // Use the utility function from layer-utils
    return findParentCollectionLayer(layers, selectedLayerId);
  }, [selectedLayerId, editingComponentId, componentDrafts, currentPageId, draftsByPageId]);

  // Get collection fields if parent collection layer exists
  const currentPage = useMemo(() => {
    if (!currentPageId) {
      return null;
    }
    return pages.find((page) => page.id === currentPageId) || null;
  }, [pages, currentPageId]);

  const parentCollectionFields = useMemo(() => {
    const collectionVariable = parentCollectionLayer ? getCollectionVariable(parentCollectionLayer) : null;
    let collectionId = collectionVariable?.id;

    if (!collectionId && currentPage?.is_dynamic) {
      collectionId = currentPage.settings?.cms?.collection_id || undefined;
    }

    if (!collectionId) return [];
    return fields[collectionId] || [];
  }, [parentCollectionLayer, fields, currentPage]);

  const fieldSourceLabel = useMemo(() => {
    // Check if fields come from parent collection layer
    if (parentCollectionLayer) {
      const collectionVariable = getCollectionVariable(parentCollectionLayer);
      const collectionId = collectionVariable?.id;
      if (collectionId) {
        const collection = collections.find(c => c.id === collectionId);
        return collection?.name; // Returns collection name like "Blog Posts"
      }
    }

    // Check if fields come from dynamic page
    if (currentPage?.is_dynamic && currentPage?.settings?.cms?.collection_id) {
      return 'CMS page data';
    }

    return undefined; // No label
  }, [parentCollectionLayer, currentPage, collections]);

  // Get collection fields for the currently selected collection layer (for Sort By dropdown)
  const selectedCollectionFields = useMemo(() => {
    if (!selectedLayer) return [];
    const collectionVariable = getCollectionVariable(selectedLayer);
    if (!collectionVariable) return [];

    const collectionId = collectionVariable?.id;
    if (!collectionId) return [];
    return fields[collectionId] || [];
  }, [selectedLayer, fields]);

  // Ensure fields for all referenced collections are loaded (for nested reference dropdowns)
  useEffect(() => {
    // Recursively find all referenced collection IDs
    const findReferencedCollections = (collectionFields: CollectionField[], visited: Set<string>): string[] => {
      const referencedIds: string[] = [];

      collectionFields.forEach(field => {
        if (field.type === 'reference' && field.reference_collection_id) {
          const refId = field.reference_collection_id;
          if (!visited.has(refId)) {
            visited.add(refId);
            referencedIds.push(refId);

            // Recursively check the referenced collection's fields if we have them
            const refFields = fields[refId];
            if (refFields) {
              referencedIds.push(...findReferencedCollections(refFields, visited));
            }
          }
        }
      });

      return referencedIds;
    };

    // Start with parent collection fields
    if (parentCollectionFields.length > 0) {
      const visited = new Set<string>();
      const referencedIds = findReferencedCollections(parentCollectionFields, visited);

      // Check if any referenced collections are missing fields
      const missingFieldsCollections = referencedIds.filter(id => !fields[id] || fields[id].length === 0);

      // Load missing fields - loadFields(null) loads all fields at once
      if (missingFieldsCollections.length > 0) {
        loadFields(null);
      }
    }
  }, [parentCollectionFields, fields, loadFields]);

  // Get reference fields from parent context (for Reference Field as Source option)
  // Includes both single reference and multi-reference fields
  const parentReferenceFields = useMemo(() => {
    return parentCollectionFields.filter(
      f => (f.type === 'reference' || f.type === 'multi_reference') && f.reference_collection_id
    );
  }, [parentCollectionFields]);

  // Get reference fields from dynamic page's source collection (for top-level collection layers on dynamic pages)
  const dynamicPageReferenceFields = useMemo(() => {
    if (!currentPage?.is_dynamic) return [];
    const collectionId = currentPage.settings?.cms?.collection_id;
    if (!collectionId) return [];
    const collectionFields = fields[collectionId] || [];
    return collectionFields.filter(
      f => (f.type === 'reference' || f.type === 'multi_reference') && f.reference_collection_id
    );
  }, [currentPage, fields]);

  // Handle adding custom attribute
  const handleAddAttribute = () => {
    if (selectedLayerId && newAttributeName.trim()) {
      const currentSettings = selectedLayer?.settings || {};
      const currentAttributes = currentSettings.customAttributes || {};
      onLayerUpdate(selectedLayerId, {
        settings: {
          ...currentSettings,
          customAttributes: { ...currentAttributes, [newAttributeName.trim()]: newAttributeValue }
        }
      });
      // Reset form and close popover
      setNewAttributeName('');
      setNewAttributeValue('');
      setShowAddAttributePopover(false);
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
      <div className="w-64 shrink-0 bg-background border-l flex items-center justify-center h-screen">
        <span className="text-xs text-white/50">Select layer</span>
      </div>
    );
  }

  // Check if selected layer is a component instance
  const isComponentInstance = !!selectedLayer.componentId;
  const component = isComponentInstance ? getComponentById(selectedLayer.componentId!) : null;

  // If it's a component instance, show a message with edit button instead of design properties
  if (isComponentInstance && component && !editingComponentId) {
    const handleEditMasterComponent = () => {
      const { loadComponentDraft } = useComponentsStore.getState();
      const { setSelectedLayerId } = useEditorStore.getState();

      // Load the component's layers into draft
      loadComponentDraft(component.id);

      // Select the first layer of the component
      if (component.layers && component.layers.length > 0) {
        setSelectedLayerId(component.layers[0].id);
      } else {
        setSelectedLayerId(null);
      }

      // Open component (updates state + URL)
      openComponent(component.id, currentPageId);
    };

    return (
      <div className="w-64 shrink-0 bg-background border-l flex flex-col p-4 pb-0 h-full overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <Empty>
            <EmptyTitle>Component Instance</EmptyTitle>
            <EmptyDescription>
              This is an instance of &quot;{component.name}&quot;. To edit this component, click the button below or right-click and select &quot;Edit master component&quot;.
            </EmptyDescription>
            <div>
              <Button
                onClick={handleEditMasterComponent}
                variant="secondary"
                size="sm"
              >
                Edit component
              </Button>
            </div>
          </Empty>
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 shrink-0 bg-background border-l flex flex-col p-4 pb-0 h-full overflow-hidden">

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="flex flex-col flex-1 min-h-0"
      >
        <div className="">
          <TabsList className="w-full">
            <TabsTrigger value="design">Design</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="interactions">Interactions</TabsTrigger>
          </TabsList>
        </div>

        <hr className="mt-2" />

        {/* Content */}
        <TabsContent value="design" className="flex-1 flex flex-col divide-y overflow-y-auto no-scrollbar data-[state=inactive]:hidden overflow-x-hidden mt-0">
          {/* Layer Styles Panel */}
          <LayerStylesPanel
            layer={selectedLayer}
            pageId={currentPageId}
            onLayerUpdate={onLayerUpdate}
          />

          {/* Field Binding Panel - show for text/image layers inside a collection */}
          {selectedLayer && parentCollectionLayer && parentCollectionFields.length > 0 && selectedLayer.name === 'image' && (
            <SettingsPanel
              title="Field Binding"
              isOpen={fieldBindingOpen}
              onToggle={() => setFieldBindingOpen(!fieldBindingOpen)}
            >
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-2">
                  <Label>Image Field</Label>
                  <Select
                    value={(() => {
                      const imageSrc = selectedLayer.variables?.image?.src;
                      return (imageSrc && typeof imageSrc === 'object' && imageSrc.type === 'field') ? imageSrc.data.field_id : 'none';
                    })()}
                    onValueChange={handleImageFieldBindingChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a field" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="none">None (Static image)</SelectItem>
                        {parentCollectionFields.filter(f => f.type === 'image').map((field) => (
                          <SelectItem key={field.id} value={field.id}>
                            {field.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Bind this image to a collection image field
                  </p>
                </div>
              </div>
            </SettingsPanel>
          )}

          {activeTab === 'design' && (
            <>
              <UIStateSelector selectedLayer={selectedLayer} />
            </>
          )}

          {shouldShowControl('layout', selectedLayer) && (
            <LayoutControls layer={selectedLayer} onLayerUpdate={onLayerUpdate} />
          )}

          {shouldShowControl('spacing', selectedLayer) && (
            <SpacingControls layer={selectedLayer} onLayerUpdate={onLayerUpdate} />
          )}

          {shouldShowControl('sizing', selectedLayer) && (
            <SizingControls layer={selectedLayer} onLayerUpdate={onLayerUpdate} />
          )}

          {shouldShowControl('typography', selectedLayer) && (
            <TypographyControls layer={selectedLayer} onLayerUpdate={onLayerUpdate} />
          )}

          {shouldShowControl('backgrounds', selectedLayer) && (
            <BackgroundsControls layer={selectedLayer} onLayerUpdate={onLayerUpdate} />
          )}

          {shouldShowControl('borders', selectedLayer) && (
            <BorderControls layer={selectedLayer} onLayerUpdate={onLayerUpdate} />
          )}

          {shouldShowControl('effects', selectedLayer) && (
            <EffectControls layer={selectedLayer} onLayerUpdate={onLayerUpdate} />
          )}

          {shouldShowControl('position', selectedLayer) && (
            <PositionControls layer={selectedLayer} onLayerUpdate={onLayerUpdate} />
          )}

          <SettingsPanel
            title="Classes"
            isOpen={classesOpen}
            onToggle={() => setClassesOpen(!classesOpen)}
          >
            <div className="flex flex-col gap-3">
              <Input
                value={currentClassInput}
                onChange={(e) => setCurrentClassInput(e.target.value)}
                onKeyDown={handleKeyPress}
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
          </SettingsPanel>
        </TabsContent>

        <TabsContent value="settings" className="flex-1 overflow-y-auto no-scrollbar mt-0 data-[state=inactive]:hidden">
          <div className="flex flex-col divide-y">
            {/* Attributes Panel */}
            <SettingsPanel
              title="Attributes"
              isOpen={attributesOpen}
              onToggle={() => setAttributesOpen(!attributesOpen)}
            >
              <div className="grid grid-cols-3">
                <Label variant="muted">ID</Label>
                <div className="col-span-2 *:w-full">
                  <Input
                    type="text"
                    value={customId}
                    onChange={(e) => handleIdChange(e.target.value)}
                    placeholder="Identifier"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3">
                <Label variant="muted">Element</Label>
                <div className="col-span-2 *:w-full">
                  <ToggleGroup
                    options={[
                      { label: 'Shown', value: false },
                      { label: 'Hidden', value: true },
                    ]}
                    value={isHidden}
                    onChange={(value) => handleVisibilityChange(value as boolean)}
                  />
                </div>
              </div>

              {/* Heading Tag Selector - Only for headings */}
              {isHeadingLayer(selectedLayer) && (
                <div className="grid grid-cols-3">
                  <Label variant="muted">Tag</Label>
                  <div className="col-span-2 *:w-full">
                    <Select value={headingTag} onValueChange={handleHeadingTagChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="h1">H1</SelectItem>
                          <SelectItem value="h2">H2</SelectItem>
                          <SelectItem value="h3">H3</SelectItem>
                          <SelectItem value="h4">H4</SelectItem>
                          <SelectItem value="h5">H5</SelectItem>
                          <SelectItem value="h6">H6</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Container Tag Selector - Only for containers/sections/blocks */}
              {isContainerLayer(selectedLayer) && !isHeadingLayer(selectedLayer) && (
                <div className="grid grid-cols-3">
                  <Label variant="muted">Tag</Label>
                  <div className="col-span-2 *:w-full">
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
                </div>
              )}
            </SettingsPanel>

            {/* Content Panel - show for text-editable layers */}
            {selectedLayer && isTextEditable(selectedLayer) && (
              <SettingsPanel
                title="Content"
                isOpen={contentOpen}
                onToggle={() => setContentOpen(!contentOpen)}
              >
                <div className="flex flex-col gap-2">
                  <InputWithInlineVariables
                    value={getContentValue(selectedLayer)}
                    onChange={handleContentChange}
                    placeholder="Enter text..."
                    fields={parentCollectionFields}
                    fieldSourceLabel={fieldSourceLabel}
                    allFields={fields}
                    collections={collections}
                  />
                </div>
              </SettingsPanel>
            )}

            {/* Locale Label Panel - only show for localeSelector layers */}
            {selectedLayer && selectedLayer.name === 'localeSelector' && (
              <SettingsPanel
                title="Locale selector"
                isOpen={localeLabelOpen}
                onToggle={() => setLocaleLabelOpen(!localeLabelOpen)}
              >
                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-3">
                    <Label variant="muted">Display</Label>
                    <div className="col-span-2 *:w-full">
                      <ToggleGroup
                        options={[
                          { label: 'English', value: 'locale' },
                          { label: 'EN', value: 'code' },
                        ]}
                        value={selectedLayer.settings?.locale?.format || 'locale'}
                        onChange={(value) => {
                          const format = value as 'locale' | 'code';

                          // Update the localeSelector settings
                          onLayerUpdate(selectedLayerId!, {
                            settings: {
                              ...selectedLayer.settings,
                              locale: {
                                format,
                              },
                            },
                          });

                          // Find and update the label child's text
                          const labelChild = selectedLayer.children?.find(
                            child => child.key === 'localeSelectorLabel'
                          );

                          if (labelChild) {
                            onLayerUpdate(labelChild.id, {
                              variables: {
                                ...labelChild.variables,
                                text: {
                                  type: 'dynamic_text',
                                  data: {
                                    content: format === 'code' ? 'EN' : 'English'
                                  }
                                }
                              }
                            });
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              </SettingsPanel>
            )}

            {/* Collection Binding Panel - only show for collection layers */}
            {selectedLayer && getCollectionVariable(selectedLayer) && (
              <SettingsPanel
                title="CMS"
                isOpen={collectionBindingOpen}
                onToggle={() => setCollectionBindingOpen(!collectionBindingOpen)}
              >
                <div className="flex flex-col gap-2">
                  {/* Source Selector */}
                  <div className="grid grid-cols-3">
                    <Label variant="muted">Source</Label>
                    <div className="col-span-2 *:w-full">
                      {/* When inside a parent collection, show reference fields as source options */}
                      {parentCollectionLayer ? (
                        <Select
                          value={getCollectionVariable(selectedLayer)?.source_field_id || ''}
                          onValueChange={handleReferenceFieldChange}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select source" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {parentReferenceFields.length > 0 ? (
                                parentReferenceFields.map((field) => (
                                  <SelectItem key={field.id} value={field.id}>
                                    {field.name}
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value="__none__" disabled>
                                  None
                                </SelectItem>
                              )}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      ) : currentPage?.is_dynamic ? (
                        /* On dynamic pages, show CMS page data fields + all collections */
                        <Select
                          value={getDynamicPageSourceValue}
                          onValueChange={handleDynamicPageSourceChange}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select source" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem value="none">None</SelectItem>
                            </SelectGroup>
                            {dynamicPageReferenceFields.length > 0 && (
                              <SelectGroup>
                                <SelectLabel>CMS page data</SelectLabel>
                                {dynamicPageReferenceFields.map((field) => (
                                  <SelectItem key={field.id} value={`field:${field.id}`}>
                                    {field.name}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            )}
                            <SelectGroup>
                              <SelectLabel>Collections</SelectLabel>
                              {collections.length > 0 ? (
                                collections.map((collection) => (
                                  <SelectItem key={collection.id} value={`collection:${collection.id}`}>
                                    {collection.name}
                                  </SelectItem>
                                ))
                              ) : (
                                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                  No collections available
                                </div>
                              )}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      ) : (
                        /* When not inside a parent collection and not dynamic, show collections as source options */
                        <Select
                          value={getCollectionVariable(selectedLayer)?.id || ''}
                          onValueChange={handleCollectionChange}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a collection" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {collections.length > 0 ? (
                                collections.map((collection) => (
                                  <SelectItem key={collection.id} value={collection.id}>
                                    {collection.name}
                                  </SelectItem>
                                ))
                              ) : (
                                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                  No collections available
                                </div>
                              )}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>

                  {/* Sort By - only show if collection is selected */}
                  {getCollectionVariable(selectedLayer)?.id && (
                    <>
                      <div className="grid grid-cols-3">
                        <Label variant="muted">Sort by</Label>
                        <div className="col-span-2 *:w-full">
                          <Select
                            value={getCollectionVariable(selectedLayer)?.sort_by || 'none'}
                            onValueChange={handleSortByChange}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select sorting" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                <SelectItem value="none">None</SelectItem>
                                <SelectItem value="manual">Manual</SelectItem>
                                <SelectItem value="random">Random</SelectItem>
                              </SelectGroup>
                              <SelectGroup>
                                <SelectLabel>Fields</SelectLabel>
                                {selectedCollectionFields.length > 0 &&
                                  selectedCollectionFields.map((field) => (
                                    <SelectItem key={field.id} value={field.id}>
                                      {field.name}
                                    </SelectItem>
                                  ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Sort Order - only show when a field is selected */}
                      {getCollectionVariable(selectedLayer)?.sort_by &&
                        getCollectionVariable(selectedLayer)?.sort_by !== 'none' &&
                        getCollectionVariable(selectedLayer)?.sort_by !== 'manual' &&
                        getCollectionVariable(selectedLayer)?.sort_by !== 'random' && (
                          <div className="grid grid-cols-3">
                            <Label variant="muted">Sort order</Label>
                            <div className="col-span-2 *:w-full">
                              <Select
                                value={getCollectionVariable(selectedLayer)?.sort_order || 'asc'}
                                onValueChange={handleSortOrderChange}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectGroup>
                                    <SelectItem value="asc">Ascending</SelectItem>
                                    <SelectItem value="desc">Descending</SelectItem>
                                  </SelectGroup>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                      )}

                      {/* Total Limit */}
                      <div className="grid grid-cols-3">
                        <Label variant="muted">Total limit</Label>
                        <div className="col-span-2 *:w-full">
                          <Input
                            type="number"
                            min="1"
                            value={getCollectionVariable(selectedLayer)?.limit || ''}
                            onChange={(e) => handleLimitChange(e.target.value)}
                            placeholder="No limit"
                          />
                        </div>
                      </div>

                      {/* Offset */}
                      <div className="grid grid-cols-3">
                        <Label variant="muted">Offset</Label>
                        <div className="col-span-2 *:w-full">
                          <Input
                            type="number"
                            min="0"
                            value={getCollectionVariable(selectedLayer)?.offset || ''}
                            onChange={(e) => handleOffsetChange(e.target.value)}
                            placeholder="0"
                          />
                        </div>
                      </div>

                      {/* Pagination - hidden for nested collections */}
                      {!isNestedInCollection && (
                        <div className="grid grid-cols-3">
                          <Label variant="muted">Pagination</Label>
                          <div className="col-span-2 *:w-full">
                            <ToggleGroup
                              options={[
                                { label: 'Off', value: false },
                                { label: 'On', value: true },
                              ]}
                              value={getCollectionVariable(selectedLayer)?.pagination?.enabled ?? false}
                              onChange={(value) => handlePaginationEnabledChange(value as boolean)}
                              disabled={isPaginationDisabled}
                            />
                            {paginationDisabledReason && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {paginationDisabledReason}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Pagination type and items per page - only show when pagination enabled */}
                      {!isNestedInCollection && getCollectionVariable(selectedLayer)?.pagination?.enabled && (
                        <>
                          <div className="grid grid-cols-3">
                            <Label variant="muted">Type</Label>
                            <div className="col-span-2 *:w-full">
                              <Select
                                value={getCollectionVariable(selectedLayer)?.pagination?.mode ?? 'pages'}
                                onValueChange={(value) => handlePaginationModeChange(value as 'pages' | 'load_more')}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectGroup>
                                    <SelectItem value="pages">Pages (Previous / Next)</SelectItem>
                                    <SelectItem value="load_more">Load More</SelectItem>
                                  </SelectGroup>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="grid grid-cols-3">
                            <Label variant="muted">Per page</Label>
                            <div className="col-span-2 *:w-full">
                              <Input
                                type="number"
                                min={1}
                                max={100}
                                value={getCollectionVariable(selectedLayer)?.pagination?.items_per_page ?? 10}
                                onChange={(e) => handleItemsPerPageChange(e.target.value)}
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              </SettingsPanel>
            )}

            {/* Custom Attributes Panel */}
            <SettingsPanel
              title="Custom attributes"
              isOpen={customAttributesOpen}
              onToggle={() => setCustomAttributesOpen(!customAttributesOpen)}
              action={
                <Popover open={showAddAttributePopover} onOpenChange={setShowAddAttributePopover}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="secondary"
                      size="xs"
                    >
                      <Icon name="plus" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64" align="end">
                    <div className="flex flex-col gap-2">
                      <div className="grid grid-cols-3">
                          <Label variant="muted">Name</Label>
                          <div className="col-span-2 *:w-full">
                            <Input
                              value={newAttributeName}
                              onChange={(e) => setNewAttributeName(e.target.value)}
                              placeholder="e.g., data-id"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleAddAttribute();
                                }
                              }}
                            />
                          </div>
                      </div>

                      <div className="grid grid-cols-3">
                        <Label>Value</Label>
                          <div className="col-span-2 *:w-full">
                            <Input
                              value={newAttributeValue}
                              onChange={(e) => setNewAttributeValue(e.target.value)}
                              placeholder="e.g., 123"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleAddAttribute();
                                }
                              }}
                            />
                          </div>
                      </div>

                      <Button
                        onClick={handleAddAttribute}
                        disabled={!newAttributeName.trim()}
                        size="sm"
                        variant="secondary"
                      >
                        Add attribute
                      </Button>

                    </div>
                  </PopoverContent>
                </Popover>
              }
            >
              {selectedLayer?.settings?.customAttributes &&
               Object.keys(selectedLayer.settings.customAttributes).length > 0 ? (
                <div className="flex flex-col gap-1">
                  {Object.entries(selectedLayer.settings.customAttributes).map(([name, value]) => (
                    <div
                      key={name}
                      className="flex items-center justify-between pl-3 pr-1 h-8 bg-muted text-muted-foreground rounded-lg"
                    >
                      <span>{name}=&quot;{value as string}&quot;</span>
                      <Button
                        onClick={() => handleRemoveAttribute(name)}
                        variant="ghost"
                        size="xs"
                      >
                        <Icon name="x" />
                      </Button>
                    </div>
                  ))}
                </div>
                ) : (
                <Empty>
                  <EmptyDescription>HTML attributes can be used to append additional information to your elements.</EmptyDescription>
                </Empty>
                )}
            </SettingsPanel>

            <ImageSettings
              layer={selectedLayer}
              onLayerUpdate={onLayerUpdate}
              fields={parentCollectionFields}
              fieldSourceLabel={fieldSourceLabel}
              allFields={fields}
              collections={collections}
            />

            {/* Collection Filters - only for collection layers */}
            {selectedLayer && getCollectionVariable(selectedLayer)?.id && (
              <CollectionFiltersSettings
                layer={selectedLayer}
                onLayerUpdate={onLayerUpdate}
                collectionId={getCollectionVariable(selectedLayer)!.id}
              />
            )}

            <ConditionalVisibilitySettings
              layer={selectedLayer}
              onLayerUpdate={onLayerUpdate}
              fields={parentCollectionFields}
              fieldSourceLabel={fieldSourceLabel}
            />

          </div>
        </TabsContent>

        <TabsContent value="interactions" className="flex-1 overflow-y-auto no-scrollbar mt-0 data-[state=inactive]:hidden">
          {interactionOwnerLayer ? (
            <InteractionsPanel
              triggerLayer={interactionOwnerLayer}
              allLayers={allLayers}
              onLayerUpdate={onLayerUpdate}
              selectedLayerId={selectedLayerId}
              resetKey={interactionResetKey}
              activeBreakpoint={activeBreakpoint}
              onStateChange={handleInteractionStateChange}
              onSelectLayer={setSelectedLayerId}
            />
          ) : (
            <Empty>
              <EmptyTitle>No Layer Selected</EmptyTitle>
              <EmptyDescription>
                Select a layer to edit its interactions
              </EmptyDescription>
            </Empty>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
});

export default RightSidebar;
