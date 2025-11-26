'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import {
  Field, FieldContent,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSeparator
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import Icon from '@/components/ui/icon';
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

interface Redirect {
  id: string;
  oldUrl: string;
  newUrl: string;
}

export default function GeneralSettingsPage() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [redirects, setRedirects] = useState<Redirect[]>([]);
  const [oldUrl, setOldUrl] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [editingRedirect, setEditingRedirect] = useState<Redirect | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  const handleAddRedirect = () => {
    if (oldUrl && newUrl) {
      const newRedirect: Redirect = {
        id: Date.now().toString(),
        oldUrl,
        newUrl,
      };
      setRedirects([...redirects, newRedirect]);
      setOldUrl('');
      setNewUrl('');
      setShowAddDialog(false);
    }
  };

  const handleEditRedirect = (redirect: Redirect) => {
    setEditingRedirect(redirect);
    setOldUrl(redirect.oldUrl);
    setNewUrl(redirect.newUrl);
    setShowEditDialog(true);
  };

  const handleSaveEdit = () => {
    if (editingRedirect && oldUrl && newUrl) {
      setRedirects(
        redirects.map((r) =>
          r.id === editingRedirect.id
            ? { ...r, oldUrl, newUrl }
            : r
        )
      );
      setOldUrl('');
      setNewUrl('');
      setEditingRedirect(null);
      setShowEditDialog(false);
    }
  };

  const handleDeleteRedirect = (id: string) => {
    setRedirects(redirects.filter(r => r.id !== id));
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
              <FieldLegend>
                Redirects
              </FieldLegend>
              <FieldDescription>
                Redirect site visitors and search engines from old URL to new URL.
              </FieldDescription>
            </div>

            <div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowAddDialog(true)}
              >
                Add redirect
              </Button>
            </div>

          </header>

          {redirects.length > 0 ? (
            <div className="border-t -mb-4 divide-y">
              {redirects.map((redirect) => (
                <div key={redirect.id} className="py-4 flex">
                  <div className="flex-1 flex items-center gap-4">
                    <Label variant="muted" className="flex-1">{redirect.oldUrl}</Label>
                    <Icon name="arrowLeft" className="size-2.5 rotate-180 opacity-50" />
                    <Label variant="muted" className="flex-1">{redirect.newUrl}</Label>
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
                      <DropdownMenuItem onClick={() => handleEditRedirect(redirect)}>
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
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
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
                The URL path to redirect to (e.g. /new-page)
              </FieldDescription>
              <Input
                id="add-new-url"
                placeholder="/new-page"
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
                setOldUrl('');
                setNewUrl('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddRedirect}
              disabled={!oldUrl || !newUrl}
            >
              Add redirect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Redirect Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
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
                The URL path to redirect to (e.g. /new-page)
              </FieldDescription>
              <Input
                id="edit-new-url"
                placeholder="/new-page"
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
                setOldUrl('');
                setNewUrl('');
                setEditingRedirect(null);
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveEdit}
              disabled={!oldUrl || !newUrl}
            >
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
