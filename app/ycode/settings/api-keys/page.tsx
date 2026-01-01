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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  api_key?: string; // Only present when newly created
  last_used_at: string | null;
  created_at: string;
}

export default function ApiKeysSettingsPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [showKeyDialog, setShowKeyDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<ApiKey | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<ApiKey | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch API keys on mount
  useEffect(() => {
    fetchApiKeys();
  }, []);

  const fetchApiKeys = async () => {
    try {
      const response = await fetch('/api/api-keys');
      const result = await response.json();
      if (result.data) {
        setApiKeys(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch API keys:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateKey = async () => {
    if (!newKeyName.trim()) return;

    setIsGenerating(true);
    try {
      const response = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });

      const result = await response.json();
      if (result.data) {
        setGeneratedKey(result.data);
        setShowGenerateDialog(false);
        setShowKeyDialog(true);
        setNewKeyName('');
        // Refresh the list
        fetchApiKeys();
      }
    } catch (error) {
      console.error('Failed to generate API key:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteKey = async () => {
    if (!keyToDelete) return;

    try {
      await fetch(`/api/api-keys/${keyToDelete.id}`, {
        method: 'DELETE',
      });
      setApiKeys(apiKeys.filter(k => k.id !== keyToDelete.id));
    } catch (error) {
      console.error('Failed to delete API key:', error);
    } finally {
      setShowDeleteDialog(false);
      setKeyToDelete(null);
    }
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
    });
  };

  const formatLastUsed = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return formatDate(dateString);
  };

  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto">

        <header className="pt-8 pb-3">
          <span className="text-base font-medium">API keys</span>
        </header>

        <div className="flex flex-col gap-6 bg-secondary/20 p-8 rounded-lg">

          <header className="flex justify-between">

            <div>
              <FieldLegend>
                API keys
              </FieldLegend>
              <FieldDescription>
                Manage API keys for accessing your site&apos;s public API. Keys are used to authenticate requests to <code className="text-xs bg-secondary px-1 py-0.5 rounded">/api/v1/*</code> endpoints.
              </FieldDescription>
            </div>

            <div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowGenerateDialog(true)}
              >
                Generate API key
              </Button>
            </div>

          </header>

          {isLoading ? (
            <div className="border-t pt-8 pb-4 text-center text-muted-foreground text-sm">
              Loading...
            </div>
          ) : apiKeys.length > 0 ? (
            <div className="border-t -mb-4 divide-y">
              {apiKeys.map((key) => (
                <div key={key.id} className="py-4 flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <Label className="font-medium">{key.name}</Label>
                      <code className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded font-mono">
                        {key.key_prefix}...
                      </code>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Created {formatDate(key.created_at)} · Last used: {formatLastUsed(key.last_used_at)}
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="secondary"
                        size="xs"
                      >
                        <Icon name="more" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => {
                          setKeyToDelete(key);
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
              No API keys yet. Click &ldquo;Generate API key&rdquo; to create one.
            </div>
          )}

        </div>

        {/* API Documentation */}
        <header className="pt-8 pb-3">
          <span className="text-base font-medium">Documentation</span>
        </header>

        <div className="flex flex-col gap-6 bg-secondary/20 p-8 rounded-lg">
          
          {/* Authentication */}
          <div>
            <FieldLegend>Authentication</FieldLegend>
            <FieldDescription className="mb-3">
              All API requests require authentication using a Bearer token in the Authorization header.
            </FieldDescription>
            <pre className="bg-secondary p-4 rounded-lg text-sm font-mono overflow-x-auto">
              Authorization: Bearer your_api_key_here
            </pre>
          </div>

          {/* Collections Endpoints */}
          <div className="border-t pt-6">
            <FieldLegend>Collections</FieldLegend>
            <div className="mt-3 space-y-3">
              <div className="flex items-start gap-3">
                <code className="bg-secondary px-2 py-1 rounded text-xs font-medium shrink-0">GET</code>
                <div>
                  <code className="text-sm">/api/v1/collections</code>
                  <p className="text-xs text-muted-foreground mt-1">List all collections</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <code className="bg-secondary px-2 py-1 rounded text-xs font-medium shrink-0">GET</code>
                <div>
                  <code className="text-sm">/api/v1/collections/&#123;collection_id&#125;</code>
                  <p className="text-xs text-muted-foreground mt-1">Get a collection with its fields</p>
                </div>
              </div>
            </div>
          </div>

          {/* Collection Items Endpoints */}
          <div className="border-t pt-6">
            <FieldLegend>Collection Items</FieldLegend>
            <div className="mt-3 space-y-3">
              <div className="flex items-start gap-3">
                <code className="bg-secondary px-2 py-1 rounded text-xs font-medium shrink-0">GET</code>
                <div>
                  <code className="text-sm">/api/v1/collections/&#123;collection_id&#125;/items</code>
                  <p className="text-xs text-muted-foreground mt-1">List items with pagination, filtering, and sorting</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <code className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded text-xs font-medium shrink-0">POST</code>
                <div>
                  <code className="text-sm">/api/v1/collections/&#123;collection_id&#125;/items</code>
                  <p className="text-xs text-muted-foreground mt-1">Create a new item</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <code className="bg-secondary px-2 py-1 rounded text-xs font-medium shrink-0">GET</code>
                <div>
                  <code className="text-sm">/api/v1/collections/&#123;collection_id&#125;/items/&#123;_id&#125;</code>
                  <p className="text-xs text-muted-foreground mt-1">Get a single item</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <code className="bg-amber-500/20 text-amber-600 dark:text-amber-400 px-2 py-1 rounded text-xs font-medium shrink-0">PUT</code>
                <div>
                  <code className="text-sm">/api/v1/collections/&#123;collection_id&#125;/items/&#123;_id&#125;</code>
                  <p className="text-xs text-muted-foreground mt-1">Full update (replaces all fields)</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <code className="bg-amber-500/20 text-amber-600 dark:text-amber-400 px-2 py-1 rounded text-xs font-medium shrink-0">PATCH</code>
                <div>
                  <code className="text-sm">/api/v1/collections/&#123;collection_id&#125;/items/&#123;_id&#125;</code>
                  <p className="text-xs text-muted-foreground mt-1">Partial update (only provided fields)</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <code className="bg-red-500/20 text-red-600 dark:text-red-400 px-2 py-1 rounded text-xs font-medium shrink-0">DELETE</code>
                <div>
                  <code className="text-sm">/api/v1/collections/&#123;collection_id&#125;/items/&#123;_id&#125;</code>
                  <p className="text-xs text-muted-foreground mt-1">Delete an item</p>
                </div>
              </div>
            </div>
          </div>

          {/* Query Parameters */}
          <div className="border-t pt-6">
            <FieldLegend>Query Parameters</FieldLegend>
            <FieldDescription className="mb-3">
              Available for <code className="text-xs bg-secondary px-1 py-0.5 rounded">GET /items</code> requests.
            </FieldDescription>
            <div className="space-y-2 text-sm">
              <div className="flex gap-3">
                <code className="text-muted-foreground w-32 shrink-0">page</code>
                <span>Page number (default: 1)</span>
              </div>
              <div className="flex gap-3">
                <code className="text-muted-foreground w-32 shrink-0">per_page</code>
                <span>Items per page (default: 100)</span>
              </div>
              <div className="flex gap-3">
                <code className="text-muted-foreground w-32 shrink-0">sort_by</code>
                <span>Field name to sort by</span>
              </div>
              <div className="flex gap-3">
                <code className="text-muted-foreground w-32 shrink-0">order_by</code>
                <span>Sort order: asc or desc</span>
              </div>
              <div className="flex gap-3">
                <code className="text-muted-foreground w-32 shrink-0">filter[field]</code>
                <span>Filter by field value</span>
              </div>
            </div>
          </div>

          {/* Request/Response Examples */}
          <div className="border-t pt-6">
            <FieldLegend>Example Request</FieldLegend>
            <FieldDescription className="mb-3">
              Creating a new item with POST. Field names are case-insensitive.
            </FieldDescription>
            <pre className="bg-secondary p-4 rounded-lg text-sm font-mono overflow-x-auto whitespace-pre">{`POST /api/v1/collections/{collection_id}/items
Content-Type: application/json
Authorization: Bearer your_api_key

{
  "Name": "John Doe",
  "Email": "john@example.com"
}`}</pre>
          </div>

          <div className="border-t pt-6">
            <FieldLegend>Example Response</FieldLegend>
            <FieldDescription className="mb-3">
              Response includes <code className="text-xs bg-secondary px-1 py-0.5 rounded">_id</code> (database UUID) and all field values with exact names.
            </FieldDescription>
            <pre className="bg-secondary p-4 rounded-lg text-sm font-mono overflow-x-auto whitespace-pre">{`{
  "_id": "550e8400-e29b-41d4-a716-446655440000",
  "ID": "1",
  "Name": "John Doe",
  "Email": "john@example.com",
  "Created Date": "2026-01-01T12:00:00.000Z",
  "Updated Date": "2026-01-01T12:00:00.000Z"
}`}</pre>
          </div>

          {/* Protected Fields */}
          <div className="border-t pt-6">
            <FieldLegend>Protected Fields</FieldLegend>
            <FieldDescription>
              The following fields are auto-managed and cannot be set or modified via API:
            </FieldDescription>
            <ul className="mt-3 space-y-1 text-sm">
              <li><code className="bg-secondary px-1.5 py-0.5 rounded text-xs">id</code> — Auto-incrementing ID</li>
              <li><code className="bg-secondary px-1.5 py-0.5 rounded text-xs">created_at</code> — Created timestamp</li>
              <li><code className="bg-secondary px-1.5 py-0.5 rounded text-xs">updated_at</code> — Updated timestamp</li>
            </ul>
          </div>

        </div>

      </div>

      {/* Generate API Key Dialog */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate API key</DialogTitle>
            <DialogDescription>
              Create a new API key for accessing your site&apos;s public API.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-6">
            <Field>
              <FieldLabel htmlFor="key-name">Name</FieldLabel>
              <FieldDescription>
                A descriptive name to identify this key (e.g., &ldquo;Production&rdquo;, &ldquo;CI/CD&rdquo;)
              </FieldDescription>
              <Input
                id="key-name"
                placeholder="My API Key"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newKeyName.trim()) {
                    handleGenerateKey();
                  }
                }}
              />
            </Field>
          </div>

          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => {
                setShowGenerateDialog(false);
                setNewKeyName('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerateKey}
              disabled={!newKeyName.trim() || isGenerating}
            >
              {isGenerating ? 'Generating...' : 'Generate key'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show Generated Key Dialog */}
      <Dialog
        open={showKeyDialog} onOpenChange={(open) => {
          if (!open) {
            setShowKeyDialog(false);
            setGeneratedKey(null);
            setCopied(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API key generated</DialogTitle>
            <DialogDescription>
              Copy your API key now. You won&apos;t be able to see it again.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="p-4 bg-secondary rounded-lg">
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm font-mono break-all">
                  {generatedKey?.api_key}
                </code>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => generatedKey?.api_key && copyToClipboard(generatedKey.api_key)}
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
              <strong>Important:</strong> Store this key securely. For security reasons, we can&apos;t show it again.
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                setShowKeyDialog(false);
                setGeneratedKey(null);
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
        title="Delete API key?"
        description={`This will permanently delete the API key "${keyToDelete?.name}". Any applications using this key will no longer be able to access your API.`}
        confirmLabel="Delete key"
        cancelLabel="Cancel"
        confirmVariant="destructive"
        onConfirm={handleDeleteKey}
        onCancel={() => {
          setShowDeleteDialog(false);
          setKeyToDelete(null);
        }}
      />
    </div>
  );
}
