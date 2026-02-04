'use client';

import { useState, useEffect } from 'react';

interface UpdateInfo {
  available: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseUrl: string;
  updateInstructions: {
    method: 'github-sync' | 'git-pull' | 'manual';
    steps: string[];
    autoSyncUrl?: string;
  };
}

export default function UpdateNotification() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    checkForUpdates();
    
    // Check again every hour
    const interval = setInterval(checkForUpdates, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const checkForUpdates = async () => {
    try {
      const response = await fetch('/ycode/api/updates/check');
      if (response.ok) {
        const data = await response.json();
        setUpdateInfo(data);
      }
    } catch (error) {
      console.error('Failed to check for updates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    // Store dismissal in localStorage (will reappear after 7 days or page refresh)
    localStorage.setItem('ycode-update-dismissed', Date.now().toString());
  };

  // Don't show if loading, no update available, or dismissed
  if (loading || !updateInfo?.available || dismissed) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <svg
              className="w-6 h-6 animate-pulse" fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <p className="font-semibold">
                🎉 New YCode update available!
              </p>
              <p className="text-sm text-blue-100">
                Version {updateInfo.latestVersion} is now available (you have {updateInfo.currentVersion})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {updateInfo.updateInstructions.method === 'github-sync' ? (
              // Fork detected - Show "Sync Fork" button
              <a
                href={updateInfo.updateInstructions.autoSyncUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white text-blue-600 hover:bg-blue-50 font-semibold px-4 py-2 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                <svg
                  className="w-5 h-5" fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z"
                    clipRule="evenodd"
                  />
                </svg>
                Sync Fork (One Click!)
              </a>
            ) : updateInfo.updateInstructions.autoSyncUrl ? (
              // Not a fork - Show "View on GitHub" button
              <a
                href={updateInfo.updateInstructions.autoSyncUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white text-blue-600 hover:bg-blue-50 font-semibold px-4 py-2 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                <svg
                  className="w-5 h-5" fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                View on GitHub
              </a>
            ) : null}
            
            <button
              onClick={() => setShowInstructions(!showInstructions)}
              className="text-white hover:text-blue-100 font-medium px-4 py-2 transition-colors whitespace-nowrap"
            >
              {showInstructions ? 'Hide' : 'How to Update'}
            </button>

            <button
              onClick={handleDismiss}
              className="text-white hover:text-blue-100 p-2 transition-colors"
              aria-label="Dismiss"
            >
              <svg
                className="w-5 h-5" fill="none"
                stroke="currentColor" viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round" strokeLinejoin="round"
                  strokeWidth={2} d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Instructions Panel */}
        {showInstructions && (
          <div className="mt-4 pt-4 border-t border-blue-400">
            <h3 className="font-semibold mb-2">Update Instructions:</h3>
            <ol className="space-y-2 text-sm text-blue-50">
              {updateInfo.updateInstructions.steps.map((step, index) => (
                <li key={index} className="flex gap-2">
                  <span className="font-semibold">{index + 1}.</span>
                  <span dangerouslySetInnerHTML={{ __html: step }} />
                </li>
              ))}
            </ol>
            
            {updateInfo.releaseUrl && (
              <div className="mt-3">
                <a
                  href={updateInfo.releaseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-blue-100 hover:text-white underline"
                >
                  📝 View release notes
                  <svg
                    className="w-4 h-4" fill="none"
                    stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round" strokeLinejoin="round"
                      strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
