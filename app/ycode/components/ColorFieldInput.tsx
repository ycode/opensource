'use client';

/**
 * ColorFieldInput Component
 *
 * A color input for collection fields that stores standard hex color values.
 * Normalizes ColorPicker output (Tailwind format #rrggbb/NN) to valid hex (#rrggbb or #rrggbbaa).
 */

import React, { useCallback } from 'react';
import ColorPicker from './ColorPicker';

interface ColorFieldInputProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Convert Tailwind color format (#rrggbb/NN) to standard hex (#rrggbb or #rrggbbaa).
 * - #rrggbb → #rrggbb (no change)
 * - #rrggbb/50 → #rrggbb80 (opacity converted to 2-digit hex alpha)
 */
function normalizeToHex(color: string): string {
  if (!color) return '';

  const match = color.match(/^#([0-9a-fA-F]{6})\/(\d+)$/);
  if (match) {
    const hex = match[1];
    const opacityPercent = parseInt(match[2], 10);
    const alpha = Math.round((opacityPercent / 100) * 255)
      .toString(16)
      .padStart(2, '0');
    return `#${hex}${alpha}`;
  }

  return color;
}

export default function ColorFieldInput({ value, onChange }: ColorFieldInputProps) {
  const handleChange = useCallback(
    (pickerValue: string) => {
      onChange(normalizeToHex(pickerValue));
    },
    [onChange]
  );

  return (
    <ColorPicker
      value={value}
      onChange={handleChange}
      defaultValue="#000000"
      placeholder="#000000"
      solidOnly
    />
  );
}
