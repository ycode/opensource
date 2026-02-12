'use client';

/**
 * Select Options Settings Component
 *
 * Settings panel for managing <select> element options.
 * Allows adding, editing, removing, and reordering options with Label and Value fields.
 * Follows the same UI pattern as Custom Attributes.
 */

import React, { useState, useCallback } from 'react';

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger, PopoverAnchor } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import Icon from '@/components/ui/icon';
import { Empty, EmptyDescription } from '@/components/ui/empty';
import SettingsPanel from './SettingsPanel';

import { generateId } from '@/lib/utils';

import type { Layer } from '@/types';

interface SelectOptionsSettingsProps {
  layer: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
}

interface OptionData {
  id: string;
  label: string;
  value: string;
}

/**
 * Extract option data from select layer children
 */
function getOptionsFromLayer(layer: Layer): OptionData[] {
  if (!layer.children || layer.children.length === 0) return [];

  return layer.children
    .filter((child) => child.name === 'option')
    .map((child) => {
      const textVar = child.variables?.text;
      let label = '';

      if (textVar?.type === 'dynamic_text' && textVar.data?.content) {
        label = String(textVar.data.content);
      } else if (textVar?.type === 'dynamic_rich_text' && textVar.data?.content) {
        label = String(textVar.data.content);
      }

      return {
        id: child.id,
        label,
        value: child.attributes?.value || '',
      };
    });
}

/**
 * Build an option layer from label and value
 */
function buildOptionLayer(id: string, label: string, value: string): Layer {
  return {
    id,
    name: 'option',
    classes: '',
    attributes: { value },
    variables: {
      text: {
        type: 'dynamic_text',
        data: {
          content: label,
        },
      },
    },
  };
}

/**
 * Dropdown menu + edit popover for a single option row.
 * DropdownMenu for quick actions, Popover for the edit form.
 * Uses PopoverAnchor (not PopoverTrigger) to avoid Radix focus/click conflicts
 * when the dropdown closes and restores focus to the trigger area.
 */
function OptionActions({
  option,
  onEdit,
  onRemove,
}: {
  option: OptionData;
  onEdit: (id: string, label: string, value: string) => void;
  onRemove: (id: string) => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [editLabel, setEditLabel] = useState('');
  const [editValue, setEditValue] = useState('');

  const handleStartEdit = () => {
    setEditLabel(option.label);
    setEditValue(option.value);
    // Delay opening the popover until the dropdown has fully closed
    setTimeout(() => setEditOpen(true), 150);
  };

  const handleSave = () => {
    if (!editLabel.trim()) return;
    onEdit(option.id, editLabel.trim(), editValue);
    setEditOpen(false);
  };

  return (
    <>
      <Popover
        open={editOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEditOpen(false);
            setEditLabel('');
            setEditValue('');
          }
        }}
      >
        <PopoverAnchor asChild>
          <div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="xs"
                >
                  <Icon name="more" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={handleStartEdit}>
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onRemove(option.id)}>
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </PopoverAnchor>
        <PopoverContent
          className="w-64"
          align="end"
          onFocusOutside={(e) => {
            // Prevent Radix from closing the popover when focus is outside
            // (e.g., focus still on the ... button when popover first opens).
            // Clicking outside still closes via onPointerDownOutside.
            e.preventDefault();
          }}
        >
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-3">
              <Label variant="muted">Label</Label>
              <div className="col-span-2 *:w-full">
                <Input
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  placeholder="Option label"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSave();
                    }
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-3">
              <Label>Value</Label>
              <div className="col-span-2 *:w-full">
                <Input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  placeholder="Option value"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSave();
                    }
                  }}
                />
              </div>
            </div>

            <Button
              onClick={handleSave}
              disabled={!editLabel.trim()}
              size="sm"
              variant="secondary"
            >
              Save option
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}

/**
 * Sortable option row with drag handle, label/value display, and actions menu.
 * Only the grip icon is the drag handle to avoid conflicts with interactive elements.
 */
