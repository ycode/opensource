'use client';

/**
 * Input Settings Component
 *
 * Settings panel for form input elements (input, textarea, select)
 * Allows configuring type, placeholder, value, and behavior attributes
 */

import React, { useState, useCallback } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import SettingsPanel from './SettingsPanel';
import type { Layer } from '@/types';

interface InputSettingsProps {
  layer: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
}

// Input type options
const INPUT_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'password', label: 'Password' },
  { value: 'email', label: 'Email address' },
  { value: 'tel', label: 'Phone number' },
  { value: 'url', label: 'URL' },
  { value: 'date', label: 'Date' },
  { value: 'datetime-local', label: 'Date and time' },
  { value: 'range', label: 'Range' },
];

export default function InputSettings({ layer, onLayerUpdate }: InputSettingsProps) {
  const [isOpen, setIsOpen] = useState(true);

  // Check if this is a form input element
  const isInputLayer = layer?.name === 'input';
  const isTextareaLayer = layer?.name === 'textarea';
  const isSelectLayer = layer?.name === 'select';
  const isFormInputElement = isInputLayer || isTextareaLayer || isSelectLayer;

  // Check if this is a checkbox or radio input
  const isCheckboxInput = isInputLayer && layer?.attributes?.type === 'checkbox';
  const isRadioInput = isInputLayer && layer?.attributes?.type === 'radio';
  const isCheckboxOrRadio = isCheckboxInput || isRadioInput;

  // Get current attribute values
  const attributes = layer?.attributes || {};
  const inputType = attributes.type || 'text';
  const placeholder = attributes.placeholder || '';
  const value = attributes.value || '';
  const name = attributes.name || '';
  const isRequired = attributes.required === true || attributes.required === 'true';
  const isAutofocus = attributes.autofocus === true || attributes.autofocus === 'true';

  const handleAttributeChange = useCallback(
    (key: string, newValue: any) => {
      if (!layer) return;

      // Handle boolean attributes (required, autofocus)
      // If false/unchecked, remove the attribute entirely
      if (key === 'required' || key === 'autofocus') {
        const newAttributes = { ...layer.attributes };
        if (newValue) {
          newAttributes[key] = true;
        } else {
          delete newAttributes[key];
        }
        onLayerUpdate(layer.id, { attributes: newAttributes });
        return;
      }

      // Handle empty string values - remove the attribute
      if (newValue === '') {
        const newAttributes = { ...layer.attributes };
        delete newAttributes[key];
        onLayerUpdate(layer.id, { attributes: newAttributes });
        return;
      }

      onLayerUpdate(layer.id, {
        attributes: {
          ...layer.attributes,
          [key]: newValue,
        },
      });
    },
    [layer, onLayerUpdate]
  );

  // Only show for form input elements
  if (!layer || !isFormInputElement) {
    return null;
  }

  return (
    <SettingsPanel
      title="Settings"
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
    >
      <div className="flex flex-col gap-2">
        {/* Radio specific settings */}
        {isRadioInput ? (
          <>
            {/* Group - radios with the same name work as a group */}
            <div className="grid grid-cols-3">
              <Label variant="muted">Group</Label>
              <div className="col-span-2 *:w-full">
                <Input
                  value={name}
                  onChange={(e) => handleAttributeChange('name', e.target.value)}
                  placeholder="e.g., plan"
                />
              </div>
            </div>

            {/* Value - the value submitted when this radio is selected */}
            <div className="grid grid-cols-3">
              <Label variant="muted">Value</Label>
              <div className="col-span-2 *:w-full">
                <Input
                  value={value}
                  onChange={(e) => handleAttributeChange('value', e.target.value)}
                  placeholder="e.g., premium"
                />
              </div>
            </div>

            {/* Behavior section */}
            <div className="grid grid-cols-3 items-start">
              <Label variant="muted" className="pt-0.5">Behavior</Label>
              <div className="col-span-2 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="required"
                    checked={isRequired}
                    onCheckedChange={(checked) => handleAttributeChange('required', checked)}
                  />
                  <Label
                    htmlFor="required"
                    className="text-xs font-normal cursor-pointer"
                  >
                    Required
                  </Label>
                </div>
              </div>
            </div>
          </>
        ) : isCheckboxInput ? (
          <>
            {/* Name - used as the key in form submission */}
            <div className="grid grid-cols-3">
              <Label variant="muted">Name</Label>
              <div className="col-span-2 *:w-full">
                <Input
                  value={name}
                  onChange={(e) => handleAttributeChange('name', e.target.value)}
                  placeholder="e.g., agree_terms"
                />
              </div>
            </div>

            {/* Behavior section */}
            <div className="grid grid-cols-3 items-start">
              <Label variant="muted" className="pt-0.5">Behavior</Label>
              <div className="col-span-2 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="required"
                    checked={isRequired}
                    onCheckedChange={(checked) => handleAttributeChange('required', checked)}
                  />
                  <Label
                    htmlFor="required"
                    className="text-xs font-normal cursor-pointer"
                  >
                    Required
                  </Label>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Type selector - only for input elements (not checkbox/radio) */}
            {isInputLayer && (
              <div className="grid grid-cols-3">
                <Label variant="muted">Type</Label>
                <div className="col-span-2 *:w-full">
                  <Select
                    value={inputType}
                    onValueChange={(val) => handleAttributeChange('type', val)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {INPUT_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Placeholder - for input and textarea */}
            {(isInputLayer || isTextareaLayer) && (
              <div className="grid grid-cols-3">
                <Label variant="muted">Placeholder</Label>
                <div className="col-span-2 *:w-full">
                  <Input
                    value={placeholder}
                    onChange={(e) => handleAttributeChange('placeholder', e.target.value)}
                    placeholder="Placeholder text"
                  />
                </div>
              </div>
            )}

            {/* Value - default value for the input */}
            {(isInputLayer || isTextareaLayer) && (
              <div className="grid grid-cols-3">
                <Label variant="muted">Value</Label>
                <div className="col-span-2 *:w-full">
                  <Input
                    value={value}
                    onChange={(e) => handleAttributeChange('value', e.target.value)}
                    placeholder="Input value"
                  />
                </div>
              </div>
            )}

            {/* Behavior section */}
            <div className="grid grid-cols-3 items-start">
              <Label variant="muted" className="pt-0.5">Behavior</Label>
              <div className="col-span-2 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="required"
                    checked={isRequired}
                    onCheckedChange={(checked) => handleAttributeChange('required', checked)}
                  />
                  <Label
                    htmlFor="required"
                    className="text-xs font-normal cursor-pointer"
                  >
                    Required
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="autofocus"
                    checked={isAutofocus}
                    onCheckedChange={(checked) => handleAttributeChange('autofocus', checked)}
                  />
                  <Label
                    htmlFor="autofocus"
                    className="text-xs font-normal cursor-pointer"
                  >
                    Autofocus
                  </Label>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </SettingsPanel>
  );
}
