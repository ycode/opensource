'use client';

/**
 * Form Settings Component
 *
 * Settings panel for form layers with submission handling configuration
 */

import React, { useState, useCallback } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import SettingsPanel from './SettingsPanel';
import type { Layer, FormSettings as FormSettingsType } from '@/types';

interface FormSettingsProps {
  layer: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
}

export default function FormSettings({ layer, onLayerUpdate }: FormSettingsProps) {
  const [isOpen, setIsOpen] = useState(true);

  // Get current form settings
  const formSettings: FormSettingsType = layer?.settings?.form || {};

  const handleSettingChange = useCallback(
    (key: keyof FormSettingsType, value: any) => {
      if (!layer) return;

      onLayerUpdate(layer.id, {
        settings: {
          ...layer.settings,
          form: {
            ...layer.settings?.form,
            [key]: value,
          },
        },
      });
    },
    [layer, onLayerUpdate]
  );

  const handleEmailNotificationChange = useCallback(
    (key: keyof NonNullable<FormSettingsType['email_notification']>, value: any) => {
      if (!layer) return;

      onLayerUpdate(layer.id, {
        settings: {
          ...layer.settings,
          form: {
            ...layer.settings?.form,
            email_notification: {
              ...layer.settings?.form?.email_notification,
              enabled: layer.settings?.form?.email_notification?.enabled ?? false,
              to: layer.settings?.form?.email_notification?.to ?? '',
              [key]: value,
            },
          },
        },
      });
    },
    [layer, onLayerUpdate]
  );

  // Only show for form layers
  if (!layer || layer.name !== 'form') {
    return null;
  }

  const emailNotification = formSettings.email_notification || { enabled: false, to: '' };

  return (
    <SettingsPanel
      title="Form Settings"
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
    >
      <div className="flex flex-col gap-4">
        {/* Form ID Notice */}
        <div className="text-xs text-muted-foreground bg-secondary/30 p-3 rounded-lg">
          <p>
            Set a custom <strong>ID</strong> in Element Settings to identify this form.
            Submissions will be grouped by this ID.
          </p>
        </div>

        {/* Success Message */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="success-message" className="text-xs">
            Success Message
          </Label>
          <Textarea
            id="success-message"
            value={formSettings.success_message || ''}
            onChange={(e) => handleSettingChange('success_message', e.target.value)}
            placeholder="Thank you for your submission!"
            className="text-xs min-h-[60px] resize-none"
          />
        </div>

        {/* Error Message */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="error-message" className="text-xs">
            Error Message
          </Label>
          <Textarea
            id="error-message"
            value={formSettings.error_message || ''}
            onChange={(e) => handleSettingChange('error_message', e.target.value)}
            placeholder="Something went wrong. Please try again."
            className="text-xs min-h-[60px] resize-none"
          />
        </div>

        {/* Redirect URL */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="redirect-url" className="text-xs">
            Redirect URL (optional)
          </Label>
          <Input
            id="redirect-url"
            value={formSettings.redirect_url || ''}
            onChange={(e) => handleSettingChange('redirect_url', e.target.value)}
            placeholder="/thank-you"
            className="text-xs"
          />
          <p className="text-[10px] text-muted-foreground">
            Leave empty to show success message instead
          </p>
        </div>

        {/* Email Notification Section */}
        <div className="border-t pt-4 mt-2">
          <div className="flex items-center justify-between mb-3">
            <Label htmlFor="email-enabled" className="text-xs">
              Email Notification
            </Label>
            <Switch
              id="email-enabled"
              checked={emailNotification.enabled}
              onCheckedChange={(checked) => handleEmailNotificationChange('enabled', checked)}
            />
          </div>

          {emailNotification.enabled && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email-to" className="text-xs">
                  Send to Email
                </Label>
                <Input
                  id="email-to"
                  type="email"
                  value={emailNotification.to || ''}
                  onChange={(e) => handleEmailNotificationChange('to', e.target.value)}
                  placeholder="hello@example.com"
                  className="text-xs"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email-subject" className="text-xs">
                  Email Subject
                </Label>
                <Input
                  id="email-subject"
                  value={emailNotification.subject || ''}
                  onChange={(e) => handleEmailNotificationChange('subject', e.target.value)}
                  placeholder="New form submission"
                  className="text-xs"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </SettingsPanel>
  );
}
