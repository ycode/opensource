'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
  { key: 'layerStyles', label: 'Layer styles', icon: 'paintbrush' },
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

  return (
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
              <CollapsibleTrigger className="flex items-center justify-between w-full text-xs text-muted-foreground hover:text-foreground transition-colors group">
                <span className="flex items-center gap-1.5">
                    <div className="size-[22px] flex items-center justify-center bg-input rounded-md">
                     <Icon
                       name="chevronRight"
                       className="size-2.5 transition-transform group-data-[state=open]:rotate-90"
                     />
                    </div>
                  {changeCounts.total} {changeCounts.total === 1 ? 'Change' : 'Changes'}
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="flex flex-col gap-1.5 pt-1.5">
                  {BREAKDOWN_ITEMS.map(({ key, label, icon }) =>
                    changeCounts[key] > 0 ? (
                      <div key={key} className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <div className="size-[22px] flex items-center justify-center bg-input rounded-md">
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
  );
}
