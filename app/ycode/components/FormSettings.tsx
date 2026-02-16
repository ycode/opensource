'use client';

/**
 * Form Settings Component
 *
 * Settings panel for form layers with submission handling configuration
 */

import React, { useState, useCallback, useEffect } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SettingsPanel from './SettingsPanel';
import LinkSettings from './LinkSettings';
import type { Layer, FormSettings as FormSettingsType, LinkSettingsValue } from '@/types';

interface FormSettingsProps {
  layer: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
}

// Simple email validation
const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export default function FormSettings({ layer, onLayerUpdate }: FormSettingsProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [emailOpen, setEmailOpen] = useState(false);
  const [isSmtpEnabled, setIsSmtpEnabled] = useState<boolean | null>(null);
  const [emailToInput, setEmailToInput] = useState('');

  // Check if SMTP is enabled in global settings
  useEffect(() => {
    const checkSmtpSettings = async () => {
      try {
        const response = await fetch('/ycode/api/settings/email');
        if (response.ok) {
          const result = await response.json();
          const enabled = result.data?.enabled ?? false;
          setIsSmtpEnabled(enabled);
          // Auto-expand email section when SMTP is enabled
          if (enabled) {
            setEmailOpen(true);
          }
        } else {
          setIsSmtpEnabled(false);
        }
      } catch {
        setIsSmtpEnabled(false);
      }
    };

    checkSmtpSettings();
  }, []);

  // Sync local email input with layer data
  useEffect(() => {
    setEmailToInput(layer?.settings?.form?.email_notification?.to || '');
  }, [layer?.settings?.form?.email_notification?.to]);

  // Get current form settings
  const formSettings: FormSettingsType = layer?.settings?.form || {};
  const successAction = formSettings.success_action || 'message';
  const handleRedirectLinkChange = useCallback(
    (value: LinkSettingsValue) => {
      if (!layer) return;

      onLayerUpdate(layer.id, {
        settings: {
          ...layer.settings,
          form: {
            ...layer.settings?.form,
            redirect_url: value,
          },
        },
      });
    },
    [layer, onLayerUpdate]
  );

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

  const handleEmailToChange = (value: string) => {
    setEmailToInput(value);

    if (isValidEmail(value)) {
      // Valid email: save it and enable notification
      handleEmailNotificationChange('to', value);
      if (!emailNotification.enabled) {
        handleEmailNotificationChange('enabled', true);
      }
    } else if (value === '') {
      // Empty: clear and disable notification
      handleEmailNotificationChange('to', '');
      handleEmailNotificationChange('enabled', false);
    }
    // Invalid non-empty: only update local input, don't save
  };

  const handleEmailToBlur = () => {
    if (emailToInput && !isValidEmail(emailToInput)) {
      // Reset to last valid value on blur
      setEmailToInput(emailNotification.to || '');
    }
  };

  return (
    <>
    <SettingsPanel
      title="Form Settings"
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
    >
      <div className="flex flex-col gap-3">
        {/* Success Action Toggle */}
        <div className="grid grid-cols-3">
          <Label variant="muted">Success</Label>
          <div className="col-span-2 *:w-full">
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
          </div>
        </div>

        {/* Redirect destination - only show when redirect is selected */}
        {successAction === 'redirect' && (
          <LinkSettings
            mode="standalone"
            value={formSettings.redirect_url}
            onChange={handleRedirectLinkChange}
            gridLayout
            typeLabel="Redirect to"
            allowedTypes={['page', 'url']}
            hideBehavior
          />
        )}

      </div>
    </SettingsPanel>

    <SettingsPanel
      title="Email notification"
      collapsible
      isOpen={emailOpen}
      onToggle={() => setEmailOpen(!emailOpen)}
    >
      {!isSmtpEnabled && isSmtpEnabled !== null && (
        <div className="text-xs text-muted-foreground text-center py-4">
          Enable <a href="/ycode/settings/email" className="underline hover:text-foreground">SMTP in Settings</a> to use email notifications.
        </div>
      )}

      {isSmtpEnabled && (
        <>
          <div className="grid grid-cols-3">
            <Label variant="muted">Send to</Label>
            <div className="col-span-2 *:w-full">
              <Input
                id="email-to"
                type="email"
                value={emailToInput}
                onChange={(e) => handleEmailToChange(e.target.value)}
                onBlur={handleEmailToBlur}
                placeholder="hello@example.com"
              />
            </div>
          </div>

          {emailNotification.enabled && emailNotification.to && (
            <div className="grid grid-cols-3">
              <Label variant="muted">Subject</Label>
              <div className="col-span-2 *:w-full">
                <Input
                  id="email-subject"
                  value={emailNotification.subject || ''}
                  onChange={(e) => handleEmailNotificationChange('subject', e.target.value)}
                  placeholder="New form submission"
                />
              </div>
            </div>
          )}
        </>
      )}
    </SettingsPanel>
  </>
  );
}
