'use client';

import React, { useState, useEffect, useRef, startTransition, Suspense, lazy } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import Icon from '@/components/ui/icon';
import PagesTree from './PagesTree';
import { type PageFormData, type PageSettingsPanelHandle } from './PageSettingsPanel';
import { type FolderFormData, type FolderSettingsPanelHandle } from './FolderSettingsPanel';

// Lazy-loaded components (heavy settings panels, not needed immediately)
const PageSettingsPanel = lazy(() => import('./PageSettingsPanel'));
const FolderSettingsPanel = lazy(() => import('./FolderSettingsPanel'));
import { usePagesStore } from '@/stores/usePagesStore';
import { useEditorStore } from '@/stores/useEditorStore';
import { useEditorActions, useEditorUrl } from '@/hooks/use-editor-url';
import type { Page, PageFolder, PageSettings } from '@/types';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import { Separator } from '@/components/ui/separator';
import { generateUniqueSlug, generateUniqueFolderSlug, getNextNumberFromNames, getParentContextFromSelection, calculateNextOrder, findNextSelection } from '@/lib/page-utils';

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

  // No reactive opening/closing - panel is controlled purely by user actions
  // However, check URL on initial load to open panel if URL has ?edit param
  const hasCheckedInitialUrlRef = useRef(false);
  useEffect(() => {
    // Only check once on initial mount
    if (hasCheckedInitialUrlRef.current) return;
    hasCheckedInitialUrlRef.current = true;

    // If URL has ?edit param and the selected page matches the URL page ID, open the panel
    if (urlState.isEditing && urlState.resourceId && selectedPage && selectedPage.id === urlState.resourceId && !showPageSettings) {
      setEditingPage(selectedPage);
      setShowPageSettings(true);
    }
  }, [urlState.isEditing, urlState.resourceId, selectedPage, showPageSettings]);

  // Get store actions
  const { createPage, updatePage, duplicatePage, deletePage, createFolder, updateFolder, duplicateFolder, deleteFolder, batchReorderPagesAndFolders } = usePagesStore();
  const { collections, fields } = useCollectionsStore();

  // Sync selection with current page when it changes externally
  useEffect(() => {
    if (currentPageId) {
      setSelectedItemId(currentPageId);
    }
  }, [currentPageId]);

  // Handler to create a new page (if a collection ID is given this will be a dynamic page)
  const handleAddPage = async (collectionId?: string) => {
    const { parentFolderId, newDepth } = getParentContextFromSelection(selectedItemId, pages, folders);

    // Get the next available page number in this folder context
    const pagesInFolder = pages.filter(p => p.page_folder_id === parentFolderId);
    const pageNumber = getNextNumberFromNames(pagesInFolder, 'Page');
    const newPageName = `Page ${pageNumber}`;

    // Calculate order: insert right after selected item if it's a page, otherwise append to end
    const newOrder = calculateNextOrder(parentFolderId, newDepth, pages, folders, selectedItemId);

    // Prepare settings object
    const settings: PageSettings = {};

    // If collection ID is provided, set up dynamic page with CMS settings
    if (collectionId) {
      // Check if folder already contains a dynamic page
      const existingDynamicPage = pages.find(
        (p) =>
          p.is_dynamic &&
          p.page_folder_id === parentFolderId &&
          p.is_published === false // Check same published state
      );

      if (existingDynamicPage) {
        const folderName = parentFolderId ? 'this folder' : 'the root folder';
        alert(`A dynamic page already exists in ${folderName}. Each folder can only contain one dynamic page.`);
        return;
      }

      // Use preloaded fields from store
      const collectionFields = fields[collectionId] || [];

      // Find the slug field (built-in field with key = 'slug')
      const slugField = collectionFields.find(field => field.key === 'slug');

      if (!slugField) return console.warn('Slug field not found for collection:', collectionId);

      settings.cms = {
        collection_id: collectionId,
        slug_field_id: slugField.id,
      };
    }

    // Dynamic pages should have empty slug
    const newPageSlug = collectionId ? '*' : generateUniqueSlug(newPageName, pages, parentFolderId, false);

    // Create page with optimistic update
    const createPromise = createPage({
      name: newPageName,
      slug: newPageSlug,
      is_published: false,
      page_folder_id: parentFolderId,
      order: newOrder,
      depth: newDepth,
      is_index: false,
      is_dynamic: !!collectionId, // Set to true if collection ID is provided
      error_page: null,
      settings,
    });

    // Handle the result asynchronously
    createPromise.then(result => {
      if (result.success && result.data && result.tempId) {
        // Update selection to use real ID (the temp page should already be selected)
        if (selectedItemIdRef.current === result.tempId) {
          setSelectedItemId(result.data.id);
          selectedItemIdRef.current = result.data.id;
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

    // Select new page from store (optimistic update is synchronous - find temp page matching order/parentFolderId)
    const storeState = usePagesStore.getState();
    const tempPage = storeState.pages.find(p =>
      p.id.startsWith('temp-page-') &&
      p.page_folder_id === parentFolderId &&
      p.depth === newDepth &&
      p.order === newOrder
    );

    if (tempPage) {
      setSelectedItemId(tempPage.id);
      selectedItemIdRef.current = tempPage.id;
    }
  };

  // Handler to create a new folder
  const handleAddFolder = async () => {
    const { parentFolderId, newDepth } = getParentContextFromSelection(selectedItemId, pages, folders);

    // Get the next available folder number in this parent folder context
    const foldersInParent = folders.filter(f => f.page_folder_id === parentFolderId);
    const folderNumber = getNextNumberFromNames(foldersInParent, 'Folder');
    const newFolderName = `Folder ${folderNumber}`;

    // Calculate order: insert right after selected item if it's a page, otherwise append to end
    const newOrder = calculateNextOrder(parentFolderId, newDepth, pages, folders, selectedItemId);

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
    
    // Immediate UI feedback - selection updates instantly
    setSelectedItemId(pageId);

    // Preserve current query params (convert null to undefined)
    const view = urlState.view || undefined;
    const rightTab = urlState.rightTab || undefined;
    const layerId = urlState.layerId || undefined;

    // Defer navigation to avoid blocking UI
    startTransition(() => {
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
    });
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

  /**
   * Navigate to a page based on current route type
   */
  const navigateToNextPage = (pageId: string) => {
    if (routeType === 'layers') {
      navigateToLayers(pageId, urlState.view || undefined, urlState.rightTab || undefined, urlState.layerId || undefined);
    } else if (routeType === 'page' && urlState.isEditing) {
      navigateToPageEdit(pageId);
    } else if (routeType === 'page') {
      navigateToPage(pageId, urlState.view || undefined, urlState.rightTab || undefined, urlState.layerId || undefined);
    } else {
      // Default to layers if no route type
      navigateToLayers(pageId, urlState.view || undefined, urlState.rightTab || undefined, urlState.layerId || undefined);
    }
  };

  // Handle page or folder deletion
  const deletePageOrFolderItem = async (id: string, type: 'folder' | 'page') => {
    const wasSelected = selectedItemId === id;
    const wasCurrentPage = currentPageId === id;

    // Close settings panel if item was being edited
    if (type === 'folder' && editingFolder?.id === id) {
      setShowFolderSettings(false);
      setEditingFolder(null);
    } else if (type === 'page' && editingPage?.id === id) {
      setShowPageSettings(false);
      setEditingPage(null);
    }

    // Handle folder deletion
    if (type === 'folder') {
      // Find next selection optimistically
      const nextSelection = wasSelected ? findNextSelection(id, type, pages, folders) : null;
      if (wasSelected && !wasCurrentPage && nextSelection) {
        setSelectedItemId(nextSelection);
      }

      const result = await deleteFolder(id, currentPageId);

      if (!result.success) {
        console.error('Failed to delete folder:', result.error);
        // Revert selection on error
        if (wasSelected && !wasCurrentPage) {
          setSelectedItemId(id);
        }
        return;
      }

      // Handle current page updates if affected
      if (result.currentPageAffected) {
        if (result.nextPageId) {
          onPageSelect(result.nextPageId);
          setSelectedItemId(result.nextPageId);
          openPage(result.nextPageId);
        } else {
          onPageSelect('');
          setCurrentPageId(null);
          setSelectedItemId(null);
        }
      }
      return;
    }

    // Handle page deletion
    // Find next selection optimistically (before API call)
    const nextSelection = wasSelected ? findNextSelection(id, type, pages, folders) : null;

    // Select next item immediately (optimistically) - can be page or folder
    if (nextSelection) {
      setSelectedItemId(nextSelection);
    } else if (wasSelected) {
      setSelectedItemId(null);
    }

    // If current page is being deleted, handle navigation optimistically
    if (wasCurrentPage) {
      // Only navigate if next selection is a page (not a folder)
      const nextPageId = nextSelection && pages.some(p => p.id === nextSelection && p.error_page === null)
        ? nextSelection
        : null;

      if (nextPageId) {
        onPageSelect(nextPageId);
        navigateToNextPage(nextPageId);
      } else {
        // No pages left - fallback to homepage or first page
        const regularPages = pages.filter(p => p.id !== id && p.error_page === null);
        if (regularPages.length > 0) {
          const homePage = regularPages.find(p => p.is_index && !p.page_folder_id);
          const fallbackPageId = (homePage || regularPages[0]).id;
          onPageSelect(fallbackPageId);
          navigateToNextPage(fallbackPageId);
          setSelectedItemId(fallbackPageId);
        } else {
          onPageSelect('');
          setCurrentPageId(null);
        }
      }
    }

    // Delete via store (handles API call and state updates)
    const result = await deletePage(id, currentPageId);

    if (!result.success) {
      console.error('Failed to delete page:', result.error);
      // Revert selection on error
      if (wasSelected) {
        setSelectedItemId(id);
      }
      return;
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
              <DropdownMenuItem onClick={() => handleAddPage()}>
                Regular
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>CMS</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {collections.length > 0 ? (
                    collections.map(collection => (
                      <DropdownMenuItem key={collection.id} onClick={() => handleAddPage(collection.id)}>
                        {collection.name}
                      </DropdownMenuItem>
                    ))
                  ) : (
                    <DropdownMenuItem key={null} onClick={() => navigateToCollections()}>
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

      {/* Page settings panel (lazy loaded) */}
      <Suspense fallback={null}>
        <PageSettingsPanel
          ref={pageSettingsPanelRef}
          isOpen={showPageSettings}
          onClose={() => {
            setShowPageSettings(false);
            setEditingPage(null);

            // Navigate back to pages view if we're in edit mode
            if (urlState.isEditing && currentPageId) {
              // Since edit param preserves other params, we can just remove the edit param
              // The URL already has view, tab, layer params preserved
              const view = urlState.view || undefined;
              const rightTab = urlState.rightTab || undefined;
              const layerId = urlState.layerId || undefined;

              navigateToPage(currentPageId, view, rightTab, layerId);
            }
          }}
          page={editingPage}
          onSave={handleSavePage}
        />
      </Suspense>

      {/* Folder settings panel (lazy loaded) */}
      <Suspense fallback={null}>
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
      </Suspense>
    </>
  );
}
