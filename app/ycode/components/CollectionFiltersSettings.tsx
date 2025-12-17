'use client';

/**
 * Collection Filters Settings Component
 *
 * Settings panel for filtering collection items based on field values.
 * Unlike conditional visibility (which hides rendered layers), filters
 * reduce the dataset before items are rendered - filtering at the data level.
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import debounce from 'lodash.debounce';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SettingsPanel from './SettingsPanel';
import type { 
  Layer, 
  CollectionField, 
  CollectionFieldType,
  VisibilityCondition, 
  VisibilityConditionGroup,
  ConditionalVisibility,
  VisibilityOperator,
  CollectionVariable
} from '@/types';
import { Button } from '@/components/ui/button';
import Icon, { IconProps } from '@/components/ui/icon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import { collectionsApi } from '@/lib/api';
import { getCollectionVariable } from '@/lib/layer-utils';
import type { CollectionItemWithValues } from '@/types';

interface CollectionFiltersSettingsProps {
  layer: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
  collectionId: string;
}

// Operator definitions by field type
const TEXT_OPERATORS: { value: VisibilityOperator; label: string }[] = [
  { value: 'is', label: 'is' },
  { value: 'is_not', label: 'is not' },
  { value: 'contains', label: 'contains' },
  { value: 'does_not_contain', label: 'does not contain' },
  { value: 'is_present', label: 'is present' },
  { value: 'is_empty', label: 'is empty' },
];

const NUMBER_OPERATORS: { value: VisibilityOperator; label: string }[] = [
  { value: 'is', label: 'is' },
  { value: 'is_not', label: 'is not' },
  { value: 'lt', label: 'is less than' },
  { value: 'lte', label: 'is less than or equal to' },
  { value: 'gt', label: 'is more than' },
  { value: 'gte', label: 'is more than or equal to' },
];

const DATE_OPERATORS: { value: VisibilityOperator; label: string }[] = [
  { value: 'is', label: 'is' },
  { value: 'is_before', label: 'is before' },
  { value: 'is_after', label: 'is after' },
  { value: 'is_between', label: 'is between' },
  { value: 'is_empty', label: 'is empty' },
  { value: 'is_not_empty', label: 'is not empty' },
];

const BOOLEAN_OPERATORS: { value: VisibilityOperator; label: string }[] = [
  { value: 'is', label: 'is' },
];

const REFERENCE_OPERATORS: { value: VisibilityOperator; label: string }[] = [
  { value: 'is_one_of', label: 'is one of' },
  { value: 'is_not_one_of', label: 'is not one of' },
  { value: 'exists', label: 'exists' },
  { value: 'does_not_exist', label: 'does not exist' },
];

const MULTI_REFERENCE_OPERATORS: { value: VisibilityOperator; label: string }[] = [
  { value: 'is_one_of', label: 'is one of' },
  { value: 'is_not_one_of', label: 'is not one of' },
  { value: 'contains_all_of', label: 'contains all of' },
  { value: 'contains_exactly', label: 'contains exactly' },
  { value: 'item_count', label: 'item count' },
  { value: 'has_items', label: 'has items' },
  { value: 'has_no_items', label: 'has no items' },
];

const COMPARE_OPERATORS: { value: string; label: string }[] = [
  { value: 'eq', label: 'equals' },
  { value: 'lt', label: 'less than' },
  { value: 'lte', label: 'less than or equal' },
  { value: 'gt', label: 'greater than' },
  { value: 'gte', label: 'greater than or equal' },
];

/**
 * Get operators available for a given field type
 */
function getOperatorsForFieldType(fieldType: CollectionFieldType | undefined): { value: VisibilityOperator; label: string }[] {
  switch (fieldType) {
    case 'number':
      return NUMBER_OPERATORS;
    case 'date':
      return DATE_OPERATORS;
    case 'boolean':
      return BOOLEAN_OPERATORS;
    case 'reference':
    case 'image':
      return REFERENCE_OPERATORS;
    case 'multi_reference':
      return MULTI_REFERENCE_OPERATORS;
    case 'text':
    case 'rich_text':
    default:
      return TEXT_OPERATORS;
  }
}

