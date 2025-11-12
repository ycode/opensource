/**
 * API Client for YCode Builder
 *
 * Handles communication with Next.js API routes
 */

import type { Page, PageLayers, Layer, Asset, PageFolder, ApiResponse, Collection, CollectionField, CollectionItem, CollectionItemWithValues, Component, LayerStyle } from '../types';

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
    return {
      error: `HTTP ${response.status}: ${response.statusText}`,
    };
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
  async create(page: Omit<Page, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'publish_key'>): Promise<ApiResponse<Page>> {
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

  // Publish pages
  async publishPages(pageIds: string[]): Promise<ApiResponse<{ count: number }>> {
    return apiRequest<{ count: number }>('/api/pages/publish', {
      method: 'POST',
      body: JSON.stringify({ page_ids: pageIds }),
    });
  },
};

// Folders API
export const foldersApi = {
  // Get all folders
  async getAll(): Promise<ApiResponse<PageFolder[]>> {
    return apiRequest<PageFolder[]>('/api/folders');
  },

  // Create new folder
  async create(folder: Omit<PageFolder, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'publish_key'>): Promise<ApiResponse<PageFolder>> {
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

// Page Layers API
export const pageLayersApi = {
  // Get draft layers for page
  async getDraft(pageId: string): Promise<ApiResponse<PageLayers>> {
    return apiRequest<PageLayers>(`/api/pages/${pageId}/draft`);
  },

  // Update draft layers
  async updateDraft(pageId: string, layers: Layer[], generatedCSS?: string | null): Promise<ApiResponse<PageLayers>> {
    return apiRequest<PageLayers>(`/api/pages/${pageId}/draft`, {
      method: 'PUT',
      body: JSON.stringify({ layers, generated_css: generatedCSS }),
    });
  },

  // Get published layers
  async getPublished(pageId: string): Promise<ApiResponse<PageLayers>> {
    return apiRequest<PageLayers>(`/api/pages/${pageId}/published`);
  },
};

// Publish API
export const publishApi = {
  // Publish all draft records (pages, layers, etc.)
  async publishAll(): Promise<ApiResponse<{
    published: Array<{ page: Page; layers: PageLayers }>;
    created: number;
    updated: number;
    unchanged: number;
  }>> {
    return apiRequest(`/api/publish`, {
      method: 'POST',
    });
  },
};

// Assets API
export const assetsApi = {
  // Upload asset
  async upload(file: File): Promise<ApiResponse<Asset>> {
    const formData = new FormData();
    formData.append('file', file);

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

  // Get all assets
  async getAll(): Promise<ApiResponse<Asset[]>> {
    return apiRequest<Asset[]>('/api/assets');
  },

  // Delete asset
  async delete(id: string): Promise<ApiResponse<void>> {
    return apiRequest<void>(`/api/assets/${id}`, {
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

  async getById(id: number): Promise<ApiResponse<Collection>> {
    return apiRequest<Collection>(`/api/collections/${id}`);
  },

  async create(data: {
    name: string;
    collection_name: string;
    sorting?: Record<string, any> | null;
    order?: number | null;
    status?: 'draft' | 'published';
  }): Promise<ApiResponse<Collection>> {
    return apiRequest<Collection>('/api/collections', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: number, data: Partial<Collection>): Promise<ApiResponse<Collection>> {
    return apiRequest<Collection>(`/api/collections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async delete(id: number): Promise<ApiResponse<void>> {
    return apiRequest<void>(`/api/collections/${id}`, {
      method: 'DELETE',
    });
  },

  // Fields
  async getFields(collectionId: number): Promise<ApiResponse<CollectionField[]>> {
    return apiRequest<CollectionField[]>(`/api/collections/${collectionId}/fields`);
  },

  async createField(collectionId: number, data: {
    name: string;
    field_name: string;
    type: 'text' | 'number' | 'boolean' | 'date' | 'reference';
    default?: string | null;
    fillable?: boolean;
    built_in?: boolean;
    order?: number;
    reference_collection_id?: number | null;
    hidden?: boolean;
    data?: Record<string, any>;
    status?: 'draft' | 'published';
  }): Promise<ApiResponse<CollectionField>> {
    return apiRequest<CollectionField>(`/api/collections/${collectionId}/fields`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateField(collectionId: number, fieldId: number, data: Partial<CollectionField>): Promise<ApiResponse<CollectionField>> {
    return apiRequest<CollectionField>(`/api/collections/${collectionId}/fields/${fieldId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteField(collectionId: number, fieldId: number): Promise<ApiResponse<void>> {
    return apiRequest<void>(`/api/collections/${collectionId}/fields/${fieldId}`, {
      method: 'DELETE',
    });
  },

  async reorderFields(collectionId: number, fieldIds: number[]): Promise<ApiResponse<{ success: boolean }>> {
    return apiRequest<{ success: boolean }>(`/api/collections/${collectionId}/fields/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ field_ids: fieldIds }),
    });
  },

  async getPublishableCounts(): Promise<ApiResponse<Record<number, number>>> {
    return apiRequest<Record<number, number>>('/api/collections/publishable-counts');
  },

  async publishCollections(collectionIds: number[]): Promise<ApiResponse<{ published: Record<number, number> }>> {
    return apiRequest<{ published: Record<number, number> }>('/api/collections/publish', {
      method: 'POST',
      body: JSON.stringify({ collection_ids: collectionIds }),
    });
  },

  // Items (with values)
  async getItems(collectionId: number): Promise<ApiResponse<CollectionItemWithValues[]>> {
    return apiRequest<CollectionItemWithValues[]>(`/api/collections/${collectionId}/items`);
  },

  async getItemById(collectionId: number, itemId: number): Promise<ApiResponse<CollectionItemWithValues>> {
    return apiRequest<CollectionItemWithValues>(`/api/collections/${collectionId}/items/${itemId}`);
  },

  async createItem(collectionId: number, values: Record<string, any>): Promise<ApiResponse<CollectionItemWithValues>> {
    return apiRequest<CollectionItemWithValues>(`/api/collections/${collectionId}/items`, {
      method: 'POST',
      body: JSON.stringify({ values }),
    });
  },

  async updateItem(collectionId: number, itemId: number, values: Record<string, any>): Promise<ApiResponse<CollectionItemWithValues>> {
    return apiRequest<CollectionItemWithValues>(`/api/collections/${collectionId}/items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify({ values }),
    });
  },

  async deleteItem(collectionId: number, itemId: number): Promise<ApiResponse<void>> {
    return apiRequest<void>(`/api/collections/${collectionId}/items/${itemId}`, {
      method: 'DELETE',
    });
  },

  // Search
  async searchItems(collectionId: number, query: string): Promise<ApiResponse<CollectionItemWithValues[]>> {
    return apiRequest<CollectionItemWithValues[]>(`/api/collections/${collectionId}/items?search=${encodeURIComponent(query)}`);
  },

  // Published items
  async getPublishedItems(collectionId: number): Promise<ApiResponse<CollectionItemWithValues[]>> {
    return apiRequest<CollectionItemWithValues[]>(`/api/collections/${collectionId}/items/published`);
  },

  // Unpublished items for a collection
  async getUnpublishedItems(collectionId: number): Promise<ApiResponse<CollectionItemWithValues[]>> {
    return apiRequest<CollectionItemWithValues[]>(`/api/collections/${collectionId}/items/unpublished`);
  },

  // Publish individual items
  async publishItems(itemIds: number[]): Promise<ApiResponse<{ count: number }>> {
    return apiRequest<{ count: number }>('/api/collections/items/publish', {
      method: 'POST',
      body: JSON.stringify({ item_ids: itemIds }),
    });
  },
};

// Components API
export const componentsApi = {
  // Get unpublished components
  async getUnpublished(): Promise<ApiResponse<Component[]>> {
    return apiRequest<Component[]>('/api/components/unpublished');
  },

  // Publish components
  async publishComponents(componentIds: string[]): Promise<ApiResponse<{ count: number }>> {
    return apiRequest<{ count: number }>('/api/components/publish', {
      method: 'POST',
      body: JSON.stringify({ component_ids: componentIds }),
    });
  },
};

// Layer Styles API
export const layerStylesApi = {
  // Get unpublished layer styles
  async getUnpublished(): Promise<ApiResponse<LayerStyle[]>> {
    return apiRequest<LayerStyle[]>('/api/layer-styles/unpublished');
  },

  // Publish layer styles
  async publishLayerStyles(styleIds: string[]): Promise<ApiResponse<{ count: number }>> {
    return apiRequest<{ count: number }>('/api/layer-styles/publish', {
      method: 'POST',
      body: JSON.stringify({ style_ids: styleIds }),
    });
  },
};
