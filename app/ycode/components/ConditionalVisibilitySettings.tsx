'use client';

/**
 * Conditional Visibility Settings Component
 *
 * Settings panel for conditional visibility based on field values
 */

import React, { useState } from 'react';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SettingsPanel from './SettingsPanel';
import type { Layer, CollectionField } from '@/types';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ConditionalVisibilitySettingsProps {
  layer: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
  fields?: CollectionField[];
  fieldSourceLabel?: string;
}

interface Condition {
  id: string;
  fieldName: string;
  operator: string;
  value: string;
}

interface ConditionGroup {
  id: string;
  conditions: Condition[];
}

export default function ConditionalVisibilitySettings({
  layer,
  onLayerUpdate,
  fields,
  fieldSourceLabel,
}: ConditionalVisibilitySettingsProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [groups, setGroups] = useState<ConditionGroup[]>([
    {
      id: '1',
      conditions: [
        { id: '1-1', fieldName: 'Homepage', operator: '', value: '' },
        { id: '1-2', fieldName: 'Homepage', operator: '', value: '' },
      ],
    },
  ]);

  if (!layer) {
    return null;
  }

  const availableFieldOptions = ['Homepage', 'Name', 'Slug', ...(fields?.map(f => f.name) || [])];

  const handleAddConditionGroup = (fieldName: string) => {
    const newGroup: ConditionGroup = {
      id: Date.now().toString(),
      conditions: [
        { id: `${Date.now()}-1`, fieldName, operator: '', value: '' },
      ],
    };
    setGroups([...groups, newGroup]);
  };

  const handleRemoveConditionGroup = (groupId: string) => {
    setGroups(groups.filter(g => g.id !== groupId));
  };

  const handleAddConditionFromOr = (groupId: string, fieldName: string) => {
    setGroups(groups.map(group => {
      if (group.id === groupId) {
        return {
          ...group,
          conditions: [
            ...group.conditions,
            { id: `${groupId}-${Date.now()}`, fieldName, operator: '', value: '' },
          ],
        };
      }
      return group;
    }));
  };

  const handleRemoveCondition = (groupId: string, conditionId: string) => {
    setGroups(groups.map(group => {
      if (group.id === groupId) {
        const newConditions = group.conditions.filter(c => c.id !== conditionId);
        // If no conditions left, remove the entire group
        if (newConditions.length === 0) {
          return null;
        }
        return {
          ...group,
          conditions: newConditions,
        };
      }
      return group;
    }).filter(group => group !== null) as ConditionGroup[]);
  };

  const handleOperatorChange = (groupId: string, conditionId: string, operator: string) => {
    setGroups(groups.map(group => {
      if (group.id === groupId) {
        return {
          ...group,
          conditions: group.conditions.map(c => {
            if (c.id === conditionId) {
              return { ...c, operator, value: (operator === 'is present' || operator === 'is empty') ? '' : c.value };
            }
            return c;
          }),
        };
      }
      return group;
    }));
  };

  const handleValueChange = (groupId: string, conditionId: string, value: string) => {
    setGroups(groups.map(group => {
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
    }));
  };

  return (
    <SettingsPanel
      title="Conditional visibility"
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
      action={
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="secondary"
            size="xs"
          >
            <Icon name="plus" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="!max-h-[300px]"
        >
          {availableFieldOptions.map((fieldName) => (
            <DropdownMenuItem
              key={fieldName}
              onClick={() => handleAddConditionGroup(fieldName)}
            >
              {fieldName}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      }
    >

      <div className="flex flex-col gap-2">

        {groups.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-4">
            No condition groups set. Click the + button to add a group.
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.id} className="flex flex-col bg-muted rounded-lg">
              <ul className="p-2 flex flex-col gap-2">
                {group.conditions.map((condition, index) => (
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
                          <Icon name="text" className="size-2.5 opacity-60" />
                        </div>
                        <Label variant="muted">{condition.fieldName}</Label>

                        <div className="ml-auto -my-1 -mr-0.5">
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => handleRemoveCondition(group.id, condition.id)}
                          >
                            <Icon name="x" />
                          </Button>
                        </div>
                      </header>

                      <Select
                        value={condition.operator}
                        onValueChange={(value) => handleOperatorChange(group.id, condition.id, value)}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Select a condition..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="is">is</SelectItem>
                            <SelectItem value="is not">is not</SelectItem>
                            <SelectItem value="contains">contains</SelectItem>
                            <SelectItem value="does not contain">does not contain</SelectItem>
                            <SelectItem value="is present">is present</SelectItem>
                            <SelectItem value="is empty">is empty</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>

                      {(condition.operator === 'is present' || condition.operator === 'is empty') ? (
                        <Input
                          placeholder="Enter value..."
                          disabled
                          className="opacity-50"
                        />
                      ) : (
                        <Input
                          placeholder="Enter value..."
                          value={condition.value}
                          onChange={(e) => handleValueChange(group.id, condition.id, e.target.value)}
                        />
                      )}
                    </li>
                  </React.Fragment>
                ))}

                <li className="flex items-center gap-2 h-6">
                  <Label variant="muted" className="text-[10px]">Or</Label>
                  <hr className="flex-1" />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="xs"
                        className="size-5"
                      >
                        <div>
                          <Icon name="plus" className="!size-2.5" />
                        </div>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="!max-h-[300px]"
                    >
                      {availableFieldOptions.map((fieldName) => (
                        <DropdownMenuItem
                          key={fieldName}
                          onClick={() => handleAddConditionFromOr(group.id, fieldName)}
                        >
                          {fieldName}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              </ul>
            </div>
          ))
        )}

      </div>

    </SettingsPanel>
  );
}
