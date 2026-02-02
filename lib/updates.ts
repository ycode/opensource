/**
 * Update API Client
 * 
 * Handles checking for YCode updates
 */

import type { ApiResponse } from '../types';

export interface UpdateStatus {
  current_version: string;
  latest_version: string | null;
  has_update: boolean;
  update_available: boolean;
  is_prerelease: boolean;
  last_checked: string;
}

export interface UpdateDetails {
  current_version: string;
  latest_version: string;
  has_update: boolean;
  release_notes: string;
  download_url: string | null;
  published_at: string;
  prerelease: boolean;
  draft: boolean;
}

export interface VersionInfo {
  current_version: string;
  is_development: boolean;
  php_version: string;
  laravel_version: string;
  last_updated: string | null;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Generic API request helper
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      return {
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();
    return { data };
  } catch (error) {
    return {
      error: 'Failed to fetch update information',
    };
  }
}

// Update API
export const updatesApi = {
  // Get update status
  async getStatus(): Promise<ApiResponse<UpdateStatus>> {
    return apiRequest<UpdateStatus>('/ycode/api/updates/status');
  },

  // Get detailed update information
  async getDetails(): Promise<ApiResponse<UpdateDetails>> {
    return apiRequest<UpdateDetails>('/ycode/api/updates/details');
  },

  // Get version information
  async getVersion(): Promise<ApiResponse<VersionInfo>> {
    return apiRequest<VersionInfo>('/ycode/api/updates/version');
  },

  // Force check for updates
  async checkForUpdates(): Promise<ApiResponse<UpdateDetails>> {
    return apiRequest<UpdateDetails>('/ycode/api/updates/check', {
      method: 'POST',
    });
  },
};
