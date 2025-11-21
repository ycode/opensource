/**
 * Fields Dropdown
 *
 * Dropdown menu for managing field visibility and order
 */
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import type { CollectionField } from '@/types';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface FieldsDropdownProps {
  fields: CollectionField[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onToggleVisibility: (fieldId: string) => void;
  onReorder: (fields: CollectionField[]) => void;
}

// Sortable field item component
interface SortableFieldItemProps {
  field: CollectionField;
  onToggleVisibility: (fieldId: string) => void;
}

function SortableFieldItem({ field, onToggleVisibility }: SortableFieldItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex items-center gap-2 p-2 rounded-lg -mx-2 cursor-grab active:cursor-grabbing hover:bg-secondary/50"
    >
      <Icon
        name="grip-vertical"
        className="size-3.5 text-muted-foreground flex-shrink-0"
      />
      <Switch
        checked={!field.hidden}
        onCheckedChange={() => onToggleVisibility(field.id)}
        disabled={field.name.toLowerCase() === 'name'}
        className="flex-shrink-0"
        size="sm"
      />
      <span className="truncate text-xs text-muted-foreground select-none">{field.name}</span>
    </div>
  );
}

export default function FieldsDropdown({
  fields,
  searchQuery,
  onSearchChange,
  onToggleVisibility,
  onReorder,
}: FieldsDropdownProps) {
  const [orderedFields, setOrderedFields] = useState<CollectionField[]>(
    [...fields].sort((a, b) => a.order - b.order)
  );

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Require 5px movement before drag starts
      },
    })
  );

  // Update ordered fields when fields prop changes
  React.useEffect(() => {
    setOrderedFields([...fields].sort((a, b) => a.order - b.order));
  }, [fields]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    // Find the indices of the dragged and target fields
    const oldIndex = orderedFields.findIndex(field => field.id === active.id);
    const newIndex = orderedFields.findIndex(field => field.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Reorder the fields array
    const reorderedFields = [...orderedFields];
    const [movedField] = reorderedFields.splice(oldIndex, 1);
    reorderedFields.splice(newIndex, 0, movedField);

    // Update order values based on new positions
    const updatedFields = reorderedFields.map((field, index) => ({
      ...field,
      order: index,
    }));

    setOrderedFields(updatedFields);
    onReorder(updatedFields);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="ghost">
          Fields
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="px-2 pt-2 pb-1 flex flex-col gap-2">

          <div
            onKeyDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <InputGroup>
              <InputGroupInput
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
              />
              <InputGroupAddon>
                <Icon name="search" className="size-3" />
              </InputGroupAddon>
            </InputGroup>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={orderedFields.map(field => field.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col gap-0.5">
                {orderedFields.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    No fields found
                  </div>
                ) : (
                  orderedFields.map((field) => (
                    <SortableFieldItem
                      key={field.id}
                      field={field}
                      onToggleVisibility={onToggleVisibility}
                    />
                  ))
                )}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
