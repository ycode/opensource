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
import type { CollectionField } from '@/types';

interface FieldFormPopoverProps {
  trigger?: React.ReactNode;
  mode: 'create' | 'edit';
  field?: CollectionField;
  onSubmit: (data: {
    name: string;
    type: FieldType;
    default: string;
  }) => void | Promise<void>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  useDialog?: boolean;
}

export default function FieldFormPopover({
  trigger,
  mode,
  field,
  onSubmit,
  open,
  onOpenChange,
  useDialog = false,
}: FieldFormPopoverProps) {
  const [fieldName, setFieldName] = useState('');
  const [fieldType, setFieldType] = useState<FieldType>('text');
  const [fieldDefault, setFieldDefault] = useState('');

  // Initialize form values when field changes (for edit mode)
  useEffect(() => {
    if (mode === 'edit' && field) {
      setFieldName(field.name);
      setFieldType(field.type);
      setFieldDefault(field.default || '');
    } else if (mode === 'create') {
      // Reset for create mode
      setFieldName('');
      setFieldType('text');
      setFieldDefault('');
    }
  }, [mode, field]);

  const handleSubmit = async () => {
    if (!fieldName.trim()) return;

    await onSubmit({
      name: fieldName.trim(),
      type: fieldType,
      default: fieldDefault,
    });

    // Reset form after successful submission
    if (mode === 'create') {
      setFieldName('');
      setFieldType('text');
      setFieldDefault('');
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset form when closing if in create mode
      if (mode === 'create') {
        setFieldName('');
        setFieldType('text');
        setFieldDefault('');
      }
    }
    onOpenChange?.(newOpen);
  };

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
            onValueChange={(value: any) => setFieldType(value)}
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
      <div className="flex justify-end gap-2">
        {useDialog && (
          <Button variant="secondary" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
        )}
        <Button
          size="sm" onClick={handleSubmit}
          disabled={!fieldName.trim()}
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {mode === 'create' ? 'Create Field' : 'Edit Field'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">{formContent}</div>
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
