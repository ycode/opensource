'use client';

/**
 * Toggle Group Component
 * 
 * Reusable toggle button group for binary or multi-option selections
 */

import React from 'react';

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
  return (
    <div className={`flex gap-2 ${className}`}>
      {options.map((option) => {
        const isActive = option.value === value;
        
        return (
          <button
            key={String(option.value)}
            onClick={() => onChange(option.value)}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-zinc-700 text-white'
                : 'bg-zinc-900 text-zinc-500 hover:bg-zinc-800'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

