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
        <header className="pt-10 pb-3">
          <span className="text-base font-medium">API Documentation</span>
        </header>

        <div className="flex flex-col gap-8 bg-secondary/20 p-8 rounded-lg text-sm">

          {/* Authentication */}
          <section>
            <h3 className="font-medium mb-2">Authentication</h3>
            <p className="text-muted-foreground mb-3">
              All API requests require a valid API key passed in the <code className="text-xs bg-secondary px-1 py-0.5 rounded">Authorization</code> header:
            </p>
            <pre className="bg-secondary p-3 rounded-lg text-xs overflow-x-auto">
{`Authorization: Bearer YOUR_API_KEY`}
            </pre>
          </section>

          {/* Endpoints */}
          <section>
            <h3 className="font-medium mb-2">Endpoints</h3>
            <div className="space-y-4">

              <div>
                <h4 className="text-muted-foreground mb-1">Collections</h4>
                <div className="bg-secondary p-3 rounded-lg space-y-1 text-xs font-mono">
                  <div><span className="text-green-500">GET</span> /api/v1/collections</div>
                  <div><span className="text-green-500">GET</span> /api/v1/collections/{'{collection_id}'}</div>
                </div>
              </div>

              <div>
                <h4 className="text-muted-foreground mb-1">Collection Items</h4>
                <div className="bg-secondary p-3 rounded-lg space-y-1 text-xs font-mono">
                  <div><span className="text-green-500">GET</span> /api/v1/collections/{'{collection_id}'}/items</div>
                  <div><span className="text-blue-500">POST</span> /api/v1/collections/{'{collection_id}'}/items</div>
                  <div><span className="text-green-500">GET</span> /api/v1/collections/{'{collection_id}'}/items/{'{item_id}'}</div>
                  <div><span className="text-yellow-500">PUT</span> /api/v1/collections/{'{collection_id}'}/items/{'{item_id}'}</div>
                  <div><span className="text-yellow-500">PATCH</span> /api/v1/collections/{'{collection_id}'}/items/{'{item_id}'}</div>
                  <div><span className="text-red-500">DELETE</span> /api/v1/collections/{'{collection_id}'}/items/{'{item_id}'}</div>
                </div>
              </div>

            </div>
          </section>

          {/* Query Parameters */}
          <section>
            <h3 className="font-medium mb-2">Query Parameters</h3>
            <p className="text-muted-foreground mb-3">
              Use these parameters with GET requests. Field names are case-insensitive.
            </p>
            <div className="bg-secondary p-3 rounded-lg text-xs space-y-3">
              <div>
                <div className="font-medium text-foreground mb-1">Pagination</div>
                <div className="space-y-1 text-muted-foreground">
                  <div><code className="text-blue-400">page</code> - Page number (default: 1)</div>
                  <div><code className="text-blue-400">per_page</code> - Items per page (default: 100, max: 1000)</div>
                  <div><code className="text-blue-400">limit</code> - Limit total records (max: 1000)</div>
                </div>
              </div>
              <div>
                <div className="font-medium text-foreground mb-1">Sorting</div>
                <div className="space-y-1 text-muted-foreground">
                  <div><code className="text-blue-400">sort_by</code> - Field name to sort by</div>
                  <div><code className="text-blue-400">order_by</code> - Sort order: <code className="text-green-400">asc</code> or <code className="text-green-400">desc</code></div>
                </div>
              </div>
              <div>
                <div className="font-medium text-foreground mb-1">Filtering</div>
                <div className="space-y-1 text-muted-foreground">
                  <div><code className="text-blue-400">filter[FieldName]</code> - Filter by exact field value</div>
                </div>
              </div>
              <div>
                <div className="font-medium text-foreground mb-1">Field Projection</div>
                <div className="space-y-1 text-muted-foreground">
                  <div><code className="text-blue-400">fields[CollectionName]</code> - Limit returned fields</div>
                  <div><code className="text-blue-400">fields[CollectionName.RefField]</code> - Limit nested reference fields</div>
                </div>
              </div>
            </div>
            <p className="text-muted-foreground mt-3 text-xs">
              Example: <code className="bg-secondary px-1 py-0.5 rounded">?sort_by=Name&amp;order_by=desc&amp;filter[Status]=active&amp;fields[Posts]=Name,Author</code>
            </p>
          </section>

          {/* Field Projections */}
          <section>
            <h3 className="font-medium mb-2">Field Projections</h3>
            <p className="text-muted-foreground mb-3">
              Limit which fields are returned to reduce payload size. Use the collection name for root fields, and dot notation for nested references.
            </p>
            <pre className="bg-secondary p-3 rounded-lg text-xs overflow-x-auto">
{`// Only return Name and Author from Blog Posts
?fields[Blog Posts]=Name,Author

// Also limit Author to just Name and Email
?fields[Blog Posts]=Name,Author&fields[Blog Posts.Author]=Name,Email

// Deep nesting supported
?fields[People]=Name,Hometown&fields[People.Hometown]=Name,Country`}
            </pre>
            <p className="text-muted-foreground mt-3 text-xs">
              Note: <code className="bg-secondary px-1 py-0.5 rounded">_id</code> is always included. Reference fields must be listed to be resolved.
            </p>
          </section>

          {/* Creating Items */}
          <section>
            <h3 className="font-medium mb-2">Creating Items</h3>
            <p className="text-muted-foreground mb-3">
              Send field values directly in the request body. Field names are case-insensitive.
            </p>
            <pre className="bg-secondary p-3 rounded-lg text-xs overflow-x-auto">
{`POST /api/v1/collections/{collection_id}/items
Content-Type: application/json

{
  "Name": "My Blog Post",
  "Slug": "my-blog-post",
  "Author": "author-uuid-here",
  "Categories": "[\\"cat-uuid-1\\", \\"cat-uuid-2\\"]"
}`}
            </pre>
            <p className="text-muted-foreground mt-3 text-xs">
              Reference fields accept the item UUID. Multi-reference fields accept a JSON array string of UUIDs.
            </p>
          </section>

          {/* Updating Items */}
          <section>
            <h3 className="font-medium mb-2">Updating Items</h3>
            <div className="space-y-3">
              <div>
                <div className="font-medium text-xs mb-2">PUT - Full Replace</div>
                <p className="text-muted-foreground text-xs mb-2">
                  Replaces all field values. Fields not included are cleared (except protected fields).
                </p>
              </div>
              <div>
                <div className="font-medium text-xs mb-2">PATCH - Partial Update</div>
                <p className="text-muted-foreground text-xs mb-2">
                  Only updates the fields you send. Other fields remain unchanged.
                </p>
              </div>
            </div>
            <pre className="bg-secondary p-3 rounded-lg text-xs overflow-x-auto mt-3">
{`PATCH /api/v1/collections/{collection_id}/items/{item_id}
Content-Type: application/json

{
  "Name": "Updated Title"
}`}
            </pre>
          </section>

          {/* Reference Fields */}
          <section>
            <h3 className="font-medium mb-2">Reference Fields</h3>
            <p className="text-muted-foreground mb-3">
              Reference fields are automatically resolved to include the full referenced item data:
            </p>
            <pre className="bg-secondary p-3 rounded-lg text-xs overflow-x-auto">
{`// Single reference returns an object:
"Author": {
  "_id": "abc-123",
  "Name": "John Doe",
  "Email": "john@example.com"
}

// Multi-reference returns an array:
"Categories": [
  { "_id": "cat-1", "Name": "Technology" },
  { "_id": "cat-2", "Name": "Design" }
]`}
            </pre>
          </section>

          {/* Response Format */}
          <section>
            <h3 className="font-medium mb-2">Response Format</h3>
            <p className="text-muted-foreground mb-3">
              Responses include <code className="text-xs bg-secondary px-1 py-0.5 rounded">_id</code> (database UUID) and field values using exact field names:
            </p>
            <pre className="bg-secondary p-3 rounded-lg text-xs overflow-x-auto">
{`{
  "_id": "550e8400-e29b-41d4-a716-446655440000",
  "ID": "1",
  "Name": "My Blog Post",
  "Slug": "my-blog-post",
  "Created Date": "2026-01-05T10:00:00.000Z",
  "Updated Date": "2026-01-05T12:30:00.000Z",
  "Author": { "_id": "...", "Name": "John Doe" }
}`}
            </pre>
          </section>

          {/* Protected Fields */}
          <section>
            <h3 className="font-medium mb-2">Protected Fields</h3>
            <p className="text-muted-foreground mb-3">
              These auto-generated fields cannot be set or modified via the API:
            </p>
            <div className="bg-secondary p-3 rounded-lg text-xs space-y-2">
              <div><code className="text-blue-400">ID</code> - Auto-incrementing number, assigned on creation</div>
              <div><code className="text-blue-400">Created Date</code> - Set automatically when item is created</div>
              <div><code className="text-blue-400">Updated Date</code> - Updated automatically on every change</div>
            </div>
          </section>

          {/* Error Responses */}
          <section>
            <h3 className="font-medium mb-2">Error Responses</h3>
            <p className="text-muted-foreground mb-3">
              Errors return a JSON object with <code className="text-xs bg-secondary px-1 py-0.5 rounded">error</code> and <code className="text-xs bg-secondary px-1 py-0.5 rounded">code</code> fields:
            </p>
            <pre className="bg-secondary p-3 rounded-lg text-xs overflow-x-auto">
{`{
  "error": "Collection not found",
  "code": "NOT_FOUND"
}`}
            </pre>
            <div className="mt-3 text-xs text-muted-foreground space-y-1">
              <div><code className="text-yellow-400">401</code> - Invalid or missing API key</div>
              <div><code className="text-yellow-400">404</code> - Collection or item not found</div>
              <div><code className="text-yellow-400">400</code> - Invalid request body</div>
              <div><code className="text-yellow-400">500</code> - Internal server error</div>
            </div>
          </section>

        </div>

      </div>

      {/* Generate API Key Dialog */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent aria-describedby={undefined}>
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
        <DialogContent aria-describedby={undefined}>
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
