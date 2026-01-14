/**
 * FieldFormPopover Component
 *
 * Reusable popover component for creating and editing collection fields.
 * Consolidates the field form logic used in multiple places in CMS.tsx.
 */
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FIELD_TYPES, type FieldType } from '@/lib/field-types-config';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import type { CollectionField } from '@/types';

interface FieldFormPopoverProps {
  trigger?: React.ReactNode;
  mode: 'create' | 'edit';
  field?: CollectionField;
  currentCollectionId?: string; // ID of the collection being edited (to exclude from reference options)
  onSubmit: (data: {
    name: string;
    type: FieldType;
    default: string;
    reference_collection_id?: string | null;
  }) => void | Promise<void>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  useDialog?: boolean;
}

export default function FieldFormPopover({
  trigger,
  mode,
  field,
  currentCollectionId,
  onSubmit,
  open,
  onOpenChange,
  useDialog = false,
}: FieldFormPopoverProps) {
  // Initialize state from field prop for edit mode
  const [fieldName, setFieldName] = useState(mode === 'edit' && field ? field.name : '');
  const [fieldType, setFieldType] = useState<FieldType>(mode === 'edit' && field ? field.type : 'text');
  const [fieldDefault, setFieldDefault] = useState(mode === 'edit' && field ? (field.default || '') : '');
  const [referenceCollectionId, setReferenceCollectionId] = useState<string | null>(
    mode === 'edit' && field ? (field.reference_collection_id || null) : null
  );

  // Get collections for reference field dropdown
  const { collections } = useCollectionsStore();

  // Filter out the current collection from reference options (can't reference self)
  // In edit mode, ensure the currently referenced collection is always in the list
  const availableCollections = React.useMemo(() => {
    const filtered = collections.filter(c => c.id !== currentCollectionId);

    // In edit mode, ensure the referenced collection is included (even if collections list is stale)
    if (mode === 'edit' && field?.reference_collection_id) {
      const refCollectionExists = filtered.some(c => c.id === field.reference_collection_id);
      if (!refCollectionExists) {
        // Find it in the full collections list
        const refCollection = collections.find(c => c.id === field.reference_collection_id);
        if (refCollection) {
          return [...filtered, refCollection];
        }
      }
    }

    return filtered;
  }, [collections, currentCollectionId, mode, field?.reference_collection_id]);

  // Check if current field type requires a reference collection
  const isReferenceType = fieldType === 'reference' || fieldType === 'multi_reference';

  // Initialize form values when field changes or dialog opens (for edit mode)
  useEffect(() => {
    if (mode === 'edit' && field && open) {
      setFieldName(field.name);
      setFieldType(field.type);
      setFieldDefault(field.default || '');
      setReferenceCollectionId(field.reference_collection_id || null);
      setHasChangedType(false);
    } else if (mode === 'create' && open) {
      // Reset for create mode
      setFieldName('');
      setFieldType('text');
      setFieldDefault('');
      setReferenceCollectionId(null);
      setHasChangedType(false);
    }
  }, [mode, field, open]);

  // Track if user has interacted with the type selector
  const [hasChangedType, setHasChangedType] = useState(false);

  // Clear reference collection when user switches away from reference types
  useEffect(() => {
    // Only clear if user actively changed the type (not on initial render)
    if (hasChangedType && !isReferenceType) {
      setReferenceCollectionId(null);
    }
  }, [isReferenceType, hasChangedType]);

  const handleSubmit = async () => {
    if (!fieldName.trim()) return;

    // Validate reference collection is selected for reference types
    if (isReferenceType && !referenceCollectionId) return;

    await onSubmit({
      name: fieldName.trim(),
      type: fieldType,
      default: fieldDefault,
      reference_collection_id: isReferenceType ? referenceCollectionId : null,
    });

    // Reset form after successful submission
    if (mode === 'create') {
      setFieldName('');
      setFieldType('text');
      setFieldDefault('');
      setReferenceCollectionId(null);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset form when closing if in create mode
      if (mode === 'create') {
        setFieldName('');
        setFieldType('text');
        setFieldDefault('');
        setReferenceCollectionId(null);
      }
    }
    onOpenChange?.(newOpen);
  };

  // Determine if submit button should be disabled
  const isSubmitDisabled = !fieldName.trim() || (isReferenceType && !referenceCollectionId);

  const formContent = (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="field-name" className="text-right">
          Name
        </Label>
        <div className="col-span-3">
          <Input
            id="field-name"
            value={fieldName}
            onChange={(e) => setFieldName(e.target.value)}
            placeholder="Field name"
          />
        </div>
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="field-type" className="text-right">
          Type
        </Label>
        <div className="col-span-3">
          <Select
            value={fieldType}
            onValueChange={(value: any) => {
              setFieldType(value);
              setHasChangedType(true);
            }}
            disabled={mode === 'edit'}
          >
            <SelectTrigger id="field-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {FIELD_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Reference Collection Selector - only show for reference types */}
      {isReferenceType && (
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="field-reference-collection" className="text-right">
            Collection
          </Label>
          <div className="col-span-3">
            <Select
              value={referenceCollectionId || ''}
              onValueChange={(value) => setReferenceCollectionId(value || null)}
              disabled={mode === 'edit'}
            >
              <SelectTrigger id="field-reference-collection" className="w-full">
                <SelectValue placeholder="Select collection" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {availableCollections.length > 0 ? (
                    availableCollections.map((collection) => (
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
          </div>
        </div>
      )}

      {/* Default value - hide for reference types (they have no default) */}
      {!isReferenceType && (
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="field-default" className="text-right">
            Default
          </Label>
          <div className="col-span-3">
            <Input
              id="field-default"
              value={fieldDefault}
              onChange={(e) => setFieldDefault(e.target.value)}
              placeholder="Default value"
            />
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        {useDialog && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
        )}
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={isSubmitDisabled}
        >
          {mode === 'create' ? 'Create field' : 'Update field'}
        </Button>
      </div>
    </div>
  );

  // Render as Dialog when useDialog is true
  if (useDialog) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>
              {mode === 'create' ? 'Create Field' : 'Edit Field'}
            </DialogTitle>
          </DialogHeader>
          <div className="">{formContent}</div>
        </DialogContent>
      </Dialog>
    );
  }

  // Render as Popover (default)
  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-80 mr-4">{formContent}</PopoverContent>
    </Popover>
  );
}
