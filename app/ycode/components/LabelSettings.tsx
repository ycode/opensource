'use client';

/**
 * Label Settings Component
 *
 * Settings panel for <label> elements.
 * Allows linking a label to a form input via the HTML "for" attribute,
 * so clicking the label focuses the associated input.
 */

import React, { useState, useMemo } from 'react';

import { Label } from '@/components/ui/label';
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

interface LabelSettingsProps {
  layer: Layer | null;
  allLayers: Layer[];
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
}

/**
 * Recursively find the parent form layer that contains the given layer ID
 */
function findParentForm(layers: Layer[], targetId: string, parent: Layer | null = null): Layer | null {
  for (const layer of layers) {
    if (layer.id === targetId) {
      // Walk up — if current parent or any ancestor is a form, return it
      return parent?.name === 'form' ? parent : null;
    }
    if (layer.children && layer.children.length > 0) {
      const found = findParentForm(layer.children, targetId, layer);
      if (found) return found;
      // The target was found inside this layer's subtree but no form parent yet
      // Check if this layer itself is the form
      if (layer.name === 'form') {
        const hasTarget = findLayerInTree(layer.children, targetId);
        if (hasTarget) return layer;
      }
    }
  }
  return null;
}

/**
 * Check if a layer exists in a tree
 */
function findLayerInTree(layers: Layer[], targetId: string): boolean {
  for (const layer of layers) {
    if (layer.id === targetId) return true;
    if (layer.children && findLayerInTree(layer.children, targetId)) return true;
  }
  return false;
}

/**
 * Collect all form input elements (input, textarea, select) from a layer tree
 * that have a settings.id or attributes.id set
 */
function collectFormInputs(layers: Layer[]): { id: string; label: string; type: string }[] {
  const inputs: { id: string; label: string; type: string }[] = [];

  const walk = (items: Layer[]) => {
    for (const layer of items) {
      if (layer.name === 'input' || layer.name === 'textarea' || layer.name === 'select') {
        const inputId = layer.settings?.id || layer.attributes?.id;
        if (inputId) {
          inputs.push({
            id: inputId,
            label: inputId,
            type: layer.attributes?.type || layer.name,
          });
        }
      }
      if (layer.children && layer.children.length > 0) {
        walk(layer.children);
      }
    }
  };

  walk(layers);
  return inputs;
}

export default function LabelSettings({
  layer,
  allLayers,
  onLayerUpdate,
}: LabelSettingsProps) {
  const [isOpen, setIsOpen] = useState(true);

  // Only show for label elements (text layers with tag=label)
  const isLabelLayer = layer?.name === 'text' && layer?.settings?.tag === 'label';

  // Find the parent form and collect its inputs
  const formInputs = useMemo(() => {
    if (!layer || !isLabelLayer) return [];

    // Find the form that contains this label
    const parentForm = findParentForm(allLayers, layer.id);
    if (!parentForm || !parentForm.children) return [];

    return collectFormInputs(parentForm.children);
  }, [layer, isLabelLayer, allLayers]);

  const currentFor = layer?.attributes?.for || '';

  const handleForChange = (value: string) => {
    if (!layer) return;

    if (value === 'none') {
      // Remove the for attribute
      const newAttributes = { ...layer.attributes };
      delete newAttributes.for;
      onLayerUpdate(layer.id, { attributes: newAttributes });
    } else {
      onLayerUpdate(layer.id, {
        attributes: {
          ...layer.attributes,
          for: value,
        },
      });
    }
  };

  if (!layer || !isLabelLayer) {
    return null;
  }

  return (
    <SettingsPanel
      title="Label"
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-3">
          <Label variant="muted">For</Label>
          <div className="col-span-2 *:w-full">
            <Select
              value={currentFor || 'none'}
              onValueChange={handleForChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select input" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="none">None</SelectItem>
                  {formInputs.map((input) => (
                    <SelectItem key={input.id} value={input.id}>
                      {input.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </SettingsPanel>
  );
}
