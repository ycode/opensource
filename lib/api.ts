/**
 * API Client for YCode Builder
 *
 * Handles communication with Next.js API routes
 */

import type { Page, PageLayers, Layer, Asset, AssetCategory, PageFolder, ApiResponse, Collection, CollectionField, CollectionItemWithValues, Component, LayerStyle, Setting, UpdateCollectionData, CreateCollectionFieldData, UpdateCollectionFieldData, Locale, Translation, CreateLocaleData, UpdateLocaleData, CreateTranslationData, UpdateTranslationData, AssetFolder } from '../types';

// All API routes are now relative (Next.js API routes)
const API_BASE = '';

// Get Supabase auth token
async function getAuthToken(): Promise<string | null> {
  // TODO: Get from Supabase client when implemented
  return null;
}

// Generic API request helper
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = await getAuthToken();

  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    // Try to parse error message from response body
    try {
      const json = await response.json();
      if (json.error) {
        return { error: json.error };
      }
    } catch {
      // If parsing fails, fall back to status text
    }
    return {
      error: `HTTP ${response.status}: ${response.statusText}`,
    };
  }

  // Handle 204 No Content responses (no body to parse)
  if (response.status === 204) {
    return { data: null as T };
  }

  try {
    const json = await response.json();
    // API responses are already wrapped in { data: ... }
    // So we unwrap them here
    if (json.data !== undefined) {
      return { data: json.data };
    }
    // Fallback for responses that aren't wrapped
    return { data: json };
  } catch (error) {
    return {
      error: 'Failed to parse response',
    };
  }
}

// Pages API
export const pagesApi = {
  // Get all pages
  async getAll(): Promise<ApiResponse<Page[]>> {
    return apiRequest<Page[]>('/api/pages');
  },

  // Get page by ID
  async getById(id: string): Promise<ApiResponse<Page>> {
    return apiRequest<Page>(`/api/pages/${id}`);
  },

  // Get page by slug
  async getBySlug(slug: string): Promise<ApiResponse<Page>> {
    return apiRequest<Page>(`/api/pages/slug/${slug}`);
  },

  // Get all published pages (for public website)
  async getAllPublished(): Promise<ApiResponse<Page[]>> {
    return apiRequest<Page[]>('/api/pages?is_published=true');
  },

  // Create new page
  async create(page: Omit<Page, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>): Promise<ApiResponse<Page>> {
    return apiRequest<Page>('/api/pages', {
      method: 'POST',
      body: JSON.stringify(page),
    });
  },

  // Update page
  async update(id: string, page: Partial<Page>): Promise<ApiResponse<Page>> {
    return apiRequest<Page>(`/api/pages/${id}`, {
      method: 'PUT',
      body: JSON.stringify(page),
    });
  },

  // Delete page
  async delete(id: string): Promise<ApiResponse<void>> {
    return apiRequest<void>(`/api/pages/${id}`, {
      method: 'DELETE',
    });
  },

  // Get unpublished pages
  async getUnpublished(): Promise<ApiResponse<Page[]>> {
    return apiRequest<Page[]>('/api/pages/unpublished');
  },
};

