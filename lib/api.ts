/**
 * API Client for YCode Builder
 *
 * Handles communication with Next.js API routes
 */

import type { Page, PageLayers, Layer, Asset, PageFolder, ApiResponse, Component, LayerStyle, Setting } from '../types';

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

  // Get all draft (non-published) page layers in one query
  async getAllDrafts(): Promise<ApiResponse<PageLayers[]>> {
    return apiRequest<PageLayers[]>('/api/pages/drafts');
  },

  // Update draft layers
  async updateDraft(pageId: string, layers: Layer[]): Promise<ApiResponse<PageLayers>> {
    return apiRequest<PageLayers>(`/api/pages/${pageId}/draft`, {
      method: 'PUT',
      body: JSON.stringify({ layers }),
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

// Editor API - Load all initial data at once
export const editorApi = {
  // Get all initial editor data in one request
  async init(): Promise<ApiResponse<{
    pages: Page[];
    drafts: PageLayers[];
    components: Component[];
    styles: LayerStyle[];
    settings: Setting[];
  }>> {
    return apiRequest('/api/editor/init');
  },
};
