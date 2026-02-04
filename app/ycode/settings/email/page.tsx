'use client';

import { useState, useEffect, useRef } from 'react';
import {
  FieldDescription,
  FieldLabel,
  Field,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SMTP_PRESETS, SMTP_PROVIDER_OPTIONS, type SmtpProvider } from '@/lib/email-presets';

interface EmailSettings {
  enabled: boolean;
  provider: SmtpProvider;
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPassword: string;
  fromEmail: string;
  fromName: string;
}

const DEFAULT_SETTINGS: EmailSettings = {
  enabled: false,
  provider: 'google',
  smtpHost: SMTP_PRESETS.google.host,
  smtpPort: SMTP_PRESETS.google.port,
  smtpUser: '',
  smtpPassword: '',
  fromEmail: '',
  fromName: '',
};

export default function EmailSettingsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Email settings state
  const [settings, setSettings] = useState<EmailSettings>(DEFAULT_SETTINGS);
  const savedSettingsRef = useRef<EmailSettings>(DEFAULT_SETTINGS);

  // Load email settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch('/ycode/api/settings/email');
        if (response.ok) {
          const result = await response.json();
          if (result.data) {
            const loadedSettings: EmailSettings = {
              enabled: result.data.enabled ?? false,
              provider: result.data.provider ?? 'google',
              smtpHost: result.data.smtpHost ?? SMTP_PRESETS.google.host,
              smtpPort: result.data.smtpPort ?? SMTP_PRESETS.google.port,
              smtpUser: result.data.smtpUser ?? '',
              smtpPassword: result.data.smtpPassword ?? '',
              fromEmail: result.data.fromEmail ?? '',
              fromName: result.data.fromName ?? '',
            };
            setSettings(loadedSettings);
            savedSettingsRef.current = loadedSettings;
          }
        } else if (response.status !== 404) {
          throw new Error('Failed to load email settings');
        }
      } catch (err) {
        console.error('Error loading email settings:', err);
        setError('Failed to load email settings');
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  // Check for changes whenever settings update
  useEffect(() => {
    const saved = savedSettingsRef.current;
    const changed = JSON.stringify(settings) !== JSON.stringify(saved);
    setHasChanges(changed);
  }, [settings]);

  const handleProviderChange = (provider: SmtpProvider) => {
    const preset = SMTP_PRESETS[provider];
    setSettings((prev) => ({
      ...prev,
      provider,
      smtpHost: preset.host,
      smtpPort: preset.port,
    }));
    setTestResult(null);
  };

  const handleSettingChange = <K extends keyof EmailSettings>(
    key: K,
    value: EmailSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setTestResult(null);
  };

  // Auto-save when SMTP toggle changes
  const handleSmtpToggle = async (checked: boolean) => {
    const newSettings = { ...settings, enabled: checked };
    setSettings(newSettings);
    setTestResult(null);

    // Auto-save the toggle state
    try {
      setIsSaving(true);
      setError(null);

      const response = await fetch('/ycode/api/settings/email', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: newSettings }),
      });

      if (!response.ok) {
        throw new Error('Failed to save email settings');
      }

      savedSettingsRef.current = { ...newSettings };
      setHasChanges(false);
    } catch (err) {
      console.error('Error saving email settings:', err);
      setError('Failed to save email settings');
      // Revert on error
      setSettings(settings);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);

      const response = await fetch('/ycode/api/settings/email', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: settings }),
      });

      if (!response.ok) {
        throw new Error('Failed to save email settings');
      }

      // Update saved reference after successful save
      savedSettingsRef.current = { ...settings };
      setHasChanges(false);
    } catch (err) {
      console.error('Error saving email settings:', err);
      setError('Failed to save email settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setIsTesting(true);
      setError(null);
      setTestResult(null);

      const response = await fetch('/ycode/api/settings/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      const result = await response.json();

      if (response.ok) {
        setTestResult({ success: true, message: 'Connection successful!' });
      } else {
        setTestResult({ success: false, message: result.error || 'Connection failed' });
      }
    } catch (err) {
      console.error('Error testing connection:', err);
      setTestResult({ success: false, message: 'Failed to test connection' });
    } finally {
      setIsTesting(false);
    }
  };

  const currentPreset = SMTP_PRESETS[settings.provider];

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="max-w-3xl mx-auto">
          <header className="pt-8 pb-3">
            <span className="text-base font-medium">Email</span>
          </header>
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto">
        <header className="pt-8 pb-3">
          <span className="text-base font-medium">Email</span>
        </header>

        <div className="flex flex-col gap-6 bg-secondary/20 p-8 rounded-lg">
          {error && (
            <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-md text-sm">
              {error}
            </div>
          )}

          {/* SMTP Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <Label htmlFor="smtp-enabled" className="text-sm font-medium">
                SMTP
              </Label>
              <p className="text-xs text-muted-foreground">
                Send email notifications for form submissions
              </p>
            </div>
            <Switch
              id="smtp-enabled"
              checked={settings.enabled}
              onCheckedChange={handleSmtpToggle}
              disabled={isSaving}
            />
          </div>

          {/* SMTP Configuration Fields - only show when enabled */}
          {settings.enabled && (
            <>
              <div className="flex flex-col gap-6 border-t pt-6">
                {/* Provider Selection */}
                <Field>
                  <FieldLabel htmlFor="smtp-provider">Provider</FieldLabel>
                  <FieldDescription>
                    Select your email provider for pre-configured settings
                  </FieldDescription>
                  <Select
                    value={settings.provider}
                    onValueChange={(value) => handleProviderChange(value as SmtpProvider)}
                  >
                    <SelectTrigger id="smtp-provider" className="w-full">
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      {SMTP_PROVIDER_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {currentPreset.note && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {currentPreset.note}
                    </p>
                  )}
                </Field>

                {/* SMTP Host */}
                <Field>
                  <FieldLabel htmlFor="smtp-host">SMTP Host</FieldLabel>
                  <FieldDescription>
                    The hostname of your SMTP server
                  </FieldDescription>
                  <Input
                    id="smtp-host"
                    placeholder="smtp.example.com"
                    value={settings.smtpHost}
                    onChange={(e) => handleSettingChange('smtpHost', e.target.value)}
                  />
                </Field>

                {/* SMTP Port */}
                <Field>
                  <FieldLabel htmlFor="smtp-port">SMTP Port</FieldLabel>
                  <FieldDescription>
                    The port of your SMTP server (587 for TLS, 465 for SSL)
                  </FieldDescription>
                  <Input
                    id="smtp-port"
                    placeholder="587"
                    value={settings.smtpPort}
                    onChange={(e) => handleSettingChange('smtpPort', e.target.value)}
                  />
                </Field>

                {/* SMTP Username */}
                <Field>
                  <FieldLabel htmlFor="smtp-user">SMTP Username</FieldLabel>
                  <FieldDescription>
                    The username for SMTP authentication
                  </FieldDescription>
                  <Input
                    id="smtp-user"
                    placeholder="user@example.com"
                    value={settings.smtpUser}
                    onChange={(e) => handleSettingChange('smtpUser', e.target.value)}
                  />
                </Field>

                {/* SMTP Password */}
                <Field>
                  <FieldLabel htmlFor="smtp-password">SMTP Password</FieldLabel>
                  <FieldDescription>
                    The password or app-specific password for SMTP authentication
                  </FieldDescription>
                  <Input
                    id="smtp-password"
                    type="password"
                    placeholder="••••••••"
                    value={settings.smtpPassword}
                    onChange={(e) => handleSettingChange('smtpPassword', e.target.value)}
                  />
                </Field>

                {/* From Email */}
                <Field>
                  <FieldLabel htmlFor="from-email">From Email</FieldLabel>
                  <FieldDescription>
                    The email address that will appear as the sender
                  </FieldDescription>
                  <Input
                    id="from-email"
                    type="email"
                    placeholder="noreply@example.com"
                    value={settings.fromEmail}
                    onChange={(e) => handleSettingChange('fromEmail', e.target.value)}
                  />
                </Field>

                {/* From Name */}
                <Field>
                  <FieldLabel htmlFor="from-name">From Name</FieldLabel>
                  <FieldDescription>
                    The name that will appear as the sender
                  </FieldDescription>
                  <Input
                    id="from-name"
                    placeholder="My Company"
                    value={settings.fromName}
                    onChange={(e) => handleSettingChange('fromName', e.target.value)}
                  />
                </Field>

                {/* Test Result */}
                {testResult && (
                  <div
                    className={`px-4 py-2 rounded-md text-sm ${
                      testResult.success
                        ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                        : 'bg-destructive/10 text-destructive'
                    }`}
                  >
                    {testResult.message}
                  </div>
                )}
              </div>

              {/* Action Buttons - only show when enabled */}
              <div className="flex justify-end gap-2 border-t pt-6">
                <Button
                  variant="secondary"
                  onClick={handleTestConnection}
                  disabled={isTesting || !settings.smtpHost || !settings.smtpUser}
                >
                  {isTesting ? <Spinner className="size-4" /> : 'Test Connection'}
                </Button>
                {hasChanges && (
                  <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <Spinner className="size-4" /> : 'Save changes'}
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
