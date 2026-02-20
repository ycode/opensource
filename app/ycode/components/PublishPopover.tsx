'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Spinner } from '@/components/ui/spinner';
import Icon from '@/components/ui/icon';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { publishApi } from '@/lib/api';
import { formatRelativeTime } from '@/lib/utils';
import { toast } from 'sonner';

interface PublishPreviewCounts {
  pages: number;
  collections: number;
  collectionItems: number;
  components: number;
  layerStyles: number;
  assets: number;
  total: number;
}

/** Breakdown row config for rendering */
const BREAKDOWN_ITEMS: { key: keyof Omit<PublishPreviewCounts, 'total'>; label: string; icon: Parameters<typeof Icon>[0]['name'] }[] = [
  { key: 'pages', label: 'Pages', icon: 'page' },
  { key: 'components', label: 'Components', icon: 'component' },
  { key: 'collections', label: 'Collections', icon: 'database' },
  { key: 'collectionItems', label: 'Collection items', icon: 'database' },
  { key: 'layerStyles', label: 'Layer styles', icon: 'cube' },
  { key: 'assets', label: 'Assets', icon: 'image' },
];

interface PublishPopoverProps {
  isPublishing: boolean;
  setIsPublishing: (isPublishing: boolean) => void;
  baseUrl: string;
  publishedUrl: string;
  isDisabled?: boolean;
  onPublishSuccess: () => void;
}

export default function PublishPopover({
  isPublishing,
  setIsPublishing,
  baseUrl,
  publishedUrl,
  isDisabled = false,
  onPublishSuccess,
}: PublishPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [changeCounts, setChangeCounts] = useState<PublishPreviewCounts | null>(null);
  const [isLoadingCount, setIsLoadingCount] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const [isRevertDialogOpen, setIsRevertDialogOpen] = useState(false);

  const { getSettingByKey, updateSetting } = useSettingsStore();
  const publishedAt = getSettingByKey('published_at');

  // Load changes count when popover opens
  useEffect(() => {
    if (isOpen) {
      loadChangesCount();
    }
  }, [isOpen]);

  const loadChangesCount = async () => {
    setIsLoadingCount(true);
    try {
      const response = await publishApi.getPreview();
      setChangeCounts(response.data ?? null);
    } catch (error) {
      console.error('Failed to load changes count:', error);
      setChangeCounts(null);
    } finally {
      setIsLoadingCount(false);
    }
  };

  const handlePublishAll = useCallback(async () => {
    try {
      setIsPublishing(true);

      const result = await publishApi.publish({ publishAll: true });

      if (result.error) {
        throw new Error(result.error);
      }

      // Sync published timestamp to store from response
      if (result.data?.published_at_setting?.value) {
        updateSetting('published_at', result.data.published_at_setting.value);
      }

      toast.success('Website published successfully', {
        action: {
          label: 'Open',
          onClick: () => window.open(baseUrl + publishedUrl, '_blank'),
        },
      });

      setPublishSuccess(true);
      setTimeout(() => setPublishSuccess(false), 3000);

      // Refresh counts in background (non-blocking)
      onPublishSuccess();
      loadChangesCount();
    } catch (error) {
      console.error('Failed to publish all:', error);
    } finally {
      setIsPublishing(false);
    }
  }, [baseUrl, publishedUrl, onPublishSuccess, setIsPublishing, updateSetting]);

  const handleRevertConfirm = useCallback(async () => {
    try {
      setIsReverting(true);

      const result = await publishApi.revert();

      if (result.error) {
        throw new Error(result.error);
      }

      toast.success('Revert successful, builder is reloading...');

      // Full reload to refresh all editor stores with reverted data
      window.location.reload();
    } catch (error) {
      console.error('Failed to revert:', error);
      toast.error('Failed to revert changes');
      setIsReverting(false);
      setIsRevertDialogOpen(false);
    }
  }, []);

  return (
    <>
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" disabled={isDisabled}>Publish</Button>
      </PopoverTrigger>

      <PopoverContent className="mr-4 mt-0.5 w-64">
        <div>
          <Label>
            <a
              href={baseUrl + publishedUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {baseUrl}
            </a>
          </Label>
          <span className="text-popover-foreground text-[10px]">
            {publishedAt ? `Published ${formatRelativeTime(publishedAt, false)}` : 'Never published'}
          </span>
        </div>

        <hr className="my-3" />

        <Button
          size="sm"
          className="w-full"
          onClick={handlePublishAll}
          disabled={isPublishing || publishSuccess}
        >
          {isPublishing ? (
            <Spinner />
          ) : publishSuccess ? (
            <Icon name="check" />
          ) : (
            publishedAt ? 'Update' : 'Publish'
          )}
        </Button>

        <hr className="my-3" />

        {isLoadingCount ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Spinner className="size-3" />
            Calculating changes...
          </div>
        ) : changeCounts ? (
          changeCounts.total > 0 ? (
            <Collapsible>
              <div className="flex items-center justify-between w-full">
                <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group">
                  <div className="size-5.5 flex items-center justify-center bg-input rounded-md">
                    <Icon
                      name="chevronRight"
                      className="size-2.5 transition-transform group-data-[state=open]:rotate-90"
                    />
                  </div>
                  {changeCounts.total} {changeCounts.total === 1 ? 'Change' : 'Changes'}
                </CollapsibleTrigger>
                {publishedAt && (
                  <Button
                    size="xs"
                    variant="secondary"
                    onClick={() => setIsRevertDialogOpen(true)}
                    disabled={isReverting || isPublishing}
                  >
                    Revert
                  </Button>
                )}
              </div>
              <CollapsibleContent>
                <div className="flex flex-col gap-1.5 pt-1.5">
                  {BREAKDOWN_ITEMS.map(({ key, label, icon }) =>
                    changeCounts[key] > 0 ? (
                      <div key={key} className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <div className="size-5.5 flex items-center justify-center bg-input rounded-md">
                            <Icon name={icon} className="size-2.5" />
                          </div>
                          {label}
                        </span>
                        <span>{changeCounts[key]}</span>
                      </div>
                    ) : null
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ) : (
            <span className="text-xs text-muted-foreground">Everything is up to date</span>
          )
        ) : null}
      </PopoverContent>
    </Popover>

    <Dialog
      open={isRevertDialogOpen}
      onOpenChange={(open) => { if (!isReverting) setIsRevertDialogOpen(open); }}
    >
      <DialogContent
        showCloseButton={false}
        onPointerDownOutside={(e) => { if (isReverting) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (isReverting) e.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle>Revert to published version</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <DialogDescription>
            All unpublished changes will be discarded and replaced with the last
            published version. The builder will reload after this operation.
          </DialogDescription>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsRevertDialogOpen(false)}
            disabled={isReverting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleRevertConfirm}
            disabled={isReverting}
          >
            {isReverting ? <><Spinner /> Reverting...</> : 'Revert'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
