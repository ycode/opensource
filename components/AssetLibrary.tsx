'use client';

import React, { useEffect, useState } from 'react';
import { assetsApi } from '../lib/api';
import type { Asset } from '../types';
import AssetUpload from './AssetUpload';

interface AssetLibraryProps {
  onAssetSelect?: (asset: Asset) => void;
  className?: string;
}

export default function AssetLibrary({
  onAssetSelect,
  className = '',
}: AssetLibraryProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAssets();
  }, []);

  const loadAssets = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await assetsApi.getAll();

      if (response.error) {
        throw new Error(response.error);
      }

      setAssets(response.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assets');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadSuccess = (asset: Asset) => {
    setAssets((prev) => [asset, ...prev]);
  };

  const handleUploadError = (error: string) => {
    setError(error);
  };

  const handleDelete = async (asset: Asset) => {
    if (!confirm('Are you sure you want to delete this asset?')) {
      return;
    }

    try {
      const response = await assetsApi.delete(asset.id);

      if (response.error) {
        throw new Error(response.error);
      }

      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete asset');
    }
  };

  if (loading) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-4 ${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Asset Library</h3>
        <AssetUpload
          onUploadSuccess={handleUploadSuccess}
          onUploadError={handleUploadError}
          accept="image/*"
          maxSize={10}
        />
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {assets.map((asset) => (
          <div
            key={asset.id}
            className="group relative bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
          >
            <div className="aspect-square bg-gray-100 flex items-center justify-center">
              {asset.mime_type?.startsWith('image/') ? (
                <img
                  src={asset.public_url}
                  alt={asset.filename}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-gray-400">
                  <svg
                    className="w-8 h-8" fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}
            </div>

            <div className="p-2">
              <p className="text-xs text-gray-600 truncate" title={asset.filename}>
                {asset.filename}
              </p>
              <p className="text-xs text-gray-500">
                {asset.width && asset.height ? `${asset.width}×${asset.height}` : ''}
                {asset.file_size && (
                  <span className="ml-1">
                    ({Math.round(asset.file_size / 1024)}KB)
                  </span>
                )}
              </p>
            </div>

            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
              <div className="flex gap-2">
                {onAssetSelect && (
                  <button
                    onClick={() => onAssetSelect(asset)}
                    className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                  >
                    Use
                  </button>
                )}
                <button
                  onClick={() => handleDelete(asset)}
                  className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {assets.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>No assets uploaded yet.</p>
          <p className="text-sm">Upload your first asset above.</p>
        </div>
      )}
    </div>
  );
}