/**
 * Get icon for field type
 */
function getFieldIcon(fieldType: CollectionFieldType | undefined): IconProps['name'] {
  switch (fieldType) {
    case 'number': return 'hash';
    case 'date': return 'calendar';
    case 'boolean': return 'check';
    case 'reference': return 'database';
    case 'multi_reference': return 'database';
    case 'image': return 'image';
    case 'rich_text': return 'textAlignLeft';
    case 'text':
    default:
      return 'text';
  }
}

/**
 * Check if operator requires a value input
 */
function operatorRequiresValue(operator: VisibilityOperator): boolean {
  return !['is_present', 'is_empty', 'is_not_empty', 'has_items', 'has_no_items', 'exists', 'does_not_exist'].includes(operator);
}

/**
 * Check if operator requires collection item selection
 */
function operatorRequiresItemSelection(operator: VisibilityOperator): boolean {
  return ['is_one_of', 'is_not_one_of', 'contains_all_of', 'contains_exactly'].includes(operator);
}

/**
 * Check if operator requires a second value (for date ranges)
 */
function operatorRequiresSecondValue(operator: VisibilityOperator): boolean {
  return operator === 'is_between';
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
  const collectionFields = fields[collectionId] || [];

  // Find the title/name field for display
  const displayField = useMemo(() => {
    const titleField = collectionFields.find(f => f.key === 'title');
    if (titleField) return titleField;
    const nameField = collectionFields.find(f => f.key === 'name');
    if (nameField) return nameField;
    const textField = collectionFields.find(f => f.type === 'text' && f.fillable);
    if (textField) return textField;
    return collectionFields[0] || null;
  }, [collectionFields]);

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
  const getItemDisplayName = useCallback((item: CollectionItemWithValues) => {
    if (!displayField) return 'Untitled';
    return item.values[displayField.id] || 'Untitled';
  }, [displayField]);

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
        return item ? getItemDisplayName(item) : null;
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
      <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[200px] max-h-60 overflow-y-auto" align="start">
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
                {getItemDisplayName(item)}
              </DropdownMenuCheckboxItem>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function CollectionFiltersSettings({
  layer,
  onLayerUpdate,
  collectionId,
}: CollectionFiltersSettingsProps) {
  const [isOpen, setIsOpen] = useState(true);
  
  // Get fields from the collections store
  const { fields: allFields, loadFields } = useCollectionsStore();
  const fields = allFields[collectionId] || [];

  // Load fields if not already loaded
  useEffect(() => {
    if (collectionId && fields.length === 0) {
      loadFields(collectionId);
    }
  }, [collectionId, fields.length, loadFields]);

  // Get current collection variable
  const collectionVariable = layer ? getCollectionVariable(layer) : null;

  // Initialize groups from layer data (filters are stored in collection.filters)
  const groups: VisibilityConditionGroup[] = useMemo(() => {
    return collectionVariable?.filters?.groups || [];
  }, [collectionVariable?.filters]);

  // Helper to update layer with new filter groups (immediate - for dropdown selections)
  const updateGroups = useCallback((newGroups: VisibilityConditionGroup[]) => {
    if (!layer || !collectionVariable) return;
    
    const filters: ConditionalVisibility = {
      groups: newGroups,
    };
    
    onLayerUpdate(layer.id, {
      variables: {
        ...layer.variables,
        collection: {
          ...collectionVariable,
          filters: newGroups.length > 0 ? filters : undefined,
        },
      },
    });
  }, [layer, collectionVariable, onLayerUpdate]);

  // Store the latest updateGroups in a ref to avoid stale closures in debounced function
  const updateGroupsRef = useRef(updateGroups);
  updateGroupsRef.current = updateGroups;

  // Track the current layer ID to detect layer changes
  const currentLayerIdRef = useRef(layer?.id);

  // Create a stable debounced function for text inputs
  const debouncedUpdateGroupsRef = useRef(
    debounce((newGroups: VisibilityConditionGroup[]) => {
      updateGroupsRef.current(newGroups);
    }, 150)
  );

  // Cancel pending debounced calls when layer changes to prevent stale updates
  useEffect(() => {
    if (currentLayerIdRef.current !== layer?.id) {
      debouncedUpdateGroupsRef.current.cancel();
      currentLayerIdRef.current = layer?.id;
    }
  }, [layer?.id]);

  // Cleanup on unmount
  useEffect(() => {
    const debouncedFn = debouncedUpdateGroupsRef.current;
    return () => {
      debouncedFn.cancel();
    };
  }, []);

  // Debounced update for text/number inputs
  const debouncedUpdateGroups = useCallback((newGroups: VisibilityConditionGroup[]) => {
    debouncedUpdateGroupsRef.current(newGroups);
  }, []);

  if (!layer || !collectionVariable) {
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

  // Handle value change (debounced for text inputs)
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
    debouncedUpdateGroups(newGroups);
  };

  // Handle second value change (for date between - debounced)
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
    debouncedUpdateGroups(newGroups);
  };

  // Handle compare operator change (for item count)
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

  // Handle compare value change (for item count - debounced)
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
    debouncedUpdateGroups(newGroups);
  };

  // Get field name by ID
  const getFieldName = (fieldId: string): string => {
    const field = fields?.find(f => f.id === fieldId);
    return field?.name || 'Unknown field';
  };

  // Get field type by ID
  const getFieldType = (fieldId: string): CollectionFieldType | undefined => {
    const field = fields?.find(f => f.id === fieldId);
    return field?.type;
  };

  // Render the dropdown content for adding conditions
  const renderAddConditionDropdown = (
    onFieldSelect: (field: CollectionField) => void
  ) => (
    <DropdownMenuContent align="end" className="!max-h-[300px] overflow-y-auto">
      {/* Collection Fields Section */}
      {fields && fields.length > 0 && (
        <>
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Collection Fields
          </DropdownMenuLabel>
          {fields.map((field) => (
            <DropdownMenuItem
              key={field.id}
              onClick={() => onFieldSelect(field)}
              className="flex items-center gap-2"
            >
              <Icon name={getFieldIcon(field.type)} className="size-3 opacity-60" />
              {field.name}
            </DropdownMenuItem>
          ))}
        </>
      )}
      
      {/* Empty State */}
      {(!fields || fields.length === 0) && (
        <div className="px-2 py-4 text-xs text-muted-foreground text-center">
          No fields available
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
      const field = fields?.find(f => f.id === condition.fieldId);
      return field?.reference_collection_id || undefined;
    }
    return undefined;
  };

  // Render a single condition
  const renderCondition = (condition: VisibilityCondition, group: VisibilityConditionGroup, index: number) => {
    const fieldType = condition.fieldType || getFieldType(condition.fieldId || '');
    const operators = getOperatorsForFieldType(fieldType);
    const icon = getFieldIcon(fieldType);
    const displayName = getFieldName(condition.fieldId || '');
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
            <div className="size-5 flex items-center justify-center rounded-[6px] bg-secondary/50 hover:bg-secondary/100">
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
      title="Filters"
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
      action={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="xs">
              <Icon name="plus" />
            </Button>
          </DropdownMenuTrigger>
          {renderAddConditionDropdown(handleAddFieldConditionGroup)}
        </DropdownMenu>
      }
    >
      <div className="flex flex-col gap-2">
        {groups.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-4">
            No filters set. Click + to add a filter.
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
                            <Icon name="plus" className="!size-2.5" />
                          </div>
                        </Button>
                      </DropdownMenuTrigger>
                      {renderAddConditionDropdown(
                        (field) => handleAddConditionFromOr(group.id, field)
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
