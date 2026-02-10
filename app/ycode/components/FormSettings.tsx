'use client';

/**
 * Form Settings Component
 *
 * Settings panel for form layers with submission handling configuration
 */

import React, { useState, useCallback, useEffect } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import Icon from '@/components/ui/icon';
import SettingsPanel from './SettingsPanel';
import type { Layer, FormSettings as FormSettingsType } from '@/types';

interface FormSettingsProps {
  layer: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
}

export default function FormSettings({ layer, onLayerUpdate }: FormSettingsProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isSmtpEnabled, setIsSmtpEnabled] = useState<boolean | null>(null);

  // Check if SMTP is enabled in global settings
  useEffect(() => {
    const checkSmtpSettings = async () => {
      try {
        const response = await fetch('/ycode/api/settings/email');
        if (response.ok) {
          const result = await response.json();
          setIsSmtpEnabled(result.data?.enabled ?? false);
        } else {
          setIsSmtpEnabled(false);
        }
      } catch {
        setIsSmtpEnabled(false);
      }
    };

    checkSmtpSettings();
  }, []);

  // Get current form settings
  const formSettings: FormSettingsType = layer?.settings?.form || {};
  const successAction = formSettings.success_action || 'message';

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
        {/* Success Action Toggle */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-normal">
            On Success
          </Label>
          <Tabs
            value={successAction}
            onValueChange={(value) => handleSettingChange('success_action', value)}
            className="w-full"
          >
            <TabsList className="w-full">
              <TabsTrigger value="message" className="flex-1 text-xs">
                Message
              </TabsTrigger>
              <TabsTrigger value="redirect" className="flex-1 text-xs">
                Redirect
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <p className="text-[10px] text-muted-foreground">
            {successAction === 'message'
              ? 'Shows the Success Alert inside the form'
              : 'Redirects to a URL after submission'}
          </p>
        </div>

        {/* Redirect URL - only show when redirect is selected */}
        {successAction === 'redirect' && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="redirect-url" className="text-xs font-normal">
              Redirect URL
            </Label>
            <Input
              id="redirect-url"
              value={formSettings.redirect_url || ''}
              onChange={(e) => handleSettingChange('redirect_url', e.target.value)}
              placeholder="/thank-you"
              className="text-xs"
            />
          </div>
        )}

        {/* Notifications Section */}
        <div className="flex flex-col gap-3">
          {/* Email Notification */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="email-enabled" className="text-xs">
                  Email notification
                </Label>
                {!isSmtpEnabled && isSmtpEnabled !== null && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Icon name="info" className="size-3 opacity-70" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Enable SMTP in Settings to use
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              <Switch
                id="email-enabled"
                checked={emailNotification.enabled && isSmtpEnabled === true}
                onCheckedChange={(checked) => handleEmailNotificationChange('enabled', checked)}
                disabled={!isSmtpEnabled}
              />
            </div>

            {emailNotification.enabled && isSmtpEnabled && (
              <div className="flex flex-col gap-3 pl-0">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email-to" className="text-xs font-normal">
                    Send to
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
                  <Label htmlFor="email-subject" className="text-xs font-normal">
                    Subject
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
      </div>
    </SettingsPanel>
  );
}
