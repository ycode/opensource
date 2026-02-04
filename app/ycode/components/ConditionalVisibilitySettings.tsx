'use client';

/**
 * Conditional Visibility Settings Component
 *
 * Settings panel for conditional visibility based on field values and page collections.
 * - Collection fields: Show operators based on field type (text, number, date, etc.)
 * - Page collections: Show operators for item count, has items, has no items
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import SettingsPanel from './SettingsPanel';
import type {
  Layer,
  CollectionField,
  CollectionFieldType,
  VisibilityCondition,
  VisibilityConditionGroup,
  ConditionalVisibility,
  VisibilityOperator
} from '@/types';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { Spinner } from '@/components/ui/spinner';
import {
  getFieldIcon,
  getOperatorsForFieldType,
  operatorRequiresValue,
  operatorRequiresItemSelection,
  operatorRequiresSecondValue,
  findDisplayField,
  getItemDisplayName,
  flattenFieldGroups,
  COMPARE_OPERATORS,
  PAGE_COLLECTION_OPERATORS,
} from '@/lib/collection-field-utils';
import { findAllCollectionLayers, CollectionLayerInfo } from '@/lib/layer-utils';
import { usePagesStore } from '@/stores/usePagesStore';
import { useEditorStore } from '@/stores/useEditorStore';
import { useComponentsStore } from '@/stores/useComponentsStore';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import { collectionsApi } from '@/lib/api';
import type { CollectionItemWithValues } from '@/types';

interface ConditionalVisibilitySettingsProps {
  layer: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
  /** Field groups with labels and sources for conditional visibility */
  fieldGroups?: { fields: CollectionField[]; label?: string; source?: 'page' | 'collection' }[];
}

/**
 * Reference Items Selector Component
 * Multi-select dropdown for selecting collection items for is_one_of/is_not_one_of operators
 */
