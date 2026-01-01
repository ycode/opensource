'use client';

/**
 * Toggle Group Component
 * 
 * Reusable toggle button group for binary or multi-option selections
 * Uses the shadcn/ui Tabs component for consistent styling
 */

import React from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Icon, { type IconProps } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

export interface ToggleOption {
  label?: string;
  icon?: IconProps['name'];
  value: string | boolean;
}

interface ToggleGroupProps {
  options: ToggleOption[];
  value: string | boolean;
  onChange: (value: string | boolean) => void;
  className?: string;
  disabled?: boolean;
}

export default function ToggleGroup({
  options,
  value,
  onChange,
  className = '',
  disabled = false,
}: ToggleGroupProps) {
  // Convert boolean values to strings for Tabs component
  const stringValue = String(value);
  
  const handleChange = (newValue: string) => {
    // Try to parse back to boolean if the original value was boolean
    const firstOptionValue = options[0]?.value;
    if (typeof firstOptionValue === 'boolean') {
      onChange(newValue === 'true');
    } else {
      onChange(newValue);
    }
  };

  return (
    <Tabs 
      value={stringValue} 
      onValueChange={disabled ? undefined : handleChange}
      className={cn(className, disabled && 'opacity-50 pointer-events-none')}
    >
      <TabsList className="w-full">
        {options.map((option) => (
          <TabsTrigger 
            key={String(option.value)} 
            value={String(option.value)}
            disabled={disabled}
            className={cn(
              'flex items-center gap-1.5',
              !option.label && 'justify-center'
            )}
          >
            {option.icon && (
              <Icon name={option.icon} className="size-3" />
            )}
            {option.label && <span>{option.label}</span>}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
