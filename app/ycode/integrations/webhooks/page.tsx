'use client';

import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import {
  Field,
  FieldDescription,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import Icon from '@/components/ui/icon';
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

interface WebhookFilters {
  form_id?: string | null;
  collection_id?: string | null;
}

interface Webhook {
  id: string;
  name: string;
  url: string;
  secret: string | null;
  events: WebhookEventType[];
  filters: WebhookFilters | null;
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
];

// =============================================================================
// Component
// =============================================================================

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Create/Edit webhook sheet
  const [showWebhookSheet, setShowWebhookSheet] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);
  const [webhookName, setWebhookName] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookEvent, setWebhookEvent] = useState<WebhookEventType | ''>('');
  const [webhookFilterFormId, setWebhookFilterFormId] = useState<string>('');
  const [webhookFilterCollectionId, setWebhookFilterCollectionId] = useState<string>('');
  const [generateSecret, setGenerateSecret] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Filter select data
  const [forms, setForms] = useState<{ form_id: string; submission_count: number }[]>([]);
  const [collections, setCollections] = useState<{ id: string; name: string }[]>([]);
  const [isLoadingFilterData, setIsLoadingFilterData] = useState(false);

  // Secret display dialog
  const [showSecretDialog, setShowSecretDialog] = useState(false);
  const [createdWebhook, setCreatedWebhook] = useState<Webhook | null>(null);
  const [copied, setCopied] = useState(false);

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

  const handleSaveWebhook = async () => {
    if (!webhookName.trim() || !webhookUrl.trim() || !webhookEvent) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSaving(true);
    try {
      const isEditing = !!editingWebhook;
      const url = isEditing
        ? `/ycode/api/webhooks/${editingWebhook.id}`
        : '/ycode/api/webhooks';
      const method = isEditing ? 'PUT' : 'POST';

      // Build filters object (only include non-empty values)
      const filters: WebhookFilters = {};
      if (webhookFilterFormId) filters.form_id = webhookFilterFormId;
      if (webhookFilterCollectionId) filters.collection_id = webhookFilterCollectionId;
      const hasFilters = Object.keys(filters).length > 0;

      const body = isEditing
        ? { name: webhookName.trim(), url: webhookUrl.trim(), events: [webhookEvent], filters: hasFilters ? filters : null }
        : { name: webhookName.trim(), url: webhookUrl.trim(), events: [webhookEvent], filters: hasFilters ? filters : null, generateSecret };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Failed to ${isEditing ? 'update' : 'create'} webhook`);
      }

      if (result.data) {
        if (isEditing) {
          setWebhooks((prev) =>
            prev.map((w) => (w.id === editingWebhook.id ? result.data : w))
          );
          toast.success('Webhook updated');
        } else {
          setWebhooks((prev) => [result.data, ...prev]);
          // Show secret if generated
          if (result.data.generated_secret) {
            setCreatedWebhook(result.data);
            setShowSecretDialog(true);
          } else {
            toast.success('Webhook created');
          }
        }
        closeWebhookSheet();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save webhook');
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

  const loadFilterData = async () => {
    setIsLoadingFilterData(true);
    try {
      const [formsRes, collectionsRes] = await Promise.all([
        fetch('/ycode/api/form-submissions?summary=true'),
        fetch('/ycode/api/collections'),
      ]);
      const formsResult = await formsRes.json();
      const collectionsResult = await collectionsRes.json();
      if (formsResult.data) setForms(formsResult.data);
      if (collectionsResult.data) setCollections(collectionsResult.data);
    } catch (error) {
      console.error('Failed to load filter data:', error);
    } finally {
      setIsLoadingFilterData(false);
    }
  };

  const openCreateSheet = () => {
    setEditingWebhook(null);
    setWebhookName('');
    setWebhookUrl('');
    setWebhookEvent('');
    setWebhookFilterFormId('');
    setWebhookFilterCollectionId('');
    setGenerateSecret(true);
    setShowWebhookSheet(true);
    loadFilterData();
  };

  const openEditSheet = (webhook: Webhook) => {
    setEditingWebhook(webhook);
    setWebhookName(webhook.name);
    setWebhookUrl(webhook.url);
    setWebhookEvent(webhook.events[0] || '');
    setWebhookFilterFormId(webhook.filters?.form_id || '');
    setWebhookFilterCollectionId(webhook.filters?.collection_id || '');
    setShowWebhookSheet(true);
    loadFilterData();
  };

  const closeWebhookSheet = () => {
    setShowWebhookSheet(false);
    setEditingWebhook(null);
    setWebhookName('');
    setWebhookUrl('');
    setWebhookEvent('');
    setWebhookFilterFormId('');
    setWebhookFilterCollectionId('');
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
        <header className="pt-8 pb-3 flex items-center justify-between">
          <span className="text-base font-medium">Webhooks</span>
          <Button
            variant="secondary"
            size="sm"
            onClick={openCreateSheet}
          >
            Create webhook
          </Button>
        </header>

        <p className="text-sm text-muted-foreground mb-6">
          Receive real-time notifications when events occur in your Ycode site.
        </p>

        {isLoading ? (
          <div className="py-12 flex justify-center">
            <Spinner />
          </div>
        ) : webhooks.length > 0 ? (
          <div className="flex flex-col gap-3">
            {webhooks.map((webhook) => (
              <div
                key={webhook.id}
                className="p-4 bg-secondary/20 rounded-lg"
              >
                {/* Top row: title + events on left, controls on right */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
                    <Label className="font-medium">{webhook.name}</Label>
                    {webhook.failure_count > 0 && (
                      <Badge variant="destructive">
                        {webhook.failure_count} failures
                      </Badge>
                    )}
                    {webhook.events.slice(0, 3).map((event) => (
                      <Badge
                        key={event}
                        variant="secondary"
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

                  <div className="flex items-center gap-2 shrink-0">
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
                        <DropdownMenuItem onClick={() => openEditSheet(webhook)}>
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
                </div>

                {/* Bottom row: URL on left, last triggered on right */}
                <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2 truncate mr-4">
                    <span className="truncate">{webhook.url}</span>
                    {webhook.filters?.form_id && (
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        Form: {webhook.filters.form_id}
                      </Badge>
                    )}
                    {webhook.filters?.collection_id && (
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        Collection: {collections.find((c) => c.id === webhook.filters?.collection_id)?.name || webhook.filters.collection_id.slice(0, 8)}
                      </Badge>
                    )}
                  </div>
                  <span className="shrink-0">Last triggered: {formatRelativeTime(webhook.last_triggered_at)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-muted-foreground text-sm border border-dashed rounded-lg">
            No webhooks configured yet. Click &ldquo;Create webhook&rdquo; to get started.
          </div>
        )}

        {/* TODO: Uncomment when Webhooks Documentation is ready for release */}
        {/* <header className="pt-10 pb-3">
          <span className="text-base font-medium">Documentation</span>
        </header> */}
      </div>

      {/* Create/Edit Webhook Sheet */}
      <Sheet
        open={showWebhookSheet}
        onOpenChange={(open) => {
          if (!open) closeWebhookSheet();
        }}
      >
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="mr-auto">
              {editingWebhook ? 'Edit webhook' : 'Create webhook'}
            </SheetTitle>
            <SheetDescription className="sr-only">
              {editingWebhook ? 'Update webhook configuration.' : 'Configure a new webhook endpoint.'}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 flex flex-col gap-6">
            <Field>
              <FieldLabel htmlFor="webhook-name">Name</FieldLabel>
              <Input
                id="webhook-name"
                placeholder="e.g., Form Notifications"
                value={webhookName}
                onChange={(e) => setWebhookName(e.target.value)}
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
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel>Event</FieldLabel>
              <FieldDescription>
                Select which event should trigger this webhook.
              </FieldDescription>
              <Select
                value={webhookEvent}
                onValueChange={(value) => {
                  setWebhookEvent(value as WebhookEventType);
                  // Clear resource filters when event type changes
                  setWebhookFilterFormId('');
                  setWebhookFilterCollectionId('');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an event" />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((event) => (
                    <SelectItem
                      key={event.value}
                      value={event.value}
                    >
                      {event.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {/* Resource Filters - show based on selected event */}
            {webhookEvent === 'form.submitted' && (
              <Field>
                <FieldLabel>Form filter</FieldLabel>
                <FieldDescription>
                  Only trigger for a specific form, or leave as &ldquo;All forms&rdquo;.
                </FieldDescription>
                {isLoadingFilterData ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Spinner /> Loading forms...
                  </div>
                ) : (
                  <Select
                    value={webhookFilterFormId}
                    onValueChange={(value) => setWebhookFilterFormId(value === '__all__' ? '' : value)}
                  >
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="All forms" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All forms</SelectItem>
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
            )}

            {(webhookEvent === 'collection_item.created' ||
              webhookEvent === 'collection_item.updated' ||
              webhookEvent === 'collection_item.deleted') && (
              <Field>
                <FieldLabel>Collection filter</FieldLabel>
                <FieldDescription>
                  Only trigger for a specific collection, or leave as &ldquo;All collections&rdquo;.
                </FieldDescription>
                {isLoadingFilterData ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Spinner /> Loading collections...
                  </div>
                ) : (
                  <Select
                    value={webhookFilterCollectionId}
                    onValueChange={(value) => setWebhookFilterCollectionId(value === '__all__' ? '' : value)}
                  >
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="All collections" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All collections</SelectItem>
                      {collections.map((collection) => (
                        <SelectItem
                          key={collection.id}
                          value={collection.id}
                        >
                          {collection.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>
            )}

            {!editingWebhook && (
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
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleSaveWebhook}
                disabled={!webhookName.trim() || !webhookUrl.trim() || !webhookEvent || isSaving}
              >
                {isSaving
                  ? 'Saving...'
                  : editingWebhook
                    ? 'Save changes'
                    : 'Create webhook'}
              </Button>
              <Button
                variant="secondary"
                onClick={closeWebhookSheet}
              >
                Cancel
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

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
