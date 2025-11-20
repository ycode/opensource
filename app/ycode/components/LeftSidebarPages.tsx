'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import Icon from '@/components/ui/icon';
import PagesTree from './PagesTree';
import PageSettingsPanel, { type PageFormData, type PageSettingsPanelHandle } from './PageSettingsPanel';
import FolderSettingsPanel, { type FolderFormData, type FolderSettingsPanelHandle } from './FolderSettingsPanel';
import { usePagesStore } from '@/stores/usePagesStore';
import { useEditorActions, useEditorUrl } from '@/hooks/use-editor-url';
import type { Collection, Page, PageFolder } from '@/types';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import { Separator } from '@/components/ui/separator';
import { generateUniqueSlug, generateUniqueFolderSlug, getNextNumberFromNames, getParentContextFromSelection, calculateNextOrder } from '@/lib/page-utils';

interface LeftSidebarPagesProps {
  pages: Page[];
  folders: PageFolder[];
  currentPageId: string | null;
  onPageSelect: (pageId: string) => void;
  setCurrentPageId: (pageId: string | null) => void;
}

export default function LeftSidebarPages({
  pages,
  folders,
  currentPageId,
  onPageSelect,
  setCurrentPageId,
}: LeftSidebarPagesProps) {
  const { routeType, urlState } = useEditorUrl();
  const { openPage, openPageEdit, openPageLayers, navigateToLayers, navigateToPage, navigateToPageEdit, navigateToCollections } = useEditorActions();
  const [showPageSettings, setShowPageSettings] = useState(false);
  const [showFolderSettings, setShowFolderSettings] = useState(false);
  const [editingPage, setEditingPage] = useState<Page | null>(null);
  const [editingFolder, setEditingFolder] = useState<PageFolder | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(currentPageId);
  const selectedItemIdRef = React.useRef<string | null>(currentPageId);
  const pageSettingsPanelRef = useRef<PageSettingsPanelHandle>(null);
  const folderSettingsPanelRef = useRef<FolderSettingsPanelHandle>(null);

  const selectedPage = React.useMemo(() => {
    if (!selectedItemId) return null;
    return pages.find((page) => page.id === selectedItemId) || null;
  }, [pages, selectedItemId]);

  const selectedFolder = React.useMemo(() => {
    if (!selectedItemId) return null;
    return folders.find((folder) => folder.id === selectedItemId) || null;
  }, [folders, selectedItemId]);

  // Separate regular pages from error pages
  const { regularPages, errorPages } = React.useMemo(() => {
    const regular = pages.filter(page => page.error_page === null);
    const errors = pages
      .filter(page => page.error_page !== null)
      .sort((a, b) => (a.error_page || 0) - (b.error_page || 0));
    return { regularPages: regular, errorPages: errors };
  }, [pages]);

  // Keep ref in sync with state
  useEffect(() => {
    selectedItemIdRef.current = selectedItemId;
  }, [selectedItemId]);

  // Switch page or folder settings when selecting another item
  useEffect(() => {
    // Don't open settings panel if it's not already open
    if (!showPageSettings && !showFolderSettings) return;

    if (selectedPage) {
      setEditingPage(selectedPage);
      setEditingFolder(null);
      setShowPageSettings(true);
      setShowFolderSettings(false);
    } else if (selectedFolder) {
      setEditingPage(null);
      setEditingFolder(selectedFolder);
      setShowPageSettings(false);
      setShowFolderSettings(true);
    }
  }, [selectedPage, selectedFolder, showPageSettings, showFolderSettings]);

  // Open page settings panel when on the edit route
  useEffect(() => {
    if (urlState.isEditing && selectedPage) {
      setEditingPage(selectedPage);
      setShowPageSettings(true);
    } else if (!urlState.isEditing && showPageSettings) {
      // Close settings panel when navigating away from edit route
      setShowPageSettings(false);
      setEditingPage(null);
    }
  }, [urlState.isEditing, selectedPage, showPageSettings]);

  // Get store actions
  const { createPage, updatePage, duplicatePage, deletePage, createFolder, updateFolder, duplicateFolder, deleteFolder, batchReorderPagesAndFolders } = usePagesStore();
  const { collections } = useCollectionsStore();

  // Sync selection with current page when it changes externally
  useEffect(() => {
    if (currentPageId) {
      setSelectedItemId(currentPageId);
    }
  }, [currentPageId]);

  // Handler to create a new page
  const handleAddPage = async () => {
    const { parentFolderId, newDepth } = getParentContextFromSelection(selectedItemId, pages, folders);

    // Get the next available page number in this folder context
    const pagesInFolder = pages.filter(p => p.page_folder_id === parentFolderId);
    const pageNumber = getNextNumberFromNames(pagesInFolder, 'Page');
    const newPageName = `Page ${pageNumber}`;

    // Calculate order: find max order at the target level
    const newOrder = calculateNextOrder(parentFolderId, newDepth, pages, folders);

    // Generate unique slug for the new page
    const newPageSlug = generateUniqueSlug(newPageName, pages, parentFolderId, false);

    // Create page with optimistic update
    const createPromise = createPage({
      name: newPageName,
      slug: newPageSlug,
      is_published: false,
      page_folder_id: parentFolderId,
      order: newOrder,
      depth: newDepth,
      is_index: false,
      is_dynamic: false,
      error_page: null,
      settings: {},
    });

    // Handle the result asynchronously
    createPromise.then(result => {
      if (result.success && result.data && result.tempId) {
        // Update selection to use real ID if temp was selected
        if (selectedItemIdRef.current === result.tempId) {
          setSelectedItemId(result.data.id);
        }

        // Navigate to the new page based on current route type
        if (routeType === 'layers') {
          navigateToLayers(result.data.id, urlState.view || undefined, urlState.rightTab || undefined, urlState.layerId || undefined);
        } else if (routeType === 'page' && urlState.isEditing) {
          navigateToPageEdit(result.data.id);
        } else if (routeType === 'page') {
          navigateToPage(result.data.id, urlState.view || undefined, urlState.rightTab || undefined, urlState.layerId || undefined);
        } else {
          // Default to layers if no route type
          navigateToLayers(result.data.id, urlState.view || undefined, urlState.rightTab || undefined, urlState.layerId || undefined);
        }
      } else if (result.error) {
        console.error('Error creating page:', result.error);
      }
    });

    // Immediately select the new page from store (will have temp ID initially)
    const tempPage = usePagesStore.getState().pages[usePagesStore.getState().pages.length - 1];
    if (tempPage) {
      setSelectedItemId(tempPage.id);
    }
  };

  const handleAddDynamicPage = async (collectionId: string | null) => {
    if (!collectionId) {
      // Navigate to CMS (collections view)
      navigateToCollections();
      return;
    }

    // TODO: Create a new dynamic page
  };

  // Handler to create a new folder
  const handleAddFolder = async () => {
    const { parentFolderId, newDepth } = getParentContextFromSelection(selectedItemId, pages, folders);

    // Get the next available folder number in this parent folder context
    const foldersInParent = folders.filter(f => f.page_folder_id === parentFolderId);
    const folderNumber = getNextNumberFromNames(foldersInParent, 'Folder');
    const newFolderName = `Folder ${folderNumber}`;

    // Calculate order: find max order at the target level
    const newOrder = calculateNextOrder(parentFolderId, newDepth, pages, folders);

    // Generate unique slug for the new folder
    const newFolderSlug = generateUniqueFolderSlug(newFolderName, folders, parentFolderId);

    // Create folder with optimistic update
    const createPromise = createFolder({
      name: newFolderName,
      slug: newFolderSlug,
      page_folder_id: parentFolderId,
      depth: newDepth,
      order: newOrder,
      settings: {},
      is_published: false,
    });

    // Handle the result asynchronously
    createPromise.then(result => {
      if (result.success && result.data && result.tempId) {
        // Update selection to use real ID if temp was selected
        if (selectedItemIdRef.current === result.tempId) {
          setSelectedItemId(result.data.id);
        }
      } else if (result.error) {
        console.error('Error creating folder:', result.error);
      }
    });

    // Immediately select the new folder from store (will have temp ID initially)
    const tempFolder = usePagesStore.getState().folders[usePagesStore.getState().folders.length - 1];
    if (tempFolder) {
      setSelectedItemId(tempFolder.id);
    }
  };

  // Helper to check for unsaved changes before any selection change
  const checkBeforeSelectionChange = async (): Promise<boolean> => {
    // Check page settings panel if open
    if (showPageSettings && pageSettingsPanelRef.current) {
      const canProceed = await pageSettingsPanelRef.current.checkUnsavedChanges();
      if (!canProceed) {
        return false;
      }
    }

    // Check folder settings panel if open
    if (showFolderSettings && folderSettingsPanelRef.current) {
      const canProceed = await folderSettingsPanelRef.current.checkUnsavedChanges();
      if (!canProceed) {
        return false;
      }
    }

    return true;
  };

  // Handle page selection with unsaved changes check
  const handlePageSelect = async (pageId: string) => {
    const canProceed = await checkBeforeSelectionChange();
    if (!canProceed) {
      return;
    }
    setSelectedItemId(pageId);

    // Preserve current query params (convert null to undefined)
    const view = urlState.view || undefined;
    const rightTab = urlState.rightTab || undefined;
    const layerId = urlState.layerId || undefined;

    // Navigate to the same route type but with the new page ID
    if (routeType === 'layers') {
      navigateToLayers(pageId, view, rightTab, layerId);
    } else if (routeType === 'page' && urlState.isEditing) {
      navigateToPageEdit(pageId);
    } else if (routeType === 'page') {
      navigateToPage(pageId, view, rightTab, layerId);
    } else {
      // Default to layers if no route type (shouldn't happen, but safe fallback)
      navigateToLayers(pageId, view, rightTab, layerId);
    }
  };

  // Handle folder selection with unsaved changes check
  const handleFolderSelect = async (folderId: string) => {
    const canProceed = await checkBeforeSelectionChange();
    if (!canProceed) {
      return;
    }
    setSelectedItemId(folderId);
  };

  // Handle page editing
  const handleEditPage = async (page: Page) => {
    // Check for unsaved changes before switching
    const canProceed = await checkBeforeSelectionChange();
    if (!canProceed) {
      return;
    }

    setSelectedItemId(page.id);
    setEditingPage(page);
    setShowPageSettings(true);
    setEditingFolder(null);
    setShowFolderSettings(false);

    // Navigate to the edit route
    navigateToPageEdit(page.id);
  };

  const handleEditFolder = async (folder: PageFolder) => {
    // Check for unsaved changes before switching
    const canProceed = await checkBeforeSelectionChange();
    if (!canProceed) {
      return;
    }

    setSelectedItemId(folder.id);
    setEditingFolder(folder);
    setShowFolderSettings(true);
    setEditingPage(null);
    setShowPageSettings(false);
  };

  const handleSavePage = async (data: PageFormData) => {
    if (!editingPage) return;

    // Update in background
    const result = await updatePage(editingPage.id, {
      name: data.name,
      slug: data.slug,
      page_folder_id: data.page_folder_id,
      is_index: data.is_index,
      settings: data.settings,
    });

    if (result.error) {
      console.error('Failed to save page:', result.error);
      // Could show a toast notification here
    }
  };

  const handleSaveFolder = async (data: FolderFormData) => {
    if (!editingFolder) return;

    // Update in background
    const result = await updateFolder(editingFolder.id, {
      name: data.name,
      slug: data.slug,
      page_folder_id: data.page_folder_id,
    });

    if (result.error) {
      console.error('Failed to save folder:', result.error);
      // Could show a toast notification here
    }
  };

  const handleReorder = async (updatedPages: Page[], updatedFolders: PageFolder[]) => {
    const result = await batchReorderPagesAndFolders(updatedPages, updatedFolders);

    if (result.error) {
      console.error('Failed to reorder items:', result.error);
      // Could show a toast notification here
    }
  };

  // Handle duplicate page/folder
  // Track pending duplication for selection after reload (works for both pages and folders)
  const [pendingDuplicateSelection, setPendingDuplicateSelection] = React.useState<{
    tempId: string;
    expectedName: string;
    parentFolderId: string | null;
    type: 'page' | 'folder';
    allTempIds?: Set<string>; // All temp IDs created during duplication (for folders with contents)
    tempItemsSnapshot?: Map<string, { name: string; type: 'page' | 'folder' }>; // Snapshot of temp items
  } | null>(null);

  // Watch for changes and update selection if we're waiting for a duplicate
  useEffect(() => {
    if (pendingDuplicateSelection) {
      const { tempId, expectedName, parentFolderId, type, allTempIds } = pendingDuplicateSelection;

      // Check if current selection is any of the temp IDs from this duplication
      const isSelectingTempFromDuplication = allTempIds
        ? allTempIds.has(selectedItemIdRef.current || '')
        : selectedItemIdRef.current === tempId;

      if (type === 'folder') {
        // Check if temp folder ID no longer exists (data has been reloaded)
        const tempExists = folders.some(f => f.id === tempId);

        if (!tempExists) {
          // Find the real duplicated folder
          const duplicatedFolder = folders.find(
            f => f.name === expectedName &&
                 f.page_folder_id === parentFolderId &&
                 !f.id.startsWith('temp-')
          );

          if (duplicatedFolder) {
            // Update selection if user is selecting any temp item from this duplication
            if (isSelectingTempFromDuplication) {
              // Try to find the corresponding real item based on what was selected
              const currentSelectionId = selectedItemIdRef.current;

              if (currentSelectionId && allTempIds && pendingDuplicateSelection.tempItemsSnapshot) {
                const selectedItemSnapshot = pendingDuplicateSelection.tempItemsSnapshot.get(currentSelectionId);

                if (selectedItemSnapshot) {
                  if (selectedItemSnapshot.type === 'page') {
                    // User selected a page inside the duplicated folder
                    // Get all descendant folder IDs of the duplicated folder
                    const getDescendantFolderIds = (folderId: string): string[] => {
                      const childFolders = folders.filter(f => f.page_folder_id === folderId && !f.id.startsWith('temp-'));
                      const ids = childFolders.map(f => f.id);
                      childFolders.forEach(f => {
                        ids.push(...getDescendantFolderIds(f.id));
                      });
                      return ids;
                    };

                    const validFolderIds = [duplicatedFolder.id, ...getDescendantFolderIds(duplicatedFolder.id)];

                    // Find real page by name in the duplicated folder hierarchy
                    const realPage = pages.find(
                      p => p.name === selectedItemSnapshot.name &&
                           p.page_folder_id &&
                           validFolderIds.includes(p.page_folder_id) &&
                           !p.id.startsWith('temp-')
                    );
                    if (realPage) {
                      setSelectedItemId(realPage.id);
                    } else {
                      // Fall back to selecting the folder
                      setSelectedItemId(duplicatedFolder.id);
                    }
                  } else if (selectedItemSnapshot.type === 'folder') {
                    // User selected a nested folder inside the duplicated folder
                    if (currentSelectionId === tempId) {
                      // Selecting the root folder itself
                      setSelectedItemId(duplicatedFolder.id);
                    } else {
                      // Selecting a nested folder
                      const getDescendantFolderIds = (folderId: string): string[] => {
                        const childFolders = folders.filter(f => f.page_folder_id === folderId && !f.id.startsWith('temp-'));
                        const ids = childFolders.map(f => f.id);
                        childFolders.forEach(f => {
                          ids.push(...getDescendantFolderIds(f.id));
                        });
                        return ids;
                      };

                      const descendantFolderIds = getDescendantFolderIds(duplicatedFolder.id);

                      // Find real folder by name in the duplicated folder hierarchy
                      const realFolder = folders.find(
                        f => f.name === selectedItemSnapshot.name &&
                             f.id !== duplicatedFolder.id &&
                             descendantFolderIds.includes(f.id) &&
                             !f.id.startsWith('temp-')
                      );
                      if (realFolder) {
                        setSelectedItemId(realFolder.id);
                      } else {
                        // Fall back to selecting the root duplicated folder
                        setSelectedItemId(duplicatedFolder.id);
                      }
                    }
                  }
                } else {
                  // No snapshot found, select root folder
                  setSelectedItemId(duplicatedFolder.id);
                }
              } else {
                // Selecting the root folder itself (no snapshot needed)
                setSelectedItemId(duplicatedFolder.id);
              }
            }
            setPendingDuplicateSelection(null);
          }
        }
      } else {
        // Check if temp page ID no longer exists (data has been reloaded)
        const tempExists = pages.some(p => p.id === tempId);

        if (!tempExists) {
          // Find the real duplicated page
          const duplicatedPage = pages.find(
            p => p.name === expectedName &&
                 p.page_folder_id === parentFolderId &&
                 !p.id.startsWith('temp-')
          );

          if (duplicatedPage) {
            // Only update selection if it's still the temp ID (user hasn't changed selection during operation)
            if (isSelectingTempFromDuplication) {
              setSelectedItemId(duplicatedPage.id);
            }
            setPendingDuplicateSelection(null);
          }
        }
      }
    }
  }, [pages, folders, pendingDuplicateSelection]);

  const handleDuplicate = async (id: string, type: 'folder' | 'page') => {
    if (type === 'folder') {
      // Duplicate the folder
      const result = await duplicateFolder(id);

      if (result.success && result.data) {
        // Select the newly duplicated folder (temp ID initially)
        setSelectedItemId(result.data.id);

        // Track this duplication so we can update selection after reload
        if (result.metadata) {
          // Collect all temp IDs created during this duplication (folder + all pages inside)
          // All items from a single duplication share the same timestamp in their temp IDs
          const allTempIds = new Set<string>();
          const tempItemsSnapshot = new Map<string, { name: string; type: 'page' | 'folder' }>();

          allTempIds.add(result.metadata.tempId);

          // Extract timestamp from temp ID (format: temp-folder-{timestamp}-...)
          const timestampMatch = result.metadata.tempId.match(/temp-\w+-(\d+)-/);
          if (timestampMatch) {
            const timestamp = timestampMatch[1];

            // Find all temp pages and folders created in this operation by matching timestamp
            const tempFolders = folders.filter(f => f.id.includes(`-${timestamp}-`));
            const tempPages = pages.filter(p => p.id.includes(`-${timestamp}-`));

            // Store snapshot of all temp items (name + type) before they get replaced
            tempFolders.forEach(f => {
              allTempIds.add(f.id);
              tempItemsSnapshot.set(f.id, { name: f.name, type: 'folder' });
            });
            tempPages.forEach(p => {
              allTempIds.add(p.id);
              tempItemsSnapshot.set(p.id, { name: p.name, type: 'page' });
            });
          }

          setPendingDuplicateSelection({
            tempId: result.metadata.tempId,
            expectedName: result.metadata.expectedName,
            parentFolderId: result.metadata.parentFolderId,
            type: 'folder',
            allTempIds,
            tempItemsSnapshot,
          });
        }
      } else if (result.error) {
        console.error('Failed to duplicate folder:', result.error);
        // Could show a toast notification here
      }
    } else {
      // Duplicate the page
      const result = await duplicatePage(id);

      if (result.success && result.data) {
        // Select the newly duplicated page (temp ID initially)
        setSelectedItemId(result.data.id);

        // Track this duplication so we can update selection after reload
        if (result.metadata) {
          setPendingDuplicateSelection({
            tempId: result.metadata.tempId,
            expectedName: result.metadata.expectedName,
            parentFolderId: result.metadata.parentFolderId,
            type: 'page',
          });
        }
      } else if (result.error) {
        console.error('Failed to duplicate page:', result.error);
        // Could show a toast notification here
      }
    }
  };

  // Find the best next item to select after deleting an item
  const findNextSelection = (deletedId: string, deletedType: 'folder' | 'page'): string | null => {
    // Get the deleted item's parent and depth
    const deletedItem = deletedType === 'folder'
      ? folders.find(f => f.id === deletedId)
      : pages.find(p => p.id === deletedId);

    if (!deletedItem) return null;

    const parentId = deletedType === 'folder'
      ? deletedItem.page_folder_id
      : deletedItem.page_folder_id;
    const depth = deletedItem.depth;
    const order = deletedItem.order || 0;

    // Get all siblings (pages and folders at same depth and parent)
    const siblingPages = pages.filter(p =>
      p.id !== deletedId &&
      p.page_folder_id === parentId &&
      p.depth === depth
    );
    const siblingFolders = folders.filter(f =>
      f.id !== deletedId &&
      f.page_folder_id === parentId &&
      f.depth === depth
    );

    // Combine and sort by order
    const allSiblings = [
      ...siblingPages.map(p => ({ id: p.id, order: p.order || 0, type: 'page' as const })),
      ...siblingFolders.map(f => ({ id: f.id, order: f.order || 0, type: 'folder' as const }))
    ].sort((a, b) => a.order - b.order);

    if (allSiblings.length > 0) {
      // Try to find the next sibling (item with order greater than deleted item)
      const nextSibling = allSiblings.find(s => s.order > order);
      if (nextSibling) {
        return nextSibling.id;
      }

      // No next sibling, get the last sibling (previous)
      return allSiblings[allSiblings.length - 1].id;
    }

    // No siblings, select parent folder
    return parentId;
  };

  // Handle page or folder deletion
  const deletePageOrFolderItem = async (id: string, type: 'folder' | 'page') => {
    const wasSelected = selectedItemId === id;
    const wasCurrentPage = currentPageId === id;

    // Find next selection BEFORE deletion (while item still exists)
    const nextSelection = wasSelected ? findNextSelection(id, type) : null;

    // Update selection immediately (optimistically) if item was selected but not opened
    if (wasSelected && !wasCurrentPage) {
      setSelectedItemId(nextSelection);
    }

    if (type === 'folder') {
      // Delete folder via store (handles all logic including cascade deletion)
      const result = await deleteFolder(id, currentPageId);

      if (!result.success) {
        console.error('Failed to delete folder:', result.error);
        // Revert selection on error
        if (wasSelected && !wasCurrentPage) {
          setSelectedItemId(id);
        }
        return;
      }

      // Handle current page updates (only if the opened page was affected)
      if (result.currentPageAffected) {
        if (result.nextPageId) {
          // Current page was deleted, switch to the suggested next page
          onPageSelect(result.nextPageId);
          setSelectedItemId(result.nextPageId);
          openPage(result.nextPageId);
        } else {
          // No pages left
          onPageSelect('');
          setCurrentPageId(null);
          setSelectedItemId(null);
        }
      }
      return;
    }

    // Handle page deletion
    if (type === 'page') {
      // Delete via store (handles all logic)
      const result = await deletePage(id, currentPageId);

      if (!result.success) {
        console.error('Failed to delete page:', result.error);
        // Revert selection on error
        if (wasSelected && !wasCurrentPage) {
          setSelectedItemId(id);
        }
        return;
      }

      // Handle current page updates (only if the opened page was deleted)
      if (result.currentPageDeleted) {
        if (result.nextPageId) {
          // Current page was deleted, switch to the suggested next page
          onPageSelect(result.nextPageId);
          setSelectedItemId(result.nextPageId);

          // Navigate to the same route type but with the new page ID
          if (routeType === 'layers') {
            navigateToLayers(result.nextPageId, urlState.view || undefined, urlState.rightTab || undefined, urlState.layerId || undefined);
          } else if (routeType === 'page' && urlState.isEditing) {
            navigateToPageEdit(result.nextPageId);
          } else if (routeType === 'page') {
            navigateToPage(result.nextPageId, urlState.view || undefined, urlState.rightTab || undefined, urlState.layerId || undefined);
          } else {
            // Default to layers if no route type
            navigateToLayers(result.nextPageId, urlState.view || undefined, urlState.rightTab || undefined, urlState.layerId || undefined);
          }
        } else {
          // No pages left
          onPageSelect('');
          setCurrentPageId(null);
          setSelectedItemId(null);
        }
      }
    }
  };

  return (
    <>
      <header className="py-5 flex justify-between">
        <span className="font-medium">Pages</span>
        <div className="-my-1">
          <DropdownMenu onOpenChange={setIsMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button size="xs" variant="secondary">
                <Icon name="plus" className={`${isMenuOpen ? 'rotate-45' : 'rotate-0'} transition-transform duration-100`} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="bottom">
              <DropdownMenuItem onClick={handleAddPage}>
                Regular
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>CMS</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {collections.length > 0 ? (
                    collections.map(collection => (
                      <DropdownMenuItem key={collection.id} onClick={() => handleAddDynamicPage(collection.id)}>
                        {collection.name}
                      </DropdownMenuItem>
                    ))
                  ) : (
                    <DropdownMenuItem key={null} onClick={() => handleAddDynamicPage(null)}>
                      Add a collection
                    </DropdownMenuItem>
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleAddFolder}>
                Folder
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex flex-col gap-3">
        <PagesTree
          pages={regularPages}
          folders={folders}
          selectedItemId={selectedItemId}
          currentPageId={currentPageId}
          onPageSelect={handlePageSelect}
          onFolderSelect={handleFolderSelect}
          onPageOpen={(pageId) => {
            onPageSelect(pageId);
            setCurrentPageId(pageId);
            handlePageSelect(pageId); // This will also navigate
          }}
          onReorder={handleReorder}
          onPageSettings={handleEditPage}
          onFolderSettings={handleEditFolder}
          onDuplicate={handleDuplicate}
          onDelete={deletePageOrFolderItem}
        />

        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-muted-foreground font-medium">Error pages</span>
          <Separator className="flex-1" />
        </div>

        {/* Error pages tree */}
        {errorPages.length > 0 && (
          <PagesTree
            pages={errorPages}
            folders={[]}
            selectedItemId={selectedItemId}
            currentPageId={currentPageId}
            onPageSelect={handlePageSelect}
            onPageOpen={(pageId) => {
              onPageSelect(pageId);
              setCurrentPageId(pageId);
              handlePageSelect(pageId); // This will also navigate
            }}
            onPageSettings={handleEditPage}
            onFolderSettings={handleEditFolder}
          />
        )}
      </div>

      {/* Page settings panel */}
      <PageSettingsPanel
        ref={pageSettingsPanelRef}
        isOpen={showPageSettings}
        onClose={() => {
          setShowPageSettings(false);
          setEditingPage(null);

          // Navigate back to pages view if we're in edit mode
          if (urlState.isEditing && currentPageId) {
            navigateToPage(currentPageId, urlState.view || undefined, urlState.rightTab || undefined, urlState.layerId || undefined);
          }
        }}
        page={editingPage}
        onSave={handleSavePage}
      />

      {/* Folder settings panel */}
      <FolderSettingsPanel
        ref={folderSettingsPanelRef}
        isOpen={showFolderSettings}
        onClose={() => {
          setShowFolderSettings(false);
          setEditingFolder(null);
        }}
        folder={editingFolder}
        onSave={handleSaveFolder}
      />
    </>
  );
}

