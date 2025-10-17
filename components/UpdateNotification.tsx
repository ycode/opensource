'use client';

import React, { useEffect, useState } from 'react';
import { useUpdateStore } from '../stores/useUpdateStore';

interface UpdateNotificationProps {
  className?: string;
}

export default function UpdateNotification({ className = '' }: UpdateNotificationProps) {
  const { status, details, checkForUpdates, getStatus, isLoading, error } = useUpdateStore();
  const [isVisible, setIsVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Check for updates on mount
    getStatus();
  }, [getStatus]);

  useEffect(() => {
    // Show notification if update is available
    if (status?.has_update) {
      setIsVisible(true);
    }
  }, [status]);

  const handleCheckForUpdates = async () => {
    await checkForUpdates();
    if (details?.has_update) {
      setShowDetails(true);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
  };

  const handleDownload = () => {
    if (details?.download_url) {
      window.open(details.download_url, '_blank');
    }
  };

  if (!isVisible || !status?.has_update) {
    return null;
  }

  return (
    <div className={`fixed top-4 right-4 z-50 max-w-sm ${className}`}>
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium text-gray-900">
              Update Available
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              YCode {status.latest_version} is now available. You're currently running {status.current_version}.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleCheckForUpdates}
                disabled={isLoading}
                className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? 'Checking...' : 'View Details'}
              </button>
              <button
                onClick={handleDismiss}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Update Details Modal */}
      {showDetails && details && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-96 overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Update to YCode {details.latest_version}
                </h2>
                <button
                  onClick={() => setShowDetails(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Current version:</strong> {details.current_version}
                </p>
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Latest version:</strong> {details.latest_version}
                </p>
                {details.published_at && (
                  <p className="text-sm text-gray-600 mb-4">
                    <strong>Released:</strong> {new Date(details.published_at).toLocaleDateString()}
                  </p>
                )}
              </div>

              {details.release_notes && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-2">Release Notes</h3>
                  <div className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 p-3 rounded">
                    {details.release_notes}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                {details.download_url && (
                  <button
                    onClick={handleDownload}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                  >
                    Download Update
                  </button>
                )}
                <button
                  onClick={() => setShowDetails(false)}
                  className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
          {error}
        </div>
      )}
    </div>
  );
}
