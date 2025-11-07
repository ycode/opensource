'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import Icon from '@/components/ui/icon';
import PagesTree from './PagesTree';
import PageSettingsPanel, { type PageFormData } from './PageSettingsPanel';
import FolderSettingsPanel, { FolderFormData } from './FolderSettingsPanel';
import { usePagesStore } from '@/stores/usePagesStore';
import type { Page, PageFolder } from '@/types';

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
  const [showPageSettings, setShowPageSettings] = useState(false);
  const [showFolderSettings, setShowFolderSettings] = useState(false);
  const [editingPage, setEditingPage] = useState<Page | null>(null);
  const [editingFolder, setEditingFolder] = useState<PageFolder | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(currentPageId);
  const selectedItemIdRef = React.useRef<string | null>(currentPageId);

  const selectedPage = React.useMemo(() => {
    if (!selectedItemId) return null;
    return pages.find((page) => page.id === selectedItemId) || null;
  }, [pages, selectedItemId]);

  const selectedFolder = React.useMemo(() => {
    if (!selectedItemId) return null;
    return folders.find((folder) => folder.id === selectedItemId) || null;
  }, [folders, selectedItemId]);

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

  // Get store actions
  const { createPage, updatePage, duplicatePage, deletePage, createFolder, updateFolder, duplicateFolder, deleteFolder, batchReorderPagesAndFolders } = usePagesStore();

  // Sync selection with current page when it changes externally
  useEffect(() => {
    if (currentPageId) {
      setSelectedItemId(currentPageId);
    }
  }, [currentPageId]);

  // Handler to create a new page
  const handleAddPage = async () => {
    // Generate a unique slug based on current timestamp
    const timestamp = Date.now();
    const newPageName = `Page ${pages.length + 1}`;
    const newPageSlug = `page-${timestamp}`;

    // Determine parent and depth based on selected item
    let parentFolderId: string | null = null;
    let newDepth = 0;

    if (selectedItemId) {
      // Check if selected item is a folder
      const selectedFolder = folders.find(f => f.id === selectedItemId);
      if (selectedFolder) {
        // Add inside the folder
        parentFolderId = selectedFolder.id;
        newDepth = selectedFolder.depth + 1;
      } else {
        // Selected item is a page - add at the same level
        const selectedPage = pages.find(p => p.id === selectedItemId);
        if (selectedPage) {
          parentFolderId = selectedPage.page_folder_id;
          newDepth = selectedPage.depth;
        }
      }
    }

    // Calculate order: find max order at the target level
    const siblingPages = pages.filter(p => p.page_folder_id === parentFolderId && p.depth === newDepth);
    const siblingFolders = folders.filter(f => f.page_folder_id === parentFolderId && f.depth === newDepth);
    const maxPageOrder = siblingPages.length > 0 ? Math.max(...siblingPages.map(p => p.order || 0)) : -1;
    const maxFolderOrder = siblingFolders.length > 0 ? Math.max(...siblingFolders.map(f => f.order || 0)) : -1;
    const newOrder = Math.max(maxPageOrder, maxFolderOrder) + 1;

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

  // Handler to create a new folder
  const handleAddFolder = async () => {
    // Generate a unique slug based on current timestamp
    const timestamp = Date.now();
    const newFolderName = `Folder ${folders.length + 1}`;
    const newFolderSlug = `folder-${timestamp}`;

    // Determine parent and depth based on selected item
    let parentFolderId: string | null = null;
    let newDepth = 0;

    if (selectedItemId) {
      // Check if selected item is a folder
      const selectedFolder = folders.find(f => f.id === selectedItemId);
      if (selectedFolder) {
        // Add inside the folder
        parentFolderId = selectedFolder.id;
        newDepth = selectedFolder.depth + 1;
      } else {
        // Selected item is a page - add at the same level
        const selectedPage = pages.find(p => p.id === selectedItemId);
        if (selectedPage) {
          parentFolderId = selectedPage.page_folder_id;
          newDepth = selectedPage.depth;
        }
      }
    }

    // Calculate order: find max order at the target level
    const siblingPages = pages.filter(p => p.page_folder_id === parentFolderId && p.depth === newDepth);
    const siblingFolders = folders.filter(f => f.page_folder_id === parentFolderId && f.depth === newDepth);
    const maxPageOrder = siblingPages.length > 0 ? Math.max(...siblingPages.map(p => p.order || 0)) : -1;
    const maxFolderOrder = siblingFolders.length > 0 ? Math.max(...siblingFolders.map(f => f.order || 0)) : -1;
    const newOrder = Math.max(maxPageOrder, maxFolderOrder) + 1;

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

  // Handle page editing
  const handleEditPage = (page: Page) => {
    setSelectedItemId(page.id);
    setEditingPage(page);
    setShowPageSettings(true);
    setEditingFolder(null);
    setShowFolderSettings(false);
  };

  const handleEditFolder = (folder: PageFolder) => {
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
            console.log('[LeftSidebarPages] Found real duplicated folder, selecting:', duplicatedFolder.id);

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
                      console.log('[LeftSidebarPages] Found real duplicated page inside folder, selecting:', realPage.id);
                      setSelectedItemId(realPage.id);
                    } else {
                      // Fall back to selecting the folder
                      console.log('[LeftSidebarPages] Could not find real page, falling back to folder');
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
                        console.log('[LeftSidebarPages] Found real duplicated nested folder, selecting:', realFolder.id);
                        setSelectedItemId(realFolder.id);
                      } else {
                        // Fall back to selecting the root duplicated folder
                        console.log('[LeftSidebarPages] Could not find real nested folder, falling back to root folder');
                        setSelectedItemId(duplicatedFolder.id);
                      }
                    }
                  }
                } else {
                  // No snapshot found, select root folder
                  console.log('[LeftSidebarPages] No snapshot found for selection, selecting root folder');
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
            console.log('[LeftSidebarPages] Found real duplicated page, selecting:', duplicatedPage.id);
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
          setCurrentPageId(result.nextPageId);
          setSelectedItemId(result.nextPageId);
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
          setCurrentPageId(result.nextPageId);
          setSelectedItemId(result.nextPageId);
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
                  <DropdownMenuItem>Collection 1</DropdownMenuItem>
                  <DropdownMenuItem>Collection 2</DropdownMenuItem>
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

      <div className="flex flex-col">
        <PagesTree
          pages={pages}
          folders={folders}
          selectedItemId={selectedItemId}
          currentPageId={currentPageId}
          onPageSelect={(pageId) => {
            // Just select the page, don't navigate to it
            setSelectedItemId(pageId);
          }}
          onFolderSelect={(folderId) => {
            setSelectedItemId(folderId);
          }}
          onPageOpen={(pageId) => {
            // Open/navigate to the page for editing
            onPageSelect(pageId);
            setCurrentPageId(pageId);
            setSelectedItemId(pageId);
          }}
          onReorder={handleReorder}
          onPageSettings={handleEditPage}
          onFolderSettings={handleEditFolder}
          onDuplicate={handleDuplicate}
          onDelete={deletePageOrFolderItem}
        />
      </div>

      {/* Page settings panel */}
      <PageSettingsPanel
        isOpen={showPageSettings}
        onClose={() => {
          setShowPageSettings(false);
          setEditingPage(null);
        }}
        page={editingPage}
        onSave={handleSavePage}
      />

      {/* Folder settings panel */}
      <FolderSettingsPanel
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