function ReferenceItemsSelector({
  collectionId,
  value,
  onChange,
}: {
  collectionId: string;
  value: string; // JSON array of item IDs
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<CollectionItemWithValues[]>([]);
  const [loading, setLoading] = useState(false);

  // Get the collection info and fields from the store
  const { collections, fields } = useCollectionsStore();
  const collection = collections.find(c => c.id === collectionId);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- collectionFields derived from store, useMemo deps intentional
  const collectionFields = fields[collectionId] || [];

  // Find the title/name field for display
  const displayField = useMemo(() => findDisplayField(collectionFields), [collectionFields]);

  // Parse selected IDs from JSON value
  const selectedIds = useMemo(() => {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [value]);

  // Get display name for an item
  const getDisplayName = useCallback(
    (item: CollectionItemWithValues) => getItemDisplayName(item, displayField),
    [displayField]
  );

  // Fetch items when dropdown opens
  useEffect(() => {
    if (open && collectionId) {
      const fetchItems = async () => {
        setLoading(true);
        try {
          const response = await collectionsApi.getItems(collectionId, { limit: 100 });
          if (!response.error) {
            setItems(response.data?.items || []);
          }
        } catch (err) {
          console.error('Failed to load items:', err);
        } finally {
          setLoading(false);
        }
      };
      fetchItems();
    }
  }, [open, collectionId]);

  // Toggle item selection
  const handleToggle = (itemId: string) => {
    const newSelectedIds = selectedIds.includes(itemId)
      ? selectedIds.filter(id => id !== itemId)
      : [...selectedIds, itemId];
    onChange(JSON.stringify(newSelectedIds));
  };

  // Get display text for closed state
  const getDisplayText = () => {
    if (selectedIds.length === 0) return 'Select items...';

    // Find display names for selected items
    const selectedNames = selectedIds
      .map(id => {
        const item = items.find(i => i.id === id);
        return item ? getDisplayName(item) : null;
      })
      .filter(Boolean);

    if (selectedNames.length > 0) {
      return selectedNames.length <= 2
        ? selectedNames.join(', ')
        : `${selectedNames.length} items selected`;
    }

    return `${selectedIds.length} item${selectedIds.length !== 1 ? 's' : ''} selected`;
  };

  if (!collectionId) {
    return <div className="text-xs text-muted-foreground">No collection linked</div>;
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="input"
          size="sm"
          className="w-full justify-between font-normal"
        >
          <span className="truncate text-xs">{getDisplayText()}</span>
          <Icon name="chevronCombo" className="size-2.5 opacity-50 ml-2" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) min-w-50 max-h-60 overflow-y-auto" align="start">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Spinner />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-4 text-xs text-muted-foreground">
            No items in this collection
          </div>
        ) : (
          items.map((item) => {
            const isSelected = selectedIds.includes(item.id);
            return (
              <DropdownMenuCheckboxItem
                key={item.id}
                checked={isSelected}
                onCheckedChange={() => handleToggle(item.id)}
                onSelect={(e) => e.preventDefault()}
              >
                {getDisplayName(item)}
              </DropdownMenuCheckboxItem>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function ConditionalVisibilitySettings({
  layer,
  onLayerUpdate,
  fieldGroups,
}: ConditionalVisibilitySettingsProps) {
  const [isOpen, setIsOpen] = useState(true);

  // Derive flat list of fields from fieldGroups
  const allFieldsFromGroups = useMemo(() => flattenFieldGroups(fieldGroups), [fieldGroups]);

  // Get current page layers for page collections
  const draftsByPageId = usePagesStore((state) => state.draftsByPageId);
  const currentPageId = useEditorStore((state) => state.currentPageId);
  const editingComponentId = useEditorStore((state) => state.editingComponentId);
  const componentDrafts = useComponentsStore((state) => state.componentDrafts);

  // Get all collection layers on the page
  const pageCollectionLayers = useMemo((): CollectionLayerInfo[] => {
    if (!currentPageId) return [];

    let layers: Layer[] = [];
    if (editingComponentId) {
      layers = componentDrafts[editingComponentId] || [];
    } else {
      const draft = draftsByPageId[currentPageId];
      layers = draft ? draft.layers : [];
    }

    return findAllCollectionLayers(layers);
  }, [currentPageId, editingComponentId, componentDrafts, draftsByPageId]);

  // Initialize groups from layer data
  const groups: VisibilityConditionGroup[] = useMemo(() => {
    return layer?.variables?.conditionalVisibility?.groups || [];
  }, [layer?.variables?.conditionalVisibility]);

  // Helper to update layer with new groups
  const updateGroups = useCallback((newGroups: VisibilityConditionGroup[]) => {
    if (!layer) return;

    const conditionalVisibility: ConditionalVisibility = {
      groups: newGroups,
    };

    onLayerUpdate(layer.id, {
      variables: {
        ...layer.variables,
        conditionalVisibility: newGroups.length > 0 ? conditionalVisibility : undefined,
      },
    });
  }, [layer, onLayerUpdate]);

  if (!layer) {
    return null;
  }

  // Handle adding a new condition group for a collection field
  const handleAddFieldConditionGroup = (field: CollectionField) => {
    const newCondition: VisibilityCondition = {
      id: `${Date.now()}-1`,
      source: 'collection_field',
      fieldId: field.id,
      fieldType: field.type,
      referenceCollectionId: field.reference_collection_id || undefined,
      operator: getOperatorsForFieldType(field.type)[0].value,
      value: (field.type === 'reference' || field.type === 'multi_reference') ? '[]' : '',
    };

    const newGroup: VisibilityConditionGroup = {
      id: Date.now().toString(),
      conditions: [newCondition],
    };

    updateGroups([...groups, newGroup]);
  };

  // Handle adding a new condition group for a page collection
  const handleAddPageCollectionConditionGroup = (collectionLayer: CollectionLayerInfo) => {
    const newCondition: VisibilityCondition = {
      id: `${Date.now()}-1`,
      source: 'page_collection',
      collectionLayerId: collectionLayer.layerId,
      collectionLayerName: collectionLayer.layerName,
      operator: 'has_items',
    };

    const newGroup: VisibilityConditionGroup = {
      id: Date.now().toString(),
      conditions: [newCondition],
    };

    updateGroups([...groups, newGroup]);
  };

  // Handle removing a condition group
  const handleRemoveConditionGroup = (groupId: string) => {
    updateGroups(groups.filter(g => g.id !== groupId));
  };

  // Handle adding a condition to an existing group (OR logic)
  const handleAddConditionFromOr = (groupId: string, field: CollectionField) => {
    const newGroups = groups.map(group => {
      if (group.id === groupId) {
        const newCondition: VisibilityCondition = {
          id: `${groupId}-${Date.now()}`,
          source: 'collection_field',
          fieldId: field.id,
          fieldType: field.type,
          referenceCollectionId: field.reference_collection_id || undefined,
          operator: getOperatorsForFieldType(field.type)[0].value,
          value: (field.type === 'reference' || field.type === 'multi_reference') ? '[]' : '',
        };
        return {
          ...group,
          conditions: [...group.conditions, newCondition],
        };
      }
      return group;
    });
    updateGroups(newGroups);
  };

  // Handle adding a page collection condition to a group
  const handleAddPageCollectionConditionFromOr = (groupId: string, collectionLayer: CollectionLayerInfo) => {
    const newGroups = groups.map(group => {
      if (group.id === groupId) {
        const newCondition: VisibilityCondition = {
          id: `${groupId}-${Date.now()}`,
          source: 'page_collection',
          collectionLayerId: collectionLayer.layerId,
          collectionLayerName: collectionLayer.layerName,
          operator: 'has_items',
        };
        return {
          ...group,
          conditions: [...group.conditions, newCondition],
        };
      }
      return group;
    });
    updateGroups(newGroups);
  };

  // Handle removing a condition
  const handleRemoveCondition = (groupId: string, conditionId: string) => {
    const newGroups = groups.map(group => {
      if (group.id === groupId) {
        const newConditions = group.conditions.filter(c => c.id !== conditionId);
        if (newConditions.length === 0) {
          return null;
        }
        return {
          ...group,
          conditions: newConditions,
        };
      }
      return group;
    }).filter((group): group is VisibilityConditionGroup => group !== null);
    updateGroups(newGroups);
  };

  // Handle operator change
  const handleOperatorChange = (groupId: string, conditionId: string, operator: VisibilityOperator) => {
    const newGroups = groups.map(group => {
      if (group.id === groupId) {
        return {
          ...group,
          conditions: group.conditions.map(c => {
            if (c.id === conditionId) {
              return {
                ...c,
                operator,
                value: operatorRequiresValue(operator) ? c.value : undefined,
                value2: operatorRequiresSecondValue(operator) ? c.value2 : undefined,
              };
            }
            return c;
          }),
        };
      }
      return group;
    });
    updateGroups(newGroups);
  };

  // Handle value change
  const handleValueChange = (groupId: string, conditionId: string, value: string) => {
    const newGroups = groups.map(group => {
      if (group.id === groupId) {
        return {
          ...group,
          conditions: group.conditions.map(c => {
            if (c.id === conditionId) {
              return { ...c, value };
            }
            return c;
          }),
        };
      }
      return group;
    });
    updateGroups(newGroups);
  };

  // Handle second value change (for date between)
  const handleValue2Change = (groupId: string, conditionId: string, value2: string) => {
    const newGroups = groups.map(group => {
      if (group.id === groupId) {
        return {
          ...group,
          conditions: group.conditions.map(c => {
            if (c.id === conditionId) {
              return { ...c, value2 };
            }
            return c;
          }),
        };
      }
      return group;
    });
    updateGroups(newGroups);
  };

  // Handle compare operator change (for page collection item count)
  const handleCompareOperatorChange = (groupId: string, conditionId: string, compareOperator: 'eq' | 'lt' | 'lte' | 'gt' | 'gte') => {
    const newGroups = groups.map(group => {
      if (group.id === groupId) {
        return {
          ...group,
          conditions: group.conditions.map(c => {
            if (c.id === conditionId) {
              return { ...c, compareOperator };
            }
            return c;
          }),
        };
      }
      return group;
    });
    updateGroups(newGroups);
  };

  // Handle compare value change (for page collection item count)
  const handleCompareValueChange = (groupId: string, conditionId: string, compareValue: number) => {
    const newGroups = groups.map(group => {
      if (group.id === groupId) {
        return {
          ...group,
          conditions: group.conditions.map(c => {
            if (c.id === conditionId) {
              return { ...c, compareValue };
            }
            return c;
          }),
        };
      }
      return group;
    });
    updateGroups(newGroups);
  };

  // Get field name by ID
  const getFieldName = (fieldId: string): string => {
    const field = allFieldsFromGroups.find(f => f.id === fieldId);
    return field?.name || 'Unknown field';
  };

  // Get field type by ID
  const getFieldType = (fieldId: string): CollectionFieldType | undefined => {
    const field = allFieldsFromGroups.find(f => f.id === fieldId);
    return field?.type;
  };

  // Render the dropdown content for adding conditions
  const renderAddConditionDropdown = (
    onFieldSelect: (field: CollectionField) => void,
    onPageCollectionSelect: (layer: CollectionLayerInfo) => void
  ) => (
    <DropdownMenuContent align="end" className="max-h-75! overflow-y-auto">
      {/* Collection Fields Section - render each group */}
      {fieldGroups?.map((group, groupIndex) => group.fields.length > 0 && (
        <React.Fragment key={groupIndex}>
          {groupIndex > 0 && <DropdownMenuSeparator />}
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            {group.label || 'Collection Fields'}
          </DropdownMenuLabel>
          {group.fields.map((field) => (
            <DropdownMenuItem
              key={field.id}
              onClick={() => onFieldSelect(field)}
              className="flex items-center gap-2"
            >
              <Icon name={getFieldIcon(field.type)} className="size-3 opacity-60" />
              {field.name}
            </DropdownMenuItem>
          ))}
        </React.Fragment>
      ))}

      {/* Page Collections Section */}
      {pageCollectionLayers.length > 0 && (
        <>
          {allFieldsFromGroups.length > 0 && <DropdownMenuSeparator />}
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Page Collections
          </DropdownMenuLabel>
          {pageCollectionLayers.map((collectionLayer) => (
            <DropdownMenuItem
              key={collectionLayer.layerId}
              onClick={() => onPageCollectionSelect(collectionLayer)}
              className="flex items-center gap-2"
            >
              <Icon name="database" className="size-3 opacity-60" />
              {collectionLayer.layerName}
            </DropdownMenuItem>
          ))}
        </>
      )}

      {/* Empty State */}
      {allFieldsFromGroups.length === 0 && pageCollectionLayers.length === 0 && (
        <div className="px-2 py-4 text-xs text-muted-foreground text-center">
          No fields or collections available
        </div>
      )}
    </DropdownMenuContent>
  );

  // Get reference collection ID from condition or look it up from field
  const getReferenceCollectionId = (condition: VisibilityCondition): string | undefined => {
    if (condition.referenceCollectionId) {
      return condition.referenceCollectionId;
    }
    // Fallback: look up from field
    if (condition.fieldId) {
      const field = allFieldsFromGroups.find(f => f.id === condition.fieldId);
      return field?.reference_collection_id || undefined;
    }
    return undefined;
  };

  // Render a single condition
  const renderCondition = (condition: VisibilityCondition, group: VisibilityConditionGroup, index: number) => {
    const isPageCollection = condition.source === 'page_collection';
    const fieldType = isPageCollection ? undefined : condition.fieldType || getFieldType(condition.fieldId || '');
    const operators = isPageCollection ? PAGE_COLLECTION_OPERATORS : getOperatorsForFieldType(fieldType);
    const icon = isPageCollection ? 'database' : getFieldIcon(fieldType);
    const displayName = isPageCollection
      ? condition.collectionLayerName || 'Collection'
      : getFieldName(condition.fieldId || '');
    const referenceCollectionId = getReferenceCollectionId(condition);

    return (
      <React.Fragment key={condition.id}>
        {index > 0 && (
          <li className="flex items-center gap-2 h-6">
            <Label variant="muted" className="text-[10px]">Or</Label>
            <hr className="flex-1" />
          </li>
        )}

        <li className="*:w-full flex flex-col gap-2">
          <header className="flex items-center gap-1.5">
            <div className="size-5 flex items-center justify-center rounded-[6px] bg-secondary/50 hover:bg-secondary">
              <Icon name={icon} className="size-2.5 opacity-60" />
            </div>
            <Label variant="muted" className="truncate">{displayName}</Label>

            <div className="ml-auto -my-1 -mr-0.5 shrink-0">
              <Button
                size="xs"
                variant="ghost"
                onClick={() => handleRemoveCondition(group.id, condition.id)}
              >
                <Icon name="x" />
              </Button>
            </div>
          </header>

          {/* Operator Select */}
          <Select
            value={condition.operator}
            onValueChange={(value) => handleOperatorChange(group.id, condition.id, value as VisibilityOperator)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a condition..." />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {operators.map((op) => (
                  <SelectItem key={op.value} value={op.value}>
                    {op.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          {/* Value Input(s) based on operator */}
          {condition.operator === 'item_count' && (
            <div className="flex gap-2">
              <Select
                value={condition.compareOperator || 'eq'}
                onValueChange={(value) => handleCompareOperatorChange(group.id, condition.id, value as any)}
              >
                <SelectTrigger className="w-1/2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {COMPARE_OPERATORS.map((op) => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Input
                type="number"
                placeholder="0"
                value={condition.compareValue ?? ''}
                onChange={(e) => handleCompareValueChange(group.id, condition.id, parseInt(e.target.value) || 0)}
                className="w-1/2"
              />
            </div>
          )}

          {/* Reference/Multi-reference items selector */}
          {operatorRequiresItemSelection(condition.operator) && referenceCollectionId && (
            <ReferenceItemsSelector
              collectionId={referenceCollectionId}
              value={condition.value || '[]'}
              onChange={(value) => handleValueChange(group.id, condition.id, value)}
            />
          )}

          {operatorRequiresValue(condition.operator) && condition.operator !== 'item_count' && !operatorRequiresItemSelection(condition.operator) && (
            <>
              {fieldType === 'boolean' ? (
                <Select
                  value={condition.value || 'true'}
                  onValueChange={(value) => handleValueChange(group.id, condition.id, value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="true">True</SelectItem>
                      <SelectItem value="false">False</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              ) : fieldType === 'date' ? (
                <Input
                  type="date"
                  value={condition.value || ''}
                  onChange={(e) => handleValueChange(group.id, condition.id, e.target.value)}
                />
              ) : fieldType === 'number' ? (
                <Input
                  type="number"
                  placeholder="Enter value..."
                  value={condition.value || ''}
                  onChange={(e) => handleValueChange(group.id, condition.id, e.target.value)}
                />
              ) : (
                <Input
                  placeholder="Enter value..."
                  value={condition.value || ''}
                  onChange={(e) => handleValueChange(group.id, condition.id, e.target.value)}
                />
              )}

              {/* Second value for date between */}
              {operatorRequiresSecondValue(condition.operator) && (
                <>
                  <Label variant="muted" className="text-[10px] text-center">and</Label>
                  <Input
                    type="date"
                    value={condition.value2 || ''}
                    onChange={(e) => handleValue2Change(group.id, condition.id, e.target.value)}
                  />
                </>
              )}
            </>
          )}
        </li>
      </React.Fragment>
    );
  };

  return (
    <SettingsPanel
      title="Conditional visibility"
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
      action={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="xs">
              <Icon name="plus" />
            </Button>
          </DropdownMenuTrigger>
          {renderAddConditionDropdown(
            handleAddFieldConditionGroup,
            handleAddPageCollectionConditionGroup
          )}
        </DropdownMenu>
      }
    >
      <div className="flex flex-col gap-2">
        {groups.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-4">
            No conditions set. Click + to add a condition.
          </div>
        ) : (
          groups.map((group, groupIndex) => (
            <React.Fragment key={group.id}>
              {groupIndex > 0 && (
                <div className="flex items-center gap-2 py-1">
                  <hr className="flex-1" />
                  <Label variant="muted" className="text-[10px]">And</Label>
                  <hr className="flex-1" />
                </div>
              )}
              <div className="flex flex-col bg-muted rounded-lg">
                <ul className="p-2 flex flex-col gap-2">
                  {group.conditions.map((condition, index) =>
                    renderCondition(condition, group, index)
                  )}

                  <li className="flex items-center gap-2 h-6">
                    <Label variant="muted" className="text-[10px]">Or</Label>
                    <hr className="flex-1" />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost" size="xs"
                          className="size-5"
                        >
                          <div>
                            <Icon name="plus" className="size-2.5!" />
                          </div>
                        </Button>
                      </DropdownMenuTrigger>
                      {renderAddConditionDropdown(
                        (field) => handleAddConditionFromOr(group.id, field),
                        (layer) => handleAddPageCollectionConditionFromOr(group.id, layer)
                      )}
                    </DropdownMenu>
                  </li>
                </ul>
              </div>
            </React.Fragment>
          ))
        )}
      </div>
    </SettingsPanel>
  );
}
