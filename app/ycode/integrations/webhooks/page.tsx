'use client';

import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import {
  Field,
  FieldDescription,
  FieldLabel,
  FieldLegend,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import Icon from '@/components/ui/icon';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';

// =============================================================================
// Types
// =============================================================================

type WebhookEventType =
  | 'form.submitted'
  | 'site.published'
  | 'collection_item.created'
  | 'collection_item.updated'
  | 'collection_item.deleted'
  | 'page.created'
  | 'page.updated'
  | 'page.published'
  | 'page.deleted'
  | 'asset.uploaded'
  | 'asset.deleted';

interface Webhook {
  id: string;
  name: string;
  url: string;
  secret: string | null;
  events: WebhookEventType[];
  enabled: boolean;
  last_triggered_at: string | null;
  failure_count: number;
  created_at: string;
  updated_at: string;
  generated_secret?: string; // Only present on creation
}

interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  response_status: number | null;
  response_body: string | null;
  status: 'pending' | 'success' | 'failed';
  attempts: number;
  duration_ms: number | null;
  created_at: string;
}

// Event type labels for UI
const EVENT_TYPES: { value: WebhookEventType; label: string; description: string }[] = [
  { value: 'form.submitted', label: 'Form Submitted', description: 'When a form submission is received' },
  { value: 'site.published', label: 'Site Published', description: 'When the site is published' },
  { value: 'collection_item.created', label: 'Collection Item Created', description: 'When a CMS item is created' },
  { value: 'collection_item.updated', label: 'Collection Item Updated', description: 'When a CMS item is updated' },
  { value: 'collection_item.deleted', label: 'Collection Item Deleted', description: 'When a CMS item is deleted' },
  { value: 'page.created', label: 'Page Created', description: 'When a page is created' },
  { value: 'page.published', label: 'Page Published', description: 'When a page is published' },
  { value: 'asset.uploaded', label: 'Asset Uploaded', description: 'When an asset is uploaded' },
];