function SortableOptionItem({
  option,
  onEdit,
  onRemove,
}: {
  option: OptionData;
  onEdit: (id: string, label: string, value: string) => void;
  onRemove: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: option.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between pr-1 h-8 bg-muted text-muted-foreground rounded-lg"
    >
      <div className="flex items-center gap-1 min-w-0 flex-1">
        <button
          type="button"
          className="flex items-center justify-center shrink-0 w-6 h-8 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
          {...attributes}
          {...listeners}
        >
          <Icon
            name="grip-vertical"
            className="size-3"
          />
        </button>
        <span className="truncate text-xs">
          {option.label}
          {option.value && (
            <span className="opacity-50"> = &quot;{option.value}&quot;</span>
          )}
        </span>
      </div>

      <OptionActions
        option={option}
        onEdit={onEdit}
        onRemove={onRemove}
      />
    </div>
  );
}

export default function SelectOptionsSettings({
  layer,
  onLayerUpdate,
}: SelectOptionsSettingsProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [showAddPopover, setShowAddPopover] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newValue, setNewValue] = useState('');

  const isSelectLayer = layer?.name === 'select';

  const options = isSelectLayer && layer ? getOptionsFromLayer(layer) : [];

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (!layer || !over || active.id === over.id) return;

      const currentChildren = layer.children || [];
      const oldIndex = currentChildren.findIndex((child) => child.id === active.id);
      const newIndex = currentChildren.findIndex((child) => child.id === over.id);

      if (oldIndex === -1 || newIndex === -1) return;

      const reorderedChildren = arrayMove(currentChildren, oldIndex, newIndex);
      onLayerUpdate(layer.id, { children: reorderedChildren });
    },
    [layer, onLayerUpdate]
  );

  const handleAddOption = useCallback(() => {
    if (!layer || !newLabel.trim()) return;

    const newOption = buildOptionLayer(
      generateId('lyr'),
      newLabel.trim(),
      newValue
    );

    const currentChildren = layer.children || [];
    onLayerUpdate(layer.id, {
      children: [...currentChildren, newOption],
    });

    // Reset form and close popover
    setNewLabel('');
    setNewValue('');
    setShowAddPopover(false);
  }, [layer, newLabel, newValue, onLayerUpdate]);

  const handleEditOption = useCallback(
    (optionId: string, label: string, value: string) => {
      if (!layer) return;

      const currentChildren = layer.children || [];
      const updatedChildren = currentChildren.map((child) => {
        if (child.id === optionId) {
          return buildOptionLayer(child.id, label, value);
        }
        return child;
      });

      onLayerUpdate(layer.id, { children: updatedChildren });
    },
    [layer, onLayerUpdate]
  );

  const handleRemoveOption = useCallback(
    (optionId: string) => {
      if (!layer) return;

      const currentChildren = layer.children || [];
      const updatedChildren = currentChildren.filter(
        (child) => child.id !== optionId
      );

      onLayerUpdate(layer.id, { children: updatedChildren });
    },
    [layer, onLayerUpdate]
  );

  // Only show for select elements
  if (!layer || !isSelectLayer) {
    return null;
  }

  return (
    <SettingsPanel
      title="Options"
      collapsible
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
      action={
        <Popover open={showAddPopover} onOpenChange={setShowAddPopover}>
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
                <Label variant="muted">Label</Label>
                <div className="col-span-2 *:w-full">
                  <Input
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="e.g., Option 1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleAddOption();
                      }
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3">
                <Label>Value</Label>
                <div className="col-span-2 *:w-full">
                  <Input
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    placeholder="e.g., option1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleAddOption();
                      }
                    }}
                  />
                </div>
              </div>

              <Button
                onClick={handleAddOption}
                disabled={!newLabel.trim()}
                size="sm"
                variant="secondary"
              >
                Add option
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      }
    >
      {options.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={options.map((opt) => opt.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-1">
              {options.map((option) => (
                <SortableOptionItem
                  key={option.id}
                  option={option}
                  onEdit={handleEditOption}
                  onRemove={handleRemoveOption}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <Empty>
          <EmptyDescription>Add options for this select element.</EmptyDescription>
        </Empty>
      )}
    </SettingsPanel>
  );
}
