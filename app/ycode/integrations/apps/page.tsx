'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Field,
  FieldDescription,
  FieldLabel,
  FieldLegend,
} from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import Icon from '@/components/ui/icon';
import Image from 'next/image';
import { toast } from 'sonner';

import type { AppCategory } from '@/lib/apps/registry';
import { APP_CATEGORIES } from '@/lib/apps/registry';
import { MAILERLITE_SUBSCRIBER_FIELDS } from '@/lib/apps/mailerlite/types';
import type { MailerLiteConnection, MailerLiteFieldMapping } from '@/lib/apps/mailerlite/types';

// =============================================================================
// Types
// =============================================================================

interface AppWithStatus {
  id: string;
  name: string;
  description: string;
  logo: { src: string; width: number; height: number };
  categories: AppCategory[];
  implemented: boolean;
  connected: boolean;
}

interface MailerLiteGroup {
  id: string;
  name: string;
  active_count: number;
}

interface FormSummary {
  form_id: string;
  submission_count: number;
  new_count: number;
}

// =============================================================================
// App Card Component
// =============================================================================

interface AppCardProps {
  app: AppWithStatus;
  onOpenSettings: (appId: string) => void;
}

function AppCard({ app, onOpenSettings }: AppCardProps) {
  const handleClick = () => {
    if (app.implemented) {
      onOpenSettings(app.id);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={!app.implemented}
      className="flex items-start gap-3 p-4 bg-secondary/20 rounded-lg hover:bg-secondary/40 transition-colors text-left cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-secondary/20"
    >
      <div className="flex items-center justify-center size-10 rounded-lg bg-secondary shrink-0 overflow-hidden">
        <Image
          src={app.logo}
          alt={`${app.name} logo`}
          width={24}
          height={24}
          className="object-contain"
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-medium text-sm">{app.name}</span>
          {app.connected && (
            <Badge variant="default" className="text-[10px]">
              Connected
            </Badge>
          )}
          {!app.implemented && (
            <Badge variant="outline" className="text-[10px]">
              Coming soon
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">
          {app.description}
        </p>
      </div>
    </button>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export default function AppsPage() {
  // App list state
  const [apps, setApps] = useState<AppWithStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<AppCategory>('popular');

  // Sheet state
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);

  // MailerLite state
  const [apiKey, setApiKey] = useState('');
  const [savedApiKey, setSavedApiKey] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);

  // Connections state
  const [connections, setConnections] = useState<MailerLiteConnection[]>([]);
  const [isSavingConnections, setIsSavingConnections] = useState(false);

  // Connection dialog state
  const [showConnectionDialog, setShowConnectionDialog] = useState(false);
  const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null);
  const [connectionFormId, setConnectionFormId] = useState('');
  const [connectionGroupId, setConnectionGroupId] = useState('');
  const [connectionGroupName, setConnectionGroupName] = useState('');
  const [connectionFieldMappings, setConnectionFieldMappings] = useState<MailerLiteFieldMapping[]>([
    { formField: '', mailerliteField: 'email' },
  ]);

  // Data for connection dialog selects
  const [groups, setGroups] = useState<MailerLiteGroup[]>([]);
  const [forms, setForms] = useState<FormSummary[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [isLoadingForms, setIsLoadingForms] = useState(false);

  // Disconnect state
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);

  // Delete connection state
  const [connectionToDelete, setConnectionToDelete] = useState<MailerLiteConnection | null>(null);

  // =========================================================================
  // Load apps on mount
  // =========================================================================

  useEffect(() => {
    fetchApps();
  }, []);

  const fetchApps = async () => {
    try {
      const response = await fetch('/ycode/api/apps');
      const result = await response.json();
      if (result.data) {
        setApps(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch apps:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // =========================================================================
  // App sheet open/close
  // =========================================================================

  const openAppSettings = (appId: string) => {
    setSelectedAppId(appId);

    if (appId === 'mailerlite') {
      loadMailerLiteSettings();
    }
  };

  const closeAppSettings = () => {
    setSelectedAppId(null);
    // Reset MailerLite state
    setApiKey('');
    setSavedApiKey('');
    setIsConnected(false);
    setConnections([]);
  };

  // =========================================================================
  // MailerLite settings
  // =========================================================================

  const loadMailerLiteSettings = async () => {
    setIsLoadingSettings(true);
    try {
      const response = await fetch('/ycode/api/apps/mailerlite/settings');
      const result = await response.json();

      if (result.data) {
        if (result.data.api_key) {
          setSavedApiKey(result.data.api_key);
          setApiKey(result.data.api_key);
          setIsConnected(true);
        }
        if (result.data.connections) {
          setConnections(result.data.connections);
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const handleTestApiKey = async () => {
    if (!apiKey.trim()) return;

    setIsTesting(true);
    try {
      const response = await fetch('/ycode/api/apps/mailerlite/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey.trim() }),
      });

      const result = await response.json();

      if (result.data?.valid) {
        toast.success('API key is valid');
      } else {
        toast.error(result.data?.error || 'Invalid API key');
      }
    } catch (error) {
      toast.error('Failed to test API key');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) return;

    setIsSavingKey(true);
    try {
      const response = await fetch('/ycode/api/apps/mailerlite/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey.trim() }),
      });

      const result = await response.json();

      if (result.data) {
        setSavedApiKey(apiKey.trim());
        setIsConnected(true);
        toast.success('API key saved');
        // Update app status in the list
        setApps((prev) =>
          prev.map((a) => (a.id === 'mailerlite' ? { ...a, connected: true } : a))
        );
      } else {
        toast.error(result.error || 'Failed to save API key');
      }
    } catch (error) {
      toast.error('Failed to save API key');
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await fetch('/ycode/api/apps/mailerlite/settings', {
        method: 'DELETE',
      });

      setApiKey('');
      setSavedApiKey('');
      setIsConnected(false);
      setConnections([]);
      setShowDisconnectDialog(false);
      toast.success('MailerLite disconnected');
      // Update app status in the list
      setApps((prev) =>
        prev.map((a) => (a.id === 'mailerlite' ? { ...a, connected: false } : a))
      );
    } catch (error) {
      toast.error('Failed to disconnect');
    }
  };

  // =========================================================================
  // Connection actions
  // =========================================================================

  const loadGroupsAndForms = useCallback(async () => {
    setIsLoadingGroups(true);
    setIsLoadingForms(true);

    try {
      const [groupsRes, formsRes] = await Promise.all([
        fetch('/ycode/api/apps/mailerlite/groups'),
        fetch('/ycode/api/form-submissions?summary=true'),
      ]);

      const groupsResult = await groupsRes.json();
      const formsResult = await formsRes.json();

      if (groupsResult.data) {
        setGroups(groupsResult.data);
      }
      if (formsResult.data) {
        setForms(formsResult.data);
      }
    } catch (error) {
      console.error('Failed to load groups/forms:', error);
      toast.error('Failed to load data for connection setup');
    } finally {
      setIsLoadingGroups(false);
      setIsLoadingForms(false);
    }
  }, []);

  const openConnectionDialog = (connection?: MailerLiteConnection) => {
    if (connection) {
      setEditingConnectionId(connection.id);
      setConnectionFormId(connection.formId);
      setConnectionGroupId(connection.groupId);
      setConnectionGroupName(connection.groupName);
      setConnectionFieldMappings(
        connection.fieldMappings.length > 0
          ? connection.fieldMappings
          : [{ formField: '', mailerliteField: 'email' }]
      );
    } else {
      setEditingConnectionId(null);
      setConnectionFormId('');
      setConnectionGroupId('');
      setConnectionGroupName('');
      setConnectionFieldMappings([{ formField: '', mailerliteField: 'email' }]);
    }
    setShowConnectionDialog(true);
    loadGroupsAndForms();
  };

  const handleSaveConnection = async () => {
    if (!connectionFormId || !connectionGroupId) {
      toast.error('Please select a form and a group');
      return;
    }

    const emailMapping = connectionFieldMappings.find((m) => m.mailerliteField === 'email');
    if (!emailMapping || !emailMapping.formField) {
      toast.error('Email field mapping is required');
      return;
    }

    const validMappings = connectionFieldMappings.filter(
      (m) => m.formField && m.mailerliteField
    );

    const connection: MailerLiteConnection = {
      id: editingConnectionId || crypto.randomUUID(),
      formId: connectionFormId,
      groupId: connectionGroupId,
      groupName: connectionGroupName,
      fieldMappings: validMappings,
      enabled: true,
    };

    let updatedConnections: MailerLiteConnection[];

    if (editingConnectionId) {
      updatedConnections = connections.map((c) =>
        c.id === editingConnectionId ? { ...connection, enabled: c.enabled } : c
      );
    } else {
      updatedConnections = [...connections, connection];
    }

    setIsSavingConnections(true);
    try {
      const response = await fetch('/ycode/api/apps/mailerlite/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connections: updatedConnections }),
      });

      const result = await response.json();

      if (result.data) {
        setConnections(updatedConnections);
        setShowConnectionDialog(false);
        toast.success(editingConnectionId ? 'Connection updated' : 'Connection added');
      } else {
        toast.error(result.error || 'Failed to save connection');
      }
    } catch (error) {
      toast.error('Failed to save connection');
    } finally {
      setIsSavingConnections(false);
    }
  };

  const handleToggleConnection = async (connectionId: string, enabled: boolean) => {
    const updatedConnections = connections.map((c) =>
      c.id === connectionId ? { ...c, enabled } : c
    );

    try {
      await fetch('/ycode/api/apps/mailerlite/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connections: updatedConnections }),
      });

      setConnections(updatedConnections);
    } catch (error) {
      toast.error('Failed to update connection');
    }
  };

  const handleDeleteConnection = async () => {
    if (!connectionToDelete) return;

    const updatedConnections = connections.filter(
      (c) => c.id !== connectionToDelete.id
    );

    try {
      await fetch('/ycode/api/apps/mailerlite/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connections: updatedConnections }),
      });

      setConnections(updatedConnections);
      setConnectionToDelete(null);
      toast.success('Connection deleted');
    } catch (error) {
      toast.error('Failed to delete connection');
    }
  };

  // =========================================================================
  // Field mapping helpers
  // =========================================================================

  const addFieldMapping = () => {
    const usedFields = new Set(connectionFieldMappings.map((m) => m.mailerliteField));
    const availableField = MAILERLITE_SUBSCRIBER_FIELDS.find(
      (f) => !usedFields.has(f.key) && !f.required
    );

    setConnectionFieldMappings([
      ...connectionFieldMappings,
      { formField: '', mailerliteField: availableField?.key || '' },
    ]);
  };

  const removeFieldMapping = (index: number) => {
    setConnectionFieldMappings(connectionFieldMappings.filter((_, i) => i !== index));
  };

  const updateFieldMapping = (
    index: number,
    field: 'formField' | 'mailerliteField',
    value: string
  ) => {
    const updated = [...connectionFieldMappings];
    updated[index] = { ...updated[index], [field]: value };
    setConnectionFieldMappings(updated);
  };

  // =========================================================================
  // Render
  // =========================================================================

  // Derived data
  const connectedApps = apps.filter((app) => app.connected);
  const connectedIds = new Set(connectedApps.map((app) => app.id));
  const filteredApps = apps.filter(
    (app) => !connectedIds.has(app.id) && app.categories.includes(selectedCategory)
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto">

        <header className="pt-8 pb-3">
          <span className="text-base font-medium">Apps</span>
        </header>

        <p className="text-sm text-muted-foreground mb-6">
          Connect third-party apps and services to extend your website&apos;s functionality.
        </p>

        {/* Connected Apps Section */}
        {connectedApps.length > 0 && (
          <div className="mb-8">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Connected
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {connectedApps.map((app) => (
                <AppCard
                  key={app.id}
                  app={app}
                  onOpenSettings={openAppSettings}
                />
              ))}
            </div>
          </div>
        )}

        {/* All Apps Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              All Apps
            </h3>
            <Select
              value={selectedCategory}
              onValueChange={(value) => setSelectedCategory(value as AppCategory)}
            >
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {APP_CATEGORIES.map((cat) => (
                  <SelectItem
                    key={cat.value}
                    value={cat.value}
                  >
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filteredApps.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm border border-dashed rounded-lg">
              No apps in this category yet.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filteredApps.map((app) => (
                <AppCard
                  key={app.id}
                  app={app}
                  onOpenSettings={openAppSettings}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* App Settings Sheet */}
      <Sheet
        open={!!selectedAppId}
        onOpenChange={(open) => {
          if (!open) closeAppSettings();
        }}
      >
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {selectedAppId === 'mailerlite' && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 mr-auto">
                  MailerLite
                  {isConnected && (
                    <Badge variant="default" className="text-[10px]">
                      Connected
                    </Badge>
                  )}
                </SheetTitle>
                <SheetDescription className="sr-only">
                  MailerLite integration settings
                </SheetDescription>
              </SheetHeader>

              {isLoadingSettings ? (
                <div className="flex items-center justify-center py-12">
                  <Spinner />
                </div>
              ) : (
                <div className="mt-6 space-y-8">

                  {/* API Key Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <FieldLegend>API Key</FieldLegend>
                      {isConnected && (
                        <Button
                          variant="secondary"
                          size="xs"
                          onClick={() => setShowDisconnectDialog(true)}
                        >
                          Disconnect
                        </Button>
                      )}
                    </div>
                    <FieldDescription>
                      Enter your MailerLite API key. Find it in{' '}
                      <span className="text-foreground">MailerLite &rarr; Integrations &rarr; API</span>.
                    </FieldDescription>

                    <Field>
                      <FieldLabel htmlFor="api-key">API Key</FieldLabel>
                      <Input
                        id="api-key"
                        type="password"
                        placeholder="Enter your MailerLite API key"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className="font-mono text-xs"
                      />
                      <div className="flex gap-2 mt-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleTestApiKey}
                          disabled={!apiKey.trim() || isTesting}
                        >
                          {isTesting ? 'Testing...' : 'Test connection'}
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSaveApiKey}
                          disabled={!apiKey.trim() || apiKey === savedApiKey || isSavingKey}
                        >
                          {isSavingKey ? 'Saving...' : 'Save'}
                        </Button>
                      </div>
                    </Field>
                  </div>

                  {/* Connections Section */}
                  {isConnected && (
                    <div className="space-y-4 border-t pt-6">
                      <div className="flex items-center justify-between">
                        <FieldLegend>Connections</FieldLegend>
                        <Button
                          variant="secondary"
                          size="xs"
                          onClick={() => openConnectionDialog()}
                        >
                          <Icon name="plus" className="size-3 mr-1" />
                          Add
                        </Button>
                      </div>
                      <FieldDescription>
                        Map form submissions to MailerLite subscriber groups.
                      </FieldDescription>

                      {connections.length > 0 ? (
                        <div className="divide-y">
                          {connections.map((connection) => (
                            <div
                              key={connection.id}
                              className="py-3 flex items-center gap-3"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <Label className="font-medium text-xs">
                                    {connection.formId}
                                  </Label>
                                  <span className="text-muted-foreground text-xs">&rarr;</span>
                                  <span className="text-xs text-muted-foreground truncate">
                                    {connection.groupName}
                                  </span>
                                </div>
                                <div className="text-[11px] text-muted-foreground">
                                  {connection.fieldMappings.length} field{connection.fieldMappings.length !== 1 ? 's' : ''} mapped
                                </div>
                              </div>

                              <Switch
                                checked={connection.enabled}
                                onCheckedChange={(enabled) =>
                                  handleToggleConnection(connection.id, enabled)
                                }
                              />

                              <div className="flex gap-0.5">
                                <Button
                                  variant="ghost"
                                  size="xs"
                                  onClick={() => openConnectionDialog(connection)}
                                >
                                  <Icon name="pencil" className="size-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="xs"
                                  onClick={() => setConnectionToDelete(connection)}
                                >
                                  <Icon name="trash" className="size-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-6 text-center text-muted-foreground text-xs border border-dashed rounded-lg">
                          No connections yet. Add one to start sending form data to MailerLite.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Connection Dialog */}
      <Dialog
        open={showConnectionDialog}
        onOpenChange={setShowConnectionDialog}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingConnectionId ? 'Edit connection' : 'Add connection'}
            </DialogTitle>
            <DialogDescription>
              Map a Ycode form to a MailerLite subscriber group and configure field mappings.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-6">
            {/* Form Selection */}
            <Field>
              <FieldLabel>Ycode Form</FieldLabel>
              <FieldDescription>
                Select which form submissions should be sent to MailerLite.
              </FieldDescription>
              {isLoadingForms ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Spinner /> Loading forms...
                </div>
              ) : forms.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  No forms found. Submit a form first to see it here.
                </p>
              ) : (
                <Select
                  value={connectionFormId}
                  onValueChange={setConnectionFormId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a form" />
                  </SelectTrigger>
                  <SelectContent>
                    {forms.map((form) => (
                      <SelectItem
                        key={form.form_id}
                        value={form.form_id}
                      >
                        {form.form_id} ({form.submission_count} submissions)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>

            {/* Group Selection */}
            <Field>
              <FieldLabel>MailerLite Group</FieldLabel>
              <FieldDescription>
                New subscribers will be added to this group.
              </FieldDescription>
              {isLoadingGroups ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Spinner /> Loading groups...
                </div>
              ) : groups.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  No groups found. Create a group in MailerLite first.
                </p>
              ) : (
                <Select
                  value={connectionGroupId}
                  onValueChange={(value) => {
                    setConnectionGroupId(value);
                    const group = groups.find((g) => g.id === value);
                    setConnectionGroupName(group?.name || '');
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a group" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((group) => (
                      <SelectItem
                        key={group.id}
                        value={group.id}
                      >
                        {group.name} ({group.active_count} subscribers)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>

            {/* Field Mappings */}
            <Field>
              <div className="flex items-center justify-between">
                <FieldLabel>Field Mappings</FieldLabel>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={addFieldMapping}
                  disabled={connectionFieldMappings.length >= MAILERLITE_SUBSCRIBER_FIELDS.length}
                >
                  <Icon name="plus" className="size-3 mr-1" />
                  Add field
                </Button>
              </div>
              <FieldDescription>
                Map your form fields to MailerLite subscriber fields. Email is required.
              </FieldDescription>

              <div className="space-y-2 mt-2">
                <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-2 items-center text-xs text-muted-foreground px-1">
                  <span>Form field name</span>
                  <span />
                  <span>MailerLite field</span>
                  <span className="w-7" />
                </div>

                {connectionFieldMappings.map((mapping, index) => {
                  const isEmailField = mapping.mailerliteField === 'email';

                  return (
                    <div
                      key={index}
                      className="grid grid-cols-[1fr_auto_1fr_auto] gap-2 items-center"
                    >
                      <Input
                        placeholder="e.g., email, name"
                        value={mapping.formField}
                        onChange={(e) =>
                          updateFieldMapping(index, 'formField', e.target.value)
                        }
                        className="text-xs"
                      />

                      <Icon
                        name="arrowLeft"
                        className="size-3 text-muted-foreground rotate-180"
                      />

                      <Select
                        value={mapping.mailerliteField}
                        onValueChange={(value) =>
                          updateFieldMapping(index, 'mailerliteField', value)
                        }
                      >
                        <SelectTrigger className="text-xs">
                          <SelectValue placeholder="Select field" />
                        </SelectTrigger>
                        <SelectContent>
                          {MAILERLITE_SUBSCRIBER_FIELDS.map((field) => (
                            <SelectItem
                              key={field.key}
                              value={field.key}
                            >
                              {field.label}
                              {field.required && ' *'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <div className="w-7 flex justify-center">
                        {!isEmailField && (
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => removeFieldMapping(index)}
                          >
                            <Icon name="x" className="size-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Field>
          </div>

          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setShowConnectionDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveConnection}
              disabled={
                !connectionFormId ||
                !connectionGroupId ||
                !connectionFieldMappings.some(
                  (m) => m.mailerliteField === 'email' && m.formField
                ) ||
                isSavingConnections
              }
            >
              {isSavingConnections
                ? 'Saving...'
                : editingConnectionId
                  ? 'Save changes'
                  : 'Add connection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disconnect Confirmation Dialog */}
      <ConfirmDialog
        open={showDisconnectDialog}
        onOpenChange={setShowDisconnectDialog}
        title="Disconnect MailerLite?"
        description="This will remove your API key and all connections. Form submissions will no longer be sent to MailerLite."
        confirmLabel="Disconnect"
        cancelLabel="Cancel"
        confirmVariant="destructive"
        onConfirm={handleDisconnect}
        onCancel={() => setShowDisconnectDialog(false)}
      />

      {/* Delete Connection Confirmation Dialog */}
      <ConfirmDialog
        open={!!connectionToDelete}
        onOpenChange={(open) => {
          if (!open) setConnectionToDelete(null);
        }}
        title="Delete connection?"
        description={`This will remove the connection between form "${connectionToDelete?.formId}" and MailerLite group "${connectionToDelete?.groupName}".`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmVariant="destructive"
        onConfirm={handleDeleteConnection}
        onCancel={() => setConnectionToDelete(null)}
      />
    </div>
  );
}