// =============================================================================
// Component
// =============================================================================

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Create webhook dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newWebhookName, setNewWebhookName] = useState('');
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [newWebhookEvents, setNewWebhookEvents] = useState<Set<WebhookEventType>>(new Set());
  const [generateSecret, setGenerateSecret] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // Secret display dialog
  const [showSecretDialog, setShowSecretDialog] = useState(false);
  const [createdWebhook, setCreatedWebhook] = useState<Webhook | null>(null);
  const [copied, setCopied] = useState(false);

  // Edit webhook dialog
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);
  const [editName, setEditName] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editEvents, setEditEvents] = useState<Set<WebhookEventType>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  // Delete dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [webhookToDelete, setWebhookToDelete] = useState<Webhook | null>(null);

  // Test webhook
  const [testingWebhookId, setTestingWebhookId] = useState<string | null>(null);

  // Deliveries sheet
  const [showDeliveriesSheet, setShowDeliveriesSheet] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [isLoadingDeliveries, setIsLoadingDeliveries] = useState(false);

  // Fetch webhooks on mount
  useEffect(() => {
    fetchWebhooks();
  }, []);

  const fetchWebhooks = async () => {
    try {
      const response = await fetch('/ycode/api/webhooks');
      const result = await response.json();
      if (result.data) {
        setWebhooks(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch webhooks:', error);
      toast.error('Failed to load webhooks');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateWebhook = async () => {
    if (!newWebhookName.trim() || !newWebhookUrl.trim() || newWebhookEvents.size === 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch('/ycode/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newWebhookName.trim(),
          url: newWebhookUrl.trim(),
          events: Array.from(newWebhookEvents),
          generateSecret,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create webhook');
      }

      if (result.data) {
        setWebhooks((prev) => [result.data, ...prev]);
        setShowCreateDialog(false);
        resetCreateForm();

        // Show secret if generated
        if (result.data.generated_secret) {
          setCreatedWebhook(result.data);
          setShowSecretDialog(true);
        } else {
          toast.success('Webhook created');
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create webhook');
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateWebhook = async () => {
    if (!editingWebhook || !editName.trim() || !editUrl.trim() || editEvents.size === 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/ycode/api/webhooks/${editingWebhook.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          url: editUrl.trim(),
          events: Array.from(editEvents),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update webhook');
      }

      if (result.data) {
        setWebhooks((prev) =>
          prev.map((w) => (w.id === editingWebhook.id ? result.data : w))
        );
        setShowEditDialog(false);
        setEditingWebhook(null);
        toast.success('Webhook updated');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update webhook');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteWebhook = async () => {
    if (!webhookToDelete) return;

    try {
      const response = await fetch(`/ycode/api/webhooks/${webhookToDelete.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to delete webhook');
      }

      setWebhooks((prev) => prev.filter((w) => w.id !== webhookToDelete.id));
      toast.success('Webhook deleted');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete webhook');
    } finally {
      setShowDeleteDialog(false);
      setWebhookToDelete(null);
    }
  };

  const handleToggleEnabled = async (webhook: Webhook) => {
    try {
      const response = await fetch(`/ycode/api/webhooks/${webhook.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !webhook.enabled }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update webhook');
      }

      setWebhooks((prev) =>
        prev.map((w) => (w.id === webhook.id ? { ...w, enabled: !webhook.enabled } : w))
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update webhook');
    }
  };

  const handleTestWebhook = async (webhook: Webhook) => {
    setTestingWebhookId(webhook.id);
    try {
      const response = await fetch(`/ycode/api/webhooks/${webhook.id}`, {
        method: 'POST',
      });

      const result = await response.json();

      if (result.data?.success) {
        toast.success(`Test sent in ${result.data.duration_ms}ms`);
      } else {
        toast.error(result.data?.message || 'Test failed');
      }

      // Refresh webhooks to update last_triggered_at
      fetchWebhooks();
    } catch (error) {
      toast.error('Failed to send test webhook');
    } finally {
      setTestingWebhookId(null);
    }
  };

  const handleViewDeliveries = async (webhook: Webhook) => {
    setSelectedWebhook(webhook);
    setShowDeliveriesSheet(true);
    setIsLoadingDeliveries(true);

    try {
      const response = await fetch(`/ycode/api/webhooks/${webhook.id}/deliveries?limit=20`);
      const result = await response.json();

      if (result.data) {
        setDeliveries(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch deliveries:', error);
      toast.error('Failed to load delivery logs');
    } finally {
      setIsLoadingDeliveries(false);
    }
  };

  const openEditDialog = (webhook: Webhook) => {
    setEditingWebhook(webhook);
    setEditName(webhook.name);
    setEditUrl(webhook.url);
    setEditEvents(new Set(webhook.events));
    setShowEditDialog(true);
  };

  const resetCreateForm = () => {
    setNewWebhookName('');
    setNewWebhookUrl('');
    setNewWebhookEvents(new Set());
    setGenerateSecret(true);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatRelativeTime = (dateString: string | null) => {
    if (!dateString) return 'Never';

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return formatDate(dateString);
  };

  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto">
        <header className="pt-8 pb-3">
          <span className="text-base font-medium">Webhooks</span>
        </header>

        <div className="flex flex-col gap-6 bg-secondary/20 p-8 rounded-lg">
          <header className="flex justify-between">
            <div>
              <FieldLegend>Webhooks</FieldLegend>
              <FieldDescription>
                Receive real-time notifications when events occur in your Ycode site.
                Webhooks are sent as POST requests with a JSON payload.
              </FieldDescription>
            </div>

            <div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowCreateDialog(true)}
              >
                Create webhook
              </Button>
            </div>
          </header>

          {isLoading ? (
            <div className="border-t pt-8 pb-4 flex justify-center">
              <Spinner />
            </div>
          ) : webhooks.length > 0 ? (
            <div className="border-t -mb-4 divide-y">
              {webhooks.map((webhook) => (
                <div key={webhook.id} className="py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <Label className="font-medium">{webhook.name}</Label>
                      {!webhook.enabled && (
                        <Badge variant="outline" className="text-muted-foreground">
                          Disabled
                        </Badge>
                      )}
                      {webhook.failure_count > 0 && (
                        <Badge variant="destructive">
                          {webhook.failure_count} failures
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate mb-1">
                      {webhook.url}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {webhook.events.slice(0, 3).map((event) => (
                        <Badge
                          key={event} variant="secondary"
                          className="text-[10px]"
                        >
                          {event}
                        </Badge>
                      ))}
                      {webhook.events.length > 3 && (
                        <Badge variant="secondary" className="text-[10px]">
                          +{webhook.events.length - 3} more
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">
                      Last triggered: {formatRelativeTime(webhook.last_triggered_at)}
                    </div>
                  </div>

                  <Switch
                    checked={webhook.enabled}
                    onCheckedChange={() => handleToggleEnabled(webhook)}
                  />

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="secondary" size="xs">
                        <Icon name="more" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleTestWebhook(webhook)}
                        disabled={testingWebhookId === webhook.id}
                      >
                        {testingWebhookId === webhook.id ? 'Sending...' : 'Send test'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleViewDeliveries(webhook)}>
                        View deliveries
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => openEditDialog(webhook)}>
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => {
                          setWebhookToDelete(webhook);
                          setShowDeleteDialog(true);
                        }}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          ) : (
            <div className="border-t pt-8 pb-4 text-center text-muted-foreground text-sm">
              No webhooks configured yet. Click &ldquo;Create webhook&rdquo; to get started.
            </div>
          )}
        </div>

        {/* Documentation */}
        <header className="pt-10 pb-3">
          <span className="text-base font-medium">Documentation</span>
        </header>

        <div className="flex flex-col gap-6 bg-secondary/20 p-8 rounded-lg text-sm">
          <section>
            <h3 className="font-medium mb-2">Payload Format</h3>
            <p className="text-muted-foreground mb-3">
              Webhooks are sent as POST requests with a JSON body:
            </p>
            <pre className="bg-secondary p-3 rounded-lg text-xs overflow-x-auto">
{`{
  "event": "form.submitted",
  "timestamp": "2026-02-05T10:30:00.000Z",
  "data": {
    "form_id": "contact",
    "submission_id": "uuid",
    "fields": { ... }
  }
}`}
            </pre>
          </section>

          <section>
            <h3 className="font-medium mb-2">Signature Verification</h3>
            <p className="text-muted-foreground mb-3">
              If you configure a secret, requests include an HMAC-SHA256 signature in the{' '}
              <code className="bg-secondary px-1 py-0.5 rounded">X-Ycode-Signature</code> header:
            </p>
            <pre className="bg-secondary p-3 rounded-lg text-xs overflow-x-auto">
{`X-Ycode-Signature: sha256=<signature>
X-Ycode-Event: form.submitted
X-Ycode-Delivery: <delivery-id>`}
            </pre>
            <p className="text-muted-foreground mt-3 text-xs">
              Verify by computing{' '}
              <code className="bg-secondary px-1 py-0.5 rounded">
                HMAC-SHA256(secret, request_body)
              </code>{' '}
              and comparing with the signature.
            </p>
          </section>
        </div>
      </div>

      {/* Create Webhook Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create webhook</DialogTitle>
            <DialogDescription>
              Configure a new webhook endpoint to receive event notifications.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-6">
            <Field>
              <FieldLabel htmlFor="webhook-name">Name</FieldLabel>
              <Input
                id="webhook-name"
                placeholder="e.g., Form Notifications"
                value={newWebhookName}
                onChange={(e) => setNewWebhookName(e.target.value)}
                autoFocus
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="webhook-url">URL</FieldLabel>
              <FieldDescription>
                The endpoint that will receive webhook POST requests.
              </FieldDescription>
              <Input
                id="webhook-url"
                type="url"
                placeholder="https://example.com/webhook"
                value={newWebhookUrl}
                onChange={(e) => setNewWebhookUrl(e.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel>Events</FieldLabel>
              <FieldDescription>
                Select which events should trigger this webhook.
              </FieldDescription>
              <div className="border rounded-lg p-3 space-y-2 max-h-[200px] overflow-y-auto mt-2">
                {EVENT_TYPES.map((event) => (
                  <div key={event.value} className="flex items-start gap-2">
                    <Checkbox
                      id={`event-${event.value}`}
                      checked={newWebhookEvents.has(event.value)}
                      onCheckedChange={(checked) => {
                        setNewWebhookEvents((prev) => {
                          const next = new Set(prev);
                          if (checked) {
                            next.add(event.value);
                          } else {
                            next.delete(event.value);
                          }
                          return next;
                        });
                      }}
                    />
                    <label
                      htmlFor={`event-${event.value}`}
                      className="text-sm cursor-pointer leading-tight"
                    >
                      <div className="font-medium">{event.label}</div>
                      <div className="text-xs text-muted-foreground">{event.description}</div>
                    </label>
                  </div>
                ))}
              </div>
            </Field>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="generate-secret" className="text-sm">
                  Generate signing secret
                </Label>
                <p className="text-xs text-muted-foreground">
                  Recommended for security
                </p>
              </div>
              <Switch
                id="generate-secret"
                checked={generateSecret}
                onCheckedChange={setGenerateSecret}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => {
                setShowCreateDialog(false);
                resetCreateForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateWebhook}
              disabled={!newWebhookName.trim() || !newWebhookUrl.trim() || newWebhookEvents.size === 0 || isCreating}
            >
              {isCreating ? 'Creating...' : 'Create webhook'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Secret Display Dialog */}
      <Dialog
        open={showSecretDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowSecretDialog(false);
            setCreatedWebhook(null);
            setCopied(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Webhook created</DialogTitle>
            <DialogDescription>
              Copy your signing secret now. You won&apos;t be able to see it again.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="p-4 bg-secondary rounded-lg">
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm font-mono break-all">
                  {createdWebhook?.generated_secret}
                </code>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    createdWebhook?.generated_secret &&
                    copyToClipboard(createdWebhook.generated_secret)
                  }
                >
                  {copied ? (
                    <>
                      <Icon name="check" className="size-3.5 mr-1" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Icon name="copy" className="size-3.5 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              <strong>Important:</strong> Store this secret securely. Use it to verify
              webhook signatures on your server.
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                setShowSecretDialog(false);
                setCreatedWebhook(null);
                setCopied(false);
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Webhook Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit webhook</DialogTitle>
            <DialogDescription>
              Update webhook configuration.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-6">
            <Field>
              <FieldLabel htmlFor="edit-name">Name</FieldLabel>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="edit-url">URL</FieldLabel>
              <Input
                id="edit-url"
                type="url"
                value={editUrl}
                onChange={(e) => setEditUrl(e.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel>Events</FieldLabel>
              <div className="border rounded-lg p-3 space-y-2 max-h-[200px] overflow-y-auto mt-2">
                {EVENT_TYPES.map((event) => (
                  <div key={event.value} className="flex items-start gap-2">
                    <Checkbox
                      id={`edit-event-${event.value}`}
                      checked={editEvents.has(event.value)}
                      onCheckedChange={(checked) => {
                        setEditEvents((prev) => {
                          const next = new Set(prev);
                          if (checked) {
                            next.add(event.value);
                          } else {
                            next.delete(event.value);
                          }
                          return next;
                        });
                      }}
                    />
                    <label
                      htmlFor={`edit-event-${event.value}`}
                      className="text-sm cursor-pointer leading-tight"
                    >
                      <div className="font-medium">{event.label}</div>
                    </label>
                  </div>
                ))}
              </div>
            </Field>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateWebhook}
              disabled={!editName.trim() || !editUrl.trim() || editEvents.size === 0 || isSaving}
            >
              {isSaving ? 'Saving...' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete webhook?"
        description={`This will permanently delete the webhook "${webhookToDelete?.name}" and all its delivery logs.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmVariant="destructive"
        onConfirm={handleDeleteWebhook}
        onCancel={() => {
          setShowDeleteDialog(false);
          setWebhookToDelete(null);
        }}
      />

      {/* Deliveries Sheet */}
      <Sheet open={showDeliveriesSheet} onOpenChange={setShowDeliveriesSheet}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Delivery Logs</SheetTitle>
            <SheetDescription>
              Recent webhook deliveries for {selectedWebhook?.name}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6">
            {isLoadingDeliveries ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : deliveries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No deliveries yet
              </div>
            ) : (
              <div className="space-y-3">
                {deliveries.map((delivery) => (
                  <div
                    key={delivery.id}
                    className="border rounded-lg p-3 text-sm"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Badge
                        variant={
                          delivery.status === 'success'
                            ? 'default'
                            : delivery.status === 'failed'
                              ? 'destructive'
                              : 'secondary'
                        }
                      >
                        {delivery.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(delivery.created_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{delivery.event_type}</span>
                      {delivery.response_status && (
                        <>
                          <span>•</span>
                          <span>HTTP {delivery.response_status}</span>
                        </>
                      )}
                      {delivery.duration_ms && (
                        <>
                          <span>•</span>
                          <span>{delivery.duration_ms}ms</span>
                        </>
                      )}
                    </div>
                    {delivery.response_body && delivery.status === 'failed' && (
                      <div className="mt-2 p-2 bg-secondary rounded text-xs font-mono break-all">
                        {delivery.response_body.slice(0, 200)}
                        {delivery.response_body.length > 200 && '...'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
