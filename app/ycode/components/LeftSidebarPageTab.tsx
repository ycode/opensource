'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import Icon from '@/components/ui/icon';
import PagesTree from './PagesTree';
import PageSettingsPanel, { type PageFormData } from './PageSettingsPanel';
import { usePagesStore } from '@/stores/usePagesStore';
import type { Page, PageFolder } from '@/types';

interface LeftSidebarPageTabProps {
  pages: Page[];
  folders: PageFolder[];
  currentPageId: string | null;
  onPageSelect: (pageId: string) => void;
  setCurrentPageId: (pageId: string | null) => void;
}

export default function LeftSidebarPageTab({
  pages,
  folders,
  currentPageId,
  onPageSelect,
  setCurrentPageId,
}: LeftSidebarPageTabProps) {
  const [showPageSettings, setShowPageSettings] = useState(false);
  const [editingPage, setEditingPage] = useState<Page | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(currentPageId);
  const selectedItemIdRef = React.useRef<string | null>(currentPageId);

  // Keep ref in sync with state
  useEffect(() => {
    selectedItemIdRef.current = selectedItemId;
  }, [selectedItemId]);

  // Get store actions
  const { createPage, updatePage, deletePage, createFolder, deleteFolder } = usePagesStore();

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
      is_locked: false,
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
    setEditingPage(page);
    setShowPageSettings(true);
  };

  const handleSavePage = async (data: PageFormData) => {
    if (!editingPage) return;

    const result = await updatePage(editingPage.id, {
      name: data.name,
      slug: data.slug,
    });

    if (result.success) {
      setShowPageSettings(false);
      setEditingPage(null);
    } else if (result.error) {
      console.error('Failed to save page:', result.error);
    }
  };

  // Handle page or folder deletion
  const deletePageOrFolderItem = async (id: string, type: 'folder' | 'page') => {
    if (type === 'folder') {
      // Delete folder via store (handles all logic including cascade deletion)
      const result = await deleteFolder(id, currentPageId);

      if (!result.success) {
        console.error('Failed to delete folder:', result.error);
        return;
      }

      // Handle UI updates based on what the store tells us
      if (result.currentPageAffected && result.nextPageId) {
        // Current page was deleted, switch to the suggested next page
        onPageSelect(result.nextPageId);
        setCurrentPageId(result.nextPageId);
        setSelectedItemId(result.nextPageId);
      } else if (result.currentPageAffected && !result.nextPageId) {
        // No pages left
        onPageSelect('');
        setCurrentPageId(null);
        setSelectedItemId(null);
      } else if (selectedItemId === id) {
        // Just deleted the selected folder, set selection to current page
        setSelectedItemId(currentPageId);
      }
      return;
    }

    // Handle page deletion
    if (type === 'page') {
      // Delete via store (handles all logic)
      const result = await deletePage(id, currentPageId);

      if (!result.success) {
        console.error('Failed to delete page:', result.error);
        return;
      }

      // Handle UI updates based on what the store tells us
      if (result.currentPageDeleted && result.nextPageId) {
        // Current page was deleted, switch to the suggested next page
        onPageSelect(result.nextPageId);
        setCurrentPageId(result.nextPageId);
        setSelectedItemId(result.nextPageId);
      } else if (result.currentPageDeleted && !result.nextPageId) {
        // No pages left
        onPageSelect('');
        setCurrentPageId(null);
        setSelectedItemId(null);
      } else if (selectedItemId === id) {
        // Just deleted the selected item, set selection to current page
        setSelectedItemId(currentPageId);
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
                <Icon name="page" className="size-3" />
                Add Page
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleAddFolder}>
                <Icon name="folder" className="size-3" />
                Add Folder
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
          onPageSettings={handleEditPage}
          onDelete={deletePageOrFolderItem}
        />
      </div>

      {/* Page Settings Panel */}
      <PageSettingsPanel
        isOpen={showPageSettings}
        onClose={() => {
          setShowPageSettings(false);
          setEditingPage(null);
        }}
        page={editingPage}
        onSave={handleSavePage}
      />
    </>
  );
}

