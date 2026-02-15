'use client';

/**
 * Alert Settings Component
 *
 * Settings panel for alert layers (form success/error messages)
 * Allows previewing hidden alerts in the Canvas
 */

import React, { useState } from 'react';

import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import SettingsPanel from './SettingsPanel';
import type { Layer } from '@/types';

interface AlertSettingsProps {
  layer: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
}

export default function AlertSettings({ layer, onLayerUpdate }: AlertSettingsProps) {
  const [isOpen, setIsOpen] = useState(true);

  // Only show for alert layers
  if (!layer || !layer.alertType) {
    return null;
  }

  // Check if alert is currently being previewed (hiddenGenerated is false or undefined means visible)
  const isPreviewVisible = !layer.hiddenGenerated;

  const handleTogglePreview = () => {
    onLayerUpdate(layer.id, {
      hiddenGenerated: isPreviewVisible, // Toggle: if visible, hide it; if hidden, show it
    });
  };

  return (
    <SettingsPanel
      title="Alert"
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-3 items-center">
          <Label variant="muted">Preview</Label>
          <div className="col-span-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleTogglePreview}
              className="w-full"
            >
              <Icon name={isPreviewVisible ? 'eye-off' : 'eye'} className="size-3" />
              {isPreviewVisible ? 'Hide' : 'Show'}
            </Button>
          </div>
        </div>
      </div>
    </SettingsPanel>
  );
}
