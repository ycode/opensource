'use client';

import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import {
  FieldDescription,
  FieldLabel,
  FieldLegend,
  Field,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Spinner } from '@/components/ui/spinner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import type { Redirect } from '@/types';

export default function RedirectsSettingsPage() {
  const [redirects, setRedirects] = useState<Redirect[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingRedirect, setEditingRedirect] = useState<Redirect | null>(null);

  // Form state
  const [oldUrl, setOldUrl] = useState('');
  const [newUrl, setNewUrl] = useState('');

  // Load redirects on mount
  useEffect(() => {
    const loadRedirects = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch('/api/settings/redirects');
        if (response.ok) {
          const result = await response.json();
          setRedirects(result.data || []);
        } else if (response.status === 404) {
          // No redirects setting yet, start with empty array
          setRedirects([]);
        } else {
          throw new Error('Failed to load redirects');
        }
      } catch (err) {
        console.error('Error loading redirects:', err);
        setError('Failed to load redirects');
      } finally {
        setIsLoading(false);
      }
    };

    loadRedirects();
  }, []);

  // Save redirects to API
  const saveRedirects = async (newRedirects: Redirect[]) => {
    try {
      setIsSaving(true);
      setError(null);
      const response = await fetch('/api/settings/redirects', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: newRedirects }),
      });

      if (!response.ok) {
        throw new Error('Failed to save redirects');
      }

      setRedirects(newRedirects);
    } catch (err) {
      console.error('Error saving redirects:', err);
      setError('Failed to save redirects');
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddRedirect = async () => {
    if (oldUrl && newUrl) {
      const newRedirect: Redirect = {
        id: Date.now().toString(),
        oldUrl: oldUrl.startsWith('/') ? oldUrl : `/${oldUrl}`,
        newUrl,
      };

      try {
        await saveRedirects([...redirects, newRedirect]);
        setOldUrl('');
        setNewUrl('');
        setShowAddDialog(false);
      } catch {
        // Error already handled in saveRedirects
      }
    }
  };

  const handleEditRedirect = (redirect: Redirect) => {
    setEditingRedirect(redirect);
    setOldUrl(redirect.oldUrl);
    setNewUrl(redirect.newUrl);
    setShowEditDialog(true);
  };

  const handleSaveEdit = async () => {
    if (editingRedirect && oldUrl && newUrl) {
      const updatedRedirects = redirects.map((r) =>
        r.id === editingRedirect.id
          ? {
            ...r,
            oldUrl: oldUrl.startsWith('/') ? oldUrl : `/${oldUrl}`,
            newUrl,
          }
          : r
      );

      try {
        await saveRedirects(updatedRedirects);
        setOldUrl('');
        setNewUrl('');
        setEditingRedirect(null);
        setShowEditDialog(false);
      } catch {
        // Error already handled in saveRedirects
      }
    }
  };

  const handleDeleteRedirect = async (id: string) => {
    const updatedRedirects = redirects.filter((r) => r.id !== id);
    try {
      await saveRedirects(updatedRedirects);
    } catch {
      // Error already handled in saveRedirects
    }
  };

  const resetForm = () => {
    setOldUrl('');
    setNewUrl('');
    setEditingRedirect(null);
  };

  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto">
        <header className="pt-8 pb-3">
          <span className="text-base font-medium">Redirects</span>
        </header>

        <div className="flex flex-col gap-6 bg-secondary/20 p-8 rounded-lg">
          <header className="flex justify-between">
            <div>
              <FieldLegend>Redirects</FieldLegend>
              <FieldDescription>
                Redirect site visitors and search engines from old URL to new
                URL.
              </FieldDescription>
            </div>

            <div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowAddDialog(true)}
                disabled={isSaving}
              >
                Add redirect
              </Button>
            </div>
          </header>

          {error && (
            <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-md text-sm">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="border-t pt-8 pb-4 flex justify-center">
              <Spinner />
            </div>
          ) : redirects.length > 0 ? (
            <div className="border-t -mb-4 divide-y">
              {redirects.map((redirect) => (
                <div key={redirect.id} className="py-4 flex">
                  <div className="flex-1 flex items-center gap-4">
                    <Label variant="muted" className="flex-1">
                      {redirect.oldUrl}
                    </Label>
                    <Icon
                      name="arrowLeft"
                      className="size-2.5 rotate-180 opacity-50"
                    />
                    <Label variant="muted" className="flex-1">
                      {redirect.newUrl}
                    </Label>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="secondary"
                        size="xs"
                        disabled={isSaving}
                      >
                        <Icon name="more" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleEditRedirect(redirect)}
                      >
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDeleteRedirect(redirect.id)}
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
              No redirects yet. Click &ldquo;Add redirect&rdquo; to create one.
            </div>
          )}
        </div>
      </div>

      {/* Add Redirect Dialog */}
      <Dialog
        open={showAddDialog}
        onOpenChange={(open) => {
          setShowAddDialog(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add redirect</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-6">
            <Field>
              <FieldLabel htmlFor="add-old-url">Old URL</FieldLabel>
              <FieldDescription>
                The URL path to redirect from (e.g. /old-page)
              </FieldDescription>
              <Input
                id="add-old-url"
                placeholder="/old-page"
                value={oldUrl}
                onChange={(e) => setOldUrl(e.target.value)}
                autoFocus
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="add-new-url">New URL</FieldLabel>
              <FieldDescription>
                Internal path (e.g. /new-page) or external URL (e.g.
                https://example.com)
              </FieldDescription>
              <Input
                id="add-new-url"
                placeholder="/new-page or https://example.com"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
              />
            </Field>
          </div>

          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => {
                setShowAddDialog(false);
                resetForm();
              }}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddRedirect}
              disabled={!oldUrl || !newUrl || isSaving}
            >
              {isSaving ? <Spinner className="size-4" /> : 'Add redirect'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Redirect Dialog */}
      <Dialog
        open={showEditDialog}
        onOpenChange={(open) => {
          setShowEditDialog(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit redirect</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-6">
            <Field>
              <FieldLabel htmlFor="edit-old-url">Old URL</FieldLabel>
              <FieldDescription>
                The URL path to redirect from (e.g. /old-page)
              </FieldDescription>
              <Input
                id="edit-old-url"
                placeholder="/old-page"
                value={oldUrl}
                onChange={(e) => setOldUrl(e.target.value)}
                autoFocus
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="edit-new-url">New URL</FieldLabel>
              <FieldDescription>
                Internal path (e.g. /new-page) or external URL (e.g.
                https://example.com)
              </FieldDescription>
              <Input
                id="edit-new-url"
                placeholder="/new-page or https://example.com"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
              />
            </Field>
          </div>

          <DialogFooter>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setShowEditDialog(false);
                resetForm();
              }}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveEdit}
              disabled={!oldUrl || !newUrl || isSaving}
            >
              {isSaving ? <Spinner className="size-4" /> : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
