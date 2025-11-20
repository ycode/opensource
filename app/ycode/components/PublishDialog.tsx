/**
 * Publish Dialog
 *
 * Dialog for publishing pages and collection items
 */
'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty';
import Icon from '@/components/ui/icon';
import { pagesApi, collectionsApi, componentsApi, layerStylesApi, cacheApi } from '@/lib/api';
import type { Page, Collection, Component, LayerStyle, CollectionItemWithValues } from '@/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface PublishDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function PublishDialog({
  isOpen,
  onClose,
  onSuccess,
}: PublishDialogProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [unpublishedPages, setUnpublishedPages] = useState<Page[]>([]);
  const [collectionsWithItems, setCollectionsWithItems] = useState<Array<{ collection: Collection; items: CollectionItemWithValues[] }>>([]);
  const [unpublishedComponents, setUnpublishedComponents] = useState<Component[]>([]);
  const [unpublishedLayerStyles, setUnpublishedLayerStyles] = useState<LayerStyle[]>([]);
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(new Set());
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [selectedComponentIds, setSelectedComponentIds] = useState<Set<string>>(new Set());
  const [selectedLayerStyleIds, setSelectedLayerStyleIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Load data when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Load unpublished pages
      const pagesResponse = await pagesApi.getUnpublished();
      if (pagesResponse.error) {
        throw new Error(pagesResponse.error);
      }
      setUnpublishedPages(pagesResponse.data || []);

      // Load all collections
      const collectionsResponse = await collectionsApi.getAll();
      if (collectionsResponse.error) {
        throw new Error(collectionsResponse.error);
      }

      const collections = collectionsResponse.data || [];

      // Load unpublished items for each collection
      const collectionsWithItemsData: Array<{ collection: Collection; items: CollectionItemWithValues[] }> = [];

      for (const collection of collections) {
        const itemsResponse = await collectionsApi.getUnpublishedItems(collection.id);
        if (itemsResponse.error) {
          console.error(`Failed to load unpublished items for collection ${collection.id}:`, itemsResponse.error);
          continue;
        }

        const items = itemsResponse.data || [];

        // Only include collections that have unpublished items
        if (items.length > 0) {
          collectionsWithItemsData.push({
            collection,
            items,
          });
        }
      }

      setCollectionsWithItems(collectionsWithItemsData);

      // Load unpublished components
      const componentsResponse = await componentsApi.getUnpublished();
      if (componentsResponse.error) {
        throw new Error(componentsResponse.error);
      }
      setUnpublishedComponents(componentsResponse.data || []);

      // Load unpublished layer styles
      const stylesResponse = await layerStylesApi.getUnpublished();
      if (stylesResponse.error) {
        throw new Error(stylesResponse.error);
      }
      setUnpublishedLayerStyles(stylesResponse.data || []);

      // Select all items by default
      const allPageIds = new Set((pagesResponse.data || []).map(p => p.id));
      setSelectedPageIds(allPageIds);

      const allItemIds = new Set<string>();
      collectionsWithItemsData.forEach(({ items }) => {
        items.forEach(item => allItemIds.add(item.id));
      });
      setSelectedItemIds(allItemIds);

      const allComponentIds = new Set((componentsResponse.data || []).map(c => c.id));
      setSelectedComponentIds(allComponentIds);

      const allStyleIds = new Set((stylesResponse.data || []).map(s => s.id));
      setSelectedLayerStyleIds(allStyleIds);
    } catch (err) {
      console.error('Failed to load publish data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    setError(null);

    try {
      let totalPublished = 0;

      // Publish selected pages
      if (selectedPageIds.size > 0) {
        const pagesResponse = await pagesApi.publishPages(Array.from(selectedPageIds));
        if (pagesResponse.error) {
          throw new Error(pagesResponse.error);
        }
        totalPublished += pagesResponse.data?.count || 0;
      }

      // Publish selected collection items
      // Group items by collection and publish collections with their selected items
      if (selectedItemIds.size > 0) {
        // Build a map of collection ID -> selected item IDs
        const collectionItemsMap = new Map<string, string[]>();

        collectionsWithItems.forEach(({ collection, items }) => {
          const selectedItemsInCollection = items
            .filter(item => selectedItemIds.has(item.id))
            .map(item => item.id);

          if (selectedItemsInCollection.length > 0) {
            collectionItemsMap.set(collection.id, selectedItemsInCollection);
          }
        });

        // Publish each collection with its selected items
        const collectionPublishes = Array.from(collectionItemsMap.entries()).map(
          ([collectionId, itemIds]) => ({
            collectionId,
            itemIds,
          })
        );

        if (collectionPublishes.length > 0) {
          const collectionsResponse = await collectionsApi.publishCollectionsWithItems(collectionPublishes);
          if (collectionsResponse.error) {
            throw new Error(collectionsResponse.error);
          }
          // Count items from results
          if (collectionsResponse.data?.results) {
            collectionsResponse.data.results.forEach(result => {
              totalPublished += result.published?.itemsCount || 0;
            });
          }
        }
      }

      // Publish selected components
      if (selectedComponentIds.size > 0) {
        const componentsResponse = await componentsApi.publishComponents(Array.from(selectedComponentIds));
        if (componentsResponse.error) {
          throw new Error(componentsResponse.error);
        }
        totalPublished += componentsResponse.data?.count || 0;
      }

      // Publish selected layer styles
      if (selectedLayerStyleIds.size > 0) {
        const stylesResponse = await layerStylesApi.publishLayerStyles(Array.from(selectedLayerStyleIds));
        if (stylesResponse.error) {
          throw new Error(stylesResponse.error);
        }
        totalPublished += stylesResponse.data?.count || 0;
      }

      // Copy draft CSS to published CSS
      try {
        const draftCssResponse = await fetch('/api/settings/draft_css');
        if (draftCssResponse.ok) {
          const draftCssResult = await draftCssResponse.json();
          if (draftCssResult.data) {
            await fetch('/api/settings/published_css', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ value: draftCssResult.data }),
            });
          }
        }
      } catch {
        throw new Error('Failed to publish the CSS contents');
      }

      // Invalidate all cache via API
      await cacheApi.clearAll();

      // Show success and close
      if (onSuccess) {
        onSuccess();
      }

      // Reset selections
      setSelectedPageIds(new Set());
      setSelectedItemIds(new Set());
      setSelectedComponentIds(new Set());
      setSelectedLayerStyleIds(new Set());

      onClose();
    } catch (err) {
      console.error('Failed to publish:', err);
      setError(err instanceof Error ? err.message : 'Failed to publish');
    } finally {
      setIsPublishing(false);
    }
  };

  const togglePage = (pageId: string) => {
    const newSet = new Set(selectedPageIds);
    if (newSet.has(pageId)) {
      newSet.delete(pageId);
    } else {
      newSet.add(pageId);
    }
    setSelectedPageIds(newSet);
  };

  const toggleItem = (itemId: string) => {
    const newSet = new Set(selectedItemIds);
    if (newSet.has(itemId)) {
      newSet.delete(itemId);
    } else {
      newSet.add(itemId);
    }
    setSelectedItemIds(newSet);
  };

  const toggleAllPages = () => {
    if (selectedPageIds.size === unpublishedPages.length) {
      setSelectedPageIds(new Set());
    } else {
      setSelectedPageIds(new Set(unpublishedPages.map(p => p.id)));
    }
  };

  const toggleAllItemsInCollection = (collectionId: string) => {
    const collectionData = collectionsWithItems.find(c => c.collection.id === collectionId);
    if (!collectionData) return;

    const itemIds = collectionData.items.map(item => item.id);
    const newSet = new Set(selectedItemIds);

    // Check if all items in this collection are selected
    const allSelected = itemIds.every(id => newSet.has(id));

    if (allSelected) {
      // Deselect all items in this collection
      itemIds.forEach(id => newSet.delete(id));
    } else {
      // Select all items in this collection
      itemIds.forEach(id => newSet.add(id));
    }

    setSelectedItemIds(newSet);
  };

  const toggleComponent = (componentId: string) => {
    const newSet = new Set(selectedComponentIds);
    if (newSet.has(componentId)) {
      newSet.delete(componentId);
    } else {
      newSet.add(componentId);
    }
    setSelectedComponentIds(newSet);
  };

  const toggleAllComponents = () => {
    if (selectedComponentIds.size === unpublishedComponents.length) {
      setSelectedComponentIds(new Set());
    } else {
      setSelectedComponentIds(new Set(unpublishedComponents.map(c => c.id)));
    }
  };

  const toggleLayerStyle = (styleId: string) => {
    const newSet = new Set(selectedLayerStyleIds);
    if (newSet.has(styleId)) {
      newSet.delete(styleId);
    } else {
      newSet.add(styleId);
    }
    setSelectedLayerStyleIds(newSet);
  };

  const toggleAllLayerStyles = () => {
    if (selectedLayerStyleIds.size === unpublishedLayerStyles.length) {
      setSelectedLayerStyleIds(new Set());
    } else {
      setSelectedLayerStyleIds(new Set(unpublishedLayerStyles.map(s => s.id)));
    }
  };

  const totalCollectionItems = collectionsWithItems.reduce((sum, c) => sum + c.items.length, 0);
  const hasItemsToPublish = unpublishedPages.length > 0 || totalCollectionItems > 0 || unpublishedComponents.length > 0 || unpublishedLayerStyles.length > 0;
  const hasSelections = selectedPageIds.size > 0 || selectedItemIds.size > 0 || selectedComponentIds.size > 0 || selectedLayerStyleIds.size > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Publish Content</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Spinner />
          </div>
        ) : error ? (
          <div className="p-4 text-destructive">
            {error}
          </div>
        ) : !hasItemsToPublish ? (
          <div className="flex items-center justify-center p-8">
            <Empty>
              <EmptyTitle>Nothing to Publish</EmptyTitle>
              <EmptyDescription>
                All pages, components, layer styles, and collection items are already published
              </EmptyDescription>
            </Empty>
          </div>
        ) : (
          <>

            <div className="flex-1 flex flex-col gap-2 -my-4">
              {/* Pages Section */}
              {unpublishedPages.length > 0 && (
                <div className="flex flex-col gap-2 bg-secondary/20 px-5 pt-4 pb-2 rounded-lg -mx-4">

                  <div className="flex items-center justify-between">

                    <Label className="gap-1">
                      Pages
                      <Badge variant="secondary" className="text-[10px]">
                        <span className="-mx-1">{unpublishedPages.length}</span>
                      </Badge>
                    </Label>

                    <Button
                      size="xs" variant="ghost"
                      onClick={toggleAllPages}
                    >
                      {selectedPageIds.size === unpublishedPages.length ? 'Deselect all' : 'Select all'}
                    </Button>

                  </div>

                  <div className="divide-y divide-secondary">
                    {unpublishedPages.map(page => (
                      <label
                        key={page.id}
                        className="flex cursor-pointer"
                      >
                        <div className="flex-1 flex items-start gap-2 p-3 -mx-3 hover:bg-secondary/50 rounded-lg">
                          <Checkbox
                            checked={selectedPageIds.has(page.id)}
                            onCheckedChange={() => togglePage(page.id)}
                          />
                          <div className="flex-1 flex items-center justify-between text-xs text-muted-foreground">
                            <span>{page.name}</span>
                            <span className="text-[10px]">/{page.slug}</span>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>

                </div>
              )}

              {/* Collections Section */}
              {collectionsWithItems.length > 0 && (
                <div className="flex flex-col gap-2 bg-secondary/20 px-5 pt-4 pb-1 rounded-lg -mx-4">

                  <Label className="gap-1">
                    Collections
                    <Badge variant="secondary" className="text-[10px]">
                      <span className="-mx-1">{totalCollectionItems}</span>
                    </Badge>
                  </Label>

                  <div className="divide-y divide-secondary">
                    {collectionsWithItems.map(({ collection, items }) => {
                      const itemIds = items.map(item => item.id);
                      const selectedCount = itemIds.filter(id => selectedItemIds.has(id)).length;
                      const allSelected = selectedCount === items.length;

                      return (
                        <div key={collection.id} className="flex flex-col gap-2 py-2">

                          <div className="flex items-center justify-between">

                            <Label variant="muted">{collection.name}</Label>

                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() => toggleAllItemsInCollection(collection.id)}
                            >
                              {allSelected ? 'Deselect All' : 'Select All'}
                            </Button>

                          </div>

                          <div className="divide-y divide-secondary">

                            {items.map(item => (
                              <label
                                key={item.id}
                                className="flex-1 flex items-center gap-2 p-3 -mx-3 hover:bg-secondary/50 rounded-lg"
                              >

                                <Checkbox
                                  checked={selectedItemIds.has(item.id)}
                                  onCheckedChange={() => toggleItem(item.id)}
                                />

                                <div className="flex-1 flex items-center text-xs text-muted-foreground">
                                  <span>{item.values.name || 'Untitled'}</span>
                                  {item.values.slug && (
                                    <span className="text-xs text-muted-foreground ml-2">/{item.values.slug}</span>
                                  )}
                                </div>

                                {item.publish_status && (
                                  <Badge className="text-[10px] px-1" variant="secondary">
                                    {item.publish_status.charAt(0).toUpperCase() + item.publish_status.slice(1)}
                                  </Badge>
                                )}

                              </label>
                            ))}

                          </div>

                        </div>
                      );
                    })}
                  </div>

                </div>
              )}

              {/* Components Section */}
              {unpublishedComponents.length > 0 && (
                <div className="flex flex-col gap-2 bg-secondary/20 px-5 pt-4 pb-2 rounded-lg -mx-4">

                  <div className="flex items-center justify-between">

                    <Label className="gap-1">
                      Components
                      <Badge variant="secondary" className="text-[10px]">
                        <span className="-mx-1">{unpublishedComponents.length}</span>
                      </Badge>
                    </Label>

                    <Button
                      size="xs" variant="ghost"
                      onClick={toggleAllComponents}
                    >
                      {selectedComponentIds.size === unpublishedComponents.length ? 'Deselect all' : 'Select all'}
                    </Button>

                  </div>

                  <div className="divide-y divide-secondary">
                    {unpublishedComponents.map(component => (
                      <label
                        key={component.id}
                        className="flex-1 flex items-center gap-2 p-3 -mx-3 hover:bg-secondary/50 rounded-lg"
                      >
                        <Checkbox
                          checked={selectedComponentIds.has(component.id)}
                          onCheckedChange={() => toggleComponent(component.id)}
                        />
                        <div className="flex-1 text-xs text-muted-foreground">
                          <span>{component.name}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Layer Styles Section */}
              {unpublishedLayerStyles.length > 0 && (
                <div className="flex flex-col gap-2 bg-secondary/20 px-5 pt-4 pb-2 rounded-lg -mx-4">

                  <div className="flex items-center justify-between">

                    <Label className="gap-1">
                      Layer styles
                      <Badge variant="secondary" className="text-[10px]">
                        <span className="-mx-1">{unpublishedLayerStyles.length}</span>
                      </Badge>
                    </Label>

                    <Button
                      size="xs" variant="ghost"
                      onClick={toggleAllLayerStyles}
                    >
                      {selectedComponentIds.size === unpublishedComponents.length ? 'Deselect all' : 'Select all'}
                    </Button>

                  </div>

                  <div className="divide-y divide-secondary">
                    {unpublishedLayerStyles.map(style => (
                      <label
                        key={style.id}
                        className="flex-1 flex items-center gap-2 p-3 -mx-3 hover:bg-secondary/50 rounded-lg"
                      >
                        <Checkbox
                          checked={selectedLayerStyleIds.has(style.id)}
                          onCheckedChange={() => toggleLayerStyle(style.id)}
                        />
                        <div className="flex-1 text-xs text-muted-foreground">
                          <span>{style.name}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <Button
                variant="secondary" size="sm"
                onClick={onClose}
                disabled={isPublishing}
              >
                Cancel
              </Button>
              <Button
                onClick={handlePublish}
                size="sm"
                disabled={!hasSelections || isPublishing}
              >
                {isPublishing ? (
                  <>
                    <Spinner />
                  </>
                ) : (
                  <>
                    Publish
                  </>
                )}
              </Button>
            </div>

          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
