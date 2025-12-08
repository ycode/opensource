'use client';

/**
 * ColorPicker Component
 *
 * A color picker wrapped in a Popover with a visual color button trigger
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import Icon from '@/components/ui/icon';
import { Label } from '@/components/ui/label';

interface ColorPickerProps {
  value?: string;
  onChange: (value: string) => void;
  defaultValue?: string;
  placeholder?: string;
}

export default function ColorPicker({
  value,
  onChange,
  defaultValue = '#ffffff',
  placeholder = '#ffffff',
}: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const displayValue = value || '';
  const colorDisplayValue = value || defaultValue;

  const handleColorChange = (newValue: string) => {
    onChange(newValue);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  const hasValue = !!displayValue;

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    // When opening and there's no value, set it to default
    if (newOpen && !hasValue) {
      onChange(defaultValue);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
      {hasValue ? (
        <div className="flex items-center justify-start h-8 rounded-lg bg-input hover:bg-input/60 px-2.5 flex items-center gap-2 cursor-pointer">
          <div className="size-4 rounded" style={{ backgroundColor: displayValue }} />
          <Label variant="muted">{displayValue}</Label>
          <div className="ml-auto -mr-1.5">
              <Button
                variant="ghost"
                size="xs"
                onClick={handleClear}
              >
                  <Icon name="x" />
              </Button>
          </div>
        </div>
      ) : (
          <Button variant="input" size="sm">
            <Icon name="plus" />
            Add
          </Button>
      )}
      </PopoverTrigger>
      <PopoverContent className="w-64" align="end">
        <div className="flex flex-col gap-3">
          <Input
            type="color"
            value={colorDisplayValue}
            onChange={(e) => handleColorChange(e.target.value)}
            className="h-12 cursor-pointer"
          />
          <Input
            type="text"
            value={displayValue}
            onChange={(e) => handleColorChange(e.target.value)}
            placeholder={placeholder}
            className="font-mono text-sm"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
