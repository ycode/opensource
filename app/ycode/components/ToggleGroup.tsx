'use client';

/**
 * Toggle Group Component
 * 
 * Reusable toggle button group for binary or multi-option selections
 * Uses the shadcn/ui Tabs component for consistent styling
 */

import React from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export interface ToggleOption {
  label: string;
  value: string | boolean;
}

interface ToggleGroupProps {
  options: ToggleOption[];
  value: string | boolean;
  onChange: (value: string | boolean) => void;
  className?: string;
}

export default function ToggleGroup({
  options,
  value,
  onChange,
  className = '',
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
      onValueChange={handleChange}
      className={className}
    >
      <TabsList className="w-full">
        {options.map((option) => (
          <TabsTrigger 
            key={String(option.value)} 
            value={String(option.value)}
          >
            {option.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}