// Folders API
export const foldersApi = {
  // Get all folders
  async getAll(): Promise<ApiResponse<PageFolder[]>> {
    return apiRequest<PageFolder[]>('/api/folders');
  },

  // Create new folder
  async create(folder: Omit<PageFolder, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>): Promise<ApiResponse<PageFolder>> {
    return apiRequest<PageFolder>('/api/folders', {
      method: 'POST',
      body: JSON.stringify(folder),
    });
  },

  // Update folder
  async update(id: string, folder: Partial<PageFolder>): Promise<ApiResponse<PageFolder>> {
    return apiRequest<PageFolder>(`/api/folders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(folder),
    });
  },

  // Delete folder
  async delete(id: string): Promise<ApiResponse<void>> {
    return apiRequest<void>(`/api/folders/${id}`, {
      method: 'DELETE',
    });
  },
};

// Layers API
export const layersApi = {
  // Get layers for a page (with optional is_published filter)
  async getByPageId(pageId: string, isPublished?: boolean): Promise<ApiResponse<PageLayers>> {
    const params = new URLSearchParams({ page_id: pageId });
    if (isPublished !== undefined) {
      params.append('is_published', String(isPublished));
    }
    return apiRequest<PageLayers>(`/api/layers?${params.toString()}`);
  },

  // Update layers for a page
  async update(pageId: string, layers: Layer[]): Promise<ApiResponse<PageLayers>> {
    return apiRequest<PageLayers>(`/api/layers?page_id=${pageId}`, {
      method: 'PUT',
      body: JSON.stringify({ layers }),
    });
  },
};

// Page Layers API (legacy - keeping for backwards compatibility)
export const pageLayersApi = {
  // Get draft layers for page
  async getDraft(pageId: string): Promise<ApiResponse<PageLayers>> {
    return layersApi.getByPageId(pageId, false);
  },

  // Update draft layers
  async updateDraft(pageId: string, layers: Layer[]): Promise<ApiResponse<PageLayers>> {
    return layersApi.update(pageId, layers);
  },

  // Get all draft (non-published) page layers in one query
  async getAllDrafts(): Promise<ApiResponse<PageLayers[]>> {
    return apiRequest<PageLayers[]>('/api/pages/drafts');
  },
};

// Publish API - Global publishing endpoint
export const publishApi = {
  /**
   * Publish all unpublished items or specific selected items
   * @param options - Publishing options
   */
  async publish(options: {
    folderIds?: string[];
    pageIds?: string[];
    collectionIds?: string[];
    collectionItemIds?: string[];
    componentIds?: string[];
    layerStyleIds?: string[];
    publishLocales?: boolean;
    publishAll?: boolean;
  } = {}): Promise<ApiResponse<{
    changes: {
      folders: number;
      pages: number;
      collectionItems: number;
      components: number;
      layerStyles: number;
      locales: number;
      translations: number;
      css: boolean;
    };
    published_at_setting: Setting;
  }>> {
    return apiRequest('/api/publish', {
      method: 'POST',
      body: JSON.stringify(options),
    });
  },
};

// Assets API
export const assetsApi = {
  // Upload asset
  async upload(file: File, source: string = 'library'): Promise<ApiResponse<Asset>> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('source', source);

    const token = await getAuthToken();

    const response = await fetch(`${API_BASE}/api/assets/upload`, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    });

    if (!response.ok) {
      return {
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    try {
      const json = await response.json();
      // Unwrap the { data: ... } response
      if (json.data !== undefined) {
        return { data: json.data };
      }
      return { data: json };
    } catch (error) {
      return {
        error: 'Failed to parse response',
      };
    }
  },

  // Get all assets (optionally filtered by folder)
  async getAll(folderId?: string | null): Promise<ApiResponse<Asset[]>> {
    const params = new URLSearchParams();
    if (folderId !== undefined) {
      params.set('folderId', folderId === null ? 'null' : folderId);
    }
    const url = params.toString() ? `/api/assets?${params}` : '/api/assets';
    return apiRequest<Asset[]>(url);
  },

  // Create SVG asset from code
  async create(data: { filename: string; content: string; asset_folder_id?: string | null; source?: string }): Promise<ApiResponse<Asset>> {
    return apiRequest<Asset>('/api/assets', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  },

  // Update asset
  async update(id: string, data: { filename?: string; asset_folder_id?: string | null; content?: string | null }): Promise<ApiResponse<Asset>> {
    return apiRequest<Asset>(`/api/assets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Delete asset
  async delete(id: string): Promise<ApiResponse<void>> {
    return apiRequest<void>(`/api/assets/${id}`, {
      method: 'DELETE',
    });
  },

  // Bulk delete assets
  async bulkDelete(ids: string[]): Promise<ApiResponse<{ success: string[]; failed: string[] }>> {
    return apiRequest<{ success: string[]; failed: string[] }>('/api/assets/bulk', {
      method: 'POST',
      body: JSON.stringify({ action: 'delete', ids }),
    });
  },

  // Bulk move assets to folder
  async bulkMove(ids: string[], asset_folder_id: string | null): Promise<ApiResponse<{ success: string[]; failed: string[] }>> {
    return apiRequest<{ success: string[]; failed: string[] }>('/api/assets/bulk', {
      method: 'POST',
      body: JSON.stringify({ action: 'move', ids, asset_folder_id }),
    });
  },
};

// Asset Folders API
export const assetFoldersApi = {
  // Get all asset folders
  async getAll(): Promise<ApiResponse<AssetFolder[]>> {
    return apiRequest<AssetFolder[]>('/api/asset-folders');
  },

  // Create new asset folder
  async create(folder: { name: string; asset_folder_id?: string | null; depth?: number; order?: number; is_published?: boolean }): Promise<ApiResponse<AssetFolder>> {
    return apiRequest<AssetFolder>('/api/asset-folders', {
      method: 'POST',
      body: JSON.stringify(folder),
    });
  },

  // Update asset folder
  async update(id: string, folder: Partial<AssetFolder>): Promise<ApiResponse<AssetFolder>> {
    return apiRequest<AssetFolder>(`/api/asset-folders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(folder),
    });
  },

  // Delete asset folder
  async delete(id: string): Promise<ApiResponse<void>> {
    return apiRequest<void>(`/api/asset-folders/${id}`, {
      method: 'DELETE',
    });
  },
};

// Setup API
export const setupApi = {
  // Get setup status
  async getStatus(): Promise<ApiResponse<{ isComplete: boolean; currentStep: string }>> {
    return apiRequest<{ isComplete: boolean; currentStep: string }>('/api/setup/status');
  },

  // Connect Supabase
  async connectSupabase(config: {
    url: string;
    anon_key: string;
    service_role_key: string;
  }): Promise<ApiResponse<{ success: boolean }>> {
    return apiRequest<{ success: boolean }>('/api/setup/connect-supabase', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  },

  // Update Vercel env vars
  async updateVercelEnv(vars: Record<string, string>): Promise<ApiResponse<{ success: boolean }>> {
    return apiRequest<{ success: boolean }>('/api/setup/update-vercel-env', {
      method: 'POST',
      body: JSON.stringify(vars),
    });
  },

  // Run migrations
  async runMigrations(): Promise<ApiResponse<{ success: boolean }>> {
    return apiRequest<{ success: boolean }>('/api/setup/run-migrations', {
      method: 'POST',
    });
  },

  // Complete setup
  async completeSetup(): Promise<ApiResponse<{ success: boolean }>> {
    return apiRequest<{ success: boolean }>('/api/setup/complete', {
      method: 'POST',
    });
  },
};

// Collections API (EAV Architecture)
export const collectionsApi = {
  // Collections
  async getAll(): Promise<ApiResponse<Collection[]>> {
    return apiRequest<Collection[]>('/api/collections');
  },

  async getById(id: string): Promise<ApiResponse<Collection>> {
    return apiRequest<Collection>(`/api/collections/${id}`);
  },

  async create(data: {
    name: string;
    sorting?: Record<string, any> | null;
    order?: number;
  }): Promise<ApiResponse<Collection>> {
    return apiRequest<Collection>('/api/collections', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: UpdateCollectionData): Promise<ApiResponse<Collection>> {
    return apiRequest<Collection>(`/api/collections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string): Promise<ApiResponse<void>> {
    return apiRequest<void>(`/api/collections/${id}`, {
      method: 'DELETE',
    });
  },

  async reorder(collectionIds: string[]): Promise<ApiResponse<{ success: boolean }>> {
    return apiRequest<{ success: boolean }>('/api/collections/reorder', {
      method: 'PUT',
      body: JSON.stringify({ collection_ids: collectionIds }),
    });
  },

  // Fields
  async getAllFields(): Promise<ApiResponse<CollectionField[]>> {
    return apiRequest<CollectionField[]>('/api/collections/fields');
  },

  async getFields(collectionId: string, search?: string): Promise<ApiResponse<CollectionField[]>> {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    const queryString = params.toString();
    const url = `/api/collections/${collectionId}/fields${queryString ? `?${queryString}` : ''}`;
    return apiRequest<CollectionField[]>(url);
  },

  async createField(collectionId: string, data: Omit<CreateCollectionFieldData, 'collection_id' | 'is_published'>): Promise<ApiResponse<CollectionField>> {
    return apiRequest<CollectionField>(`/api/collections/${collectionId}/fields`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateField(collectionId: string, fieldId: string, data: UpdateCollectionFieldData): Promise<ApiResponse<CollectionField>> {
    return apiRequest<CollectionField>(`/api/collections/${collectionId}/fields/${fieldId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteField(collectionId: string, fieldId: string): Promise<ApiResponse<void>> {
    return apiRequest<void>(`/api/collections/${collectionId}/fields/${fieldId}`, {
      method: 'DELETE',
    });
  },

  async reorderFields(collectionId: string, fieldIds: string[]): Promise<ApiResponse<{ success: boolean }>> {
    return apiRequest<{ success: boolean }>(`/api/collections/${collectionId}/fields/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ field_ids: fieldIds }),
    });
  },

  async getPublishableCounts(): Promise<ApiResponse<Record<string, number>>> {
    return apiRequest<Record<string, number>>('/api/collections/publishable-counts');
  },

  // Items (with values)
  async getTopItemsPerCollection(
    collectionIds: string[],
    limit: number = 10
  ): Promise<ApiResponse<Record<string, { items: CollectionItemWithValues[]; total: number }>>> {
    return apiRequest('/api/collections/items/batch', {
      method: 'POST',
      body: JSON.stringify({ collectionIds, limit }),
    });
  },

  async getItems(
    collectionId: string,
    options?: {
      page?: number;
      limit?: number;
      search?: string;
      sortBy?: string;
      sortOrder?: string;
      offset?: number;
    }
  ): Promise<ApiResponse<{ items: CollectionItemWithValues[]; total: number; page: number; limit: number }>> {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.search) params.append('search', options.search);
    if (options?.sortBy) params.append('sortBy', options.sortBy);
    if (options?.sortOrder) params.append('sortOrder', options.sortOrder);
    if (options?.offset !== undefined) params.append('offset', options.offset.toString());
    const queryString = params.toString();
    const url = `/api/collections/${collectionId}/items${queryString ? `?${queryString}` : ''}`;
    return apiRequest<{ items: CollectionItemWithValues[]; total: number; page: number; limit: number }>(url);
  },

  async getItemById(collectionId: string, itemId: string): Promise<ApiResponse<CollectionItemWithValues>> {
    return apiRequest<CollectionItemWithValues>(`/api/collections/${collectionId}/items/${itemId}`);
  },

  async createItem(collectionId: string, values: Record<string, any>): Promise<ApiResponse<CollectionItemWithValues>> {
    return apiRequest<CollectionItemWithValues>(`/api/collections/${collectionId}/items`, {
      method: 'POST',
      body: JSON.stringify({ values }),
    });
  },

  async updateItem(collectionId: string, itemId: string, values: Record<string, any>): Promise<ApiResponse<CollectionItemWithValues>> {
    return apiRequest<CollectionItemWithValues>(`/api/collections/${collectionId}/items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify({ values }),
    });
  },

  async deleteItem(collectionId: string, itemId: string): Promise<ApiResponse<void>> {
    return apiRequest<void>(`/api/collections/${collectionId}/items/${itemId}`, {
      method: 'DELETE',
    });
  },

  // Search
  async searchItems(
    collectionId: string,
    query: string,
    options?: { page?: number; limit?: number }
  ): Promise<ApiResponse<{ items: CollectionItemWithValues[]; total: number; page: number; limit: number }>> {
    const params = new URLSearchParams();
    params.append('search', query);
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    const url = `/api/collections/${collectionId}/items?${params.toString()}`;
    return apiRequest<{ items: CollectionItemWithValues[]; total: number; page: number; limit: number }>(url);
  },

  // Published items
  async getPublishedItems(collectionId: string): Promise<ApiResponse<CollectionItemWithValues[]>> {
    return apiRequest<CollectionItemWithValues[]>(`/api/collections/${collectionId}/items/published`);
  },

  // Unpublished items for a collection
  async getUnpublishedItems(collectionId: string): Promise<ApiResponse<CollectionItemWithValues[]>> {
    return apiRequest<CollectionItemWithValues[]>(`/api/collections/${collectionId}/items/unpublished`);
  },

  // Publish individual items
  async publishItems(itemIds: string[]): Promise<ApiResponse<{ count: number }>> {
    return apiRequest<{ count: number }>('/api/collections/items/publish', {
      method: 'POST',
      body: JSON.stringify({ item_ids: itemIds }),
    });
  },

  // Bulk delete items
  async bulkDeleteItems(itemIds: string[]): Promise<ApiResponse<{ deleted: number; errors?: string[] }>> {
    return apiRequest<{ deleted: number; errors?: string[] }>('/api/collections/items/delete', {
      method: 'POST',
      body: JSON.stringify({ item_ids: itemIds }),
    });
  },

  // Duplicate item
  async duplicateItem(collectionId: string, itemId: string): Promise<ApiResponse<CollectionItemWithValues>> {
    return apiRequest<CollectionItemWithValues>(`/api/collections/${collectionId}/items/${itemId}/duplicate`, {
      method: 'POST',
    });
  },

  // Reorder items (bulk update manual_order)
  async reorderItems(collectionId: string, updates: Array<{ id: string; manual_order: number }>): Promise<ApiResponse<{ updated: number }>> {
    return apiRequest<{ updated: number }>(`/api/collections/${collectionId}/items/reorder`, {
      method: 'POST',
      body: JSON.stringify({ updates }),
    });
  },
};

// Components API
export const componentsApi = {
  // Get unpublished components
  async getUnpublished(): Promise<ApiResponse<Component[]>> {
    return apiRequest<Component[]>('/api/components/unpublished');
  },
};

// Layer Styles API
export const layerStylesApi = {
  // Get unpublished layer styles
  async getUnpublished(): Promise<ApiResponse<LayerStyle[]>> {
    return apiRequest<LayerStyle[]>('/api/layer-styles/unpublished');
  },
};

// Editor API - Load all initial data at once
export const editorApi = {
  // Get all initial editor data in one request
  async init(): Promise<ApiResponse<{
    pages: Page[];
    drafts: PageLayers[];
    folders: PageFolder[];
    components: Component[];
    styles: LayerStyle[];
    settings: Setting[];
    collections: Collection[];
    locales: Locale[];
    assets: Asset[];
    assetFolders: AssetFolder[];
  }>> {
    return apiRequest('/api/editor/init');
  },
};

// Localisation API
export const localisationApi = {
  // Locales
  async getLocales(): Promise<ApiResponse<Locale[]>> {
    return apiRequest<Locale[]>('/api/locales');
  },

  async getLocaleById(id: string): Promise<ApiResponse<Locale>> {
    return apiRequest<Locale>(`/api/locales/${id}`);
  },

  async createLocale(data: CreateLocaleData): Promise<ApiResponse<{ locale: Locale; locales: Locale[] }>> {
    return apiRequest<{ locale: Locale; locales: Locale[] }>('/api/locales', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateLocale(id: string, data: UpdateLocaleData): Promise<ApiResponse<{ locale: Locale; locales: Locale[] }>> {
    return apiRequest<{ locale: Locale; locales: Locale[] }>(`/api/locales/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteLocale(id: string): Promise<ApiResponse<void>> {
    return apiRequest<void>(`/api/locales/${id}`, {
      method: 'DELETE',
    });
  },

  async setDefaultLocale(id: string): Promise<ApiResponse<Locale>> {
    return apiRequest<Locale>(`/api/locales/${id}/default`, {
      method: 'POST',
    });
  },

  // Translations
  async getTranslations(localeId: string): Promise<ApiResponse<Translation[]>> {
    return apiRequest<Translation[]>(`/api/translations?locale_id=${localeId}`);
  },

  async createTranslation(data: CreateTranslationData): Promise<ApiResponse<Translation>> {
    return apiRequest<Translation>('/api/translations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateTranslation(id: string, data: UpdateTranslationData): Promise<ApiResponse<Translation>> {
    return apiRequest<Translation>(`/api/translations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteTranslation(id: string): Promise<ApiResponse<void>> {
    return apiRequest<void>(`/api/translations/${id}`, {
      method: 'DELETE',
    });
  },
};

// Cache API - Manage Next.js cache
export const cacheApi = {
  /**
   * Invalidate all Next.js cache
   * Should be called after publishing content
   */
  async clearAll(): Promise<ApiResponse<{ success: boolean }>> {
    return apiRequest<{ success: boolean }>('/api/cache/clear-all', {
      method: 'POST',
    });
  },
};

// File Upload API

/**
 * Upload a file and create Asset record
 *
 * @param file - File to upload
 * @param source - Source identifier (e.g., 'page-settings', 'components', 'library')
 * @param category - Optional file category for validation ('images', 'videos', 'audio', 'documents', or null for any)
 * @param customName - Optional custom name for the file
 */
export async function uploadFileApi(
  file: File,
  source: string,
  category?: AssetCategory | null,
  customName?: string,
  assetFolderId?: string | null
): Promise<Asset | null> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('source', source);
    if (category) {
      formData.append('category', category);
    }
    if (customName) {
      formData.append('name', customName);
    }
    if (assetFolderId) {
      formData.append('asset_folder_id', assetFolderId);
    }

    const response = await fetch('/api/files/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to upload file');
    }

    const { data } = await response.json();
    return data;
  } catch (error) {
    console.error('Error uploading file:', error);
    return null;
  }
}

/**
 * Delete an asset (from both storage and database)
 *
 * @param assetId - Asset ID to delete
 * @returns True if successful, false otherwise
 */
export async function deleteAssetApi(assetId: string): Promise<boolean> {
  try {
    const response = await fetch(
      `/api/files/delete?assetId=${encodeURIComponent(assetId)}`,
      { method: 'DELETE' }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to delete asset');
    }

    return true;
  } catch (error) {
    console.error('Error deleting asset:', error);
    return false;
  }
}
