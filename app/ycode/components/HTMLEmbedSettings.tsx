'use client';

/**
 * HTML Embed Settings Component
 *
 * Settings panel for HTML embed layers with code editor
 */

import React, { useState, useCallback } from 'react';

import { Textarea } from '@/components/ui/textarea';
import SettingsPanel from './SettingsPanel';
import type { Layer } from '@/types';

interface HTMLEmbedSettingsProps {
  layer: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
}

export default function HTMLEmbedSettings({ layer, onLayerUpdate }: HTMLEmbedSettingsProps) {
  const [isOpen, setIsOpen] = useState(true);

  // Get current HTML code from settings
  const currentCode = layer?.settings?.htmlEmbed?.code || '';

  const handleCodeChange = useCallback((value: string) => {
    if (!layer) return;

    onLayerUpdate(layer.id, {
      settings: {
        ...layer.settings,
        htmlEmbed: {
          code: value,
        },
      },
    });
  }, [layer, onLayerUpdate]);

  // Only show for htmlEmbed layers
  if (!layer || layer.name !== 'htmlEmbed') {
    return null;
  }

  return (
    <SettingsPanel
      title="HTML"
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
    >
      <div className="flex flex-col gap-2.5">
        <Textarea
          value={currentCode}
          onChange={(e) => handleCodeChange(e.target.value)}
          placeholder="<div>Paste your HTML code here</div>"
          className="font-mono text-xs min-h-[200px]"
          spellCheck={false}
        />
      </div>
    </SettingsPanel>
  );
}
