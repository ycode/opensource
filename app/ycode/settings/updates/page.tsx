'use client';

import { useState, useEffect } from 'react';
import { marked } from 'marked';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  FieldDescription,
  FieldLegend,
  FieldSeparator
} from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import Icon from '@/components/ui/icon';

interface UpdateInfo {
  available: boolean;
  currentVersion: string;
  latestVersion?: string;
  releaseUrl?: string;
  releaseNotes?: string;
  publishedAt?: string;
  message?: string;
  error?: string;
  updateInstructions?: {
    method: 'github-sync' | 'git-pull' | 'manual';
    steps: string[];
    autoSyncUrl?: string;
  };
}

interface Release {
  version: string;
  name: string;
  body: string;
  publishedAt: string;
  url: string;
  isCurrent: boolean;
  isPrerelease: boolean;
}

interface ReleasesResponse {
  releases: Release[];
  currentVersion: string;
  error?: string;
}

// Configure marked for safe rendering
marked.setOptions({
  gfm: true,
  breaks: true,
});

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function UpdatesSettingsPage() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [releasesLoading, setReleasesLoading] = useState(true);

  useEffect(() => {
    checkForUpdates();
    fetchReleases();
  }, []);

  const checkForUpdates = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/updates/check');
      if (response.ok) {
        const data = await response.json();
        setUpdateInfo(data);
      } else {
        setUpdateInfo({
          available: false,
          currentVersion: 'Unknown',
          error: 'Failed to check for updates',
        });
      }
    } catch (error) {
      console.error('Failed to check for updates:', error);
      setUpdateInfo({
        available: false,
        currentVersion: 'Unknown',
        error: 'Failed to check for updates',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchReleases = async () => {
    setReleasesLoading(true);
    try {
      const response = await fetch('/api/updates/releases');
      if (response.ok) {
        const data: ReleasesResponse = await response.json();
        setReleases(data.releases || []);
      }
    } catch (error) {
      console.error('Failed to fetch releases:', error);
    } finally {
      setReleasesLoading(false);
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto">

        <header className="pt-8 pb-3">
          <span className="text-base font-medium">Updates</span>
        </header>

        {/* Version Status Block */}
        <div className="grid grid-cols-3 gap-10 bg-secondary/20 p-8 rounded-lg">

          <div>
            <FieldLegend>Version status</FieldLegend>
            <FieldDescription>
              Check if your YCode installation is up to date with the latest release.
            </FieldDescription>
          </div>

          <div className="col-span-2">
            {loading ? (
              <div className="flex items-center gap-3 py-4">
                <Spinner />
                <span className="text-sm text-muted-foreground">Checking for updates...</span>
              </div>
            ) : updateInfo?.error ? (
              <div className="py-4">
                <div className="flex items-center gap-2 text-destructive">
                  <Icon name="info" className="size-5" />
                  <span className="text-sm">{updateInfo.error}</span>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-4"
                  onClick={checkForUpdates}
                >
                  Try again
                </Button>
              </div>
            ) : updateInfo?.available ? (
              // Update available state
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">Current version:</span>
                      <Badge variant="secondary">{updateInfo.currentVersion}</Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">Latest version:</span>
                      <Badge variant="default" className="bg-green-600 hover:bg-green-600">
                        {updateInfo.latestVersion}
                      </Badge>
                      <span className="text-xs text-green-600 font-medium">New update available</span>
                    </div>
                  </div>
                </div>

                <FieldSeparator />

                {updateInfo.updateInstructions && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Icon name="info" className="size-4 text-muted-foreground" />
                      <span className="text-sm font-medium">How to update</span>
                    </div>
                    
                    <ol className="space-y-2 text-sm text-muted-foreground ml-6">
                      {updateInfo.updateInstructions.steps
                        .filter(step => step.trim() !== '')
                        .map((step, index) => (
                          <li key={index} className="flex gap-2">
                            <span className="font-medium text-foreground">{index + 1}.</span>
                            <span dangerouslySetInnerHTML={{ __html: step }} />
                          </li>
                        ))}
                    </ol>

                    <div className="flex gap-3 pt-2">
                      {updateInfo.updateInstructions.autoSyncUrl && (
                        <Button size="sm" asChild>
                          <a
                            href={updateInfo.updateInstructions.autoSyncUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <svg
                              className="size-4" fill="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                            </svg>
                            {updateInfo.updateInstructions.method === 'github-sync' 
                              ? 'Sync Fork on GitHub' 
                              : 'View on GitHub'}
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // Up to date state
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="size-12 rounded-full bg-green-600/10 flex items-center justify-center">
                    <Icon name="check" className="size-6 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium">You&apos;re up to date</p>
                    <p className="text-sm text-muted-foreground">
                      Version {updateInfo?.currentVersion}
                    </p>
                  </div>
                </div>

                <FieldSeparator />

                <div className="flex gap-3">
                  <Button
                    size="sm" variant="secondary"
                    asChild
                  >
                    <a
                      href={updateInfo?.updateInstructions?.autoSyncUrl || 'https://github.com/ycode/opensource'}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <svg
                        className="size-4" fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                      </svg>
                      View on GitHub
                    </a>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={checkForUpdates}
                  >
                    Check again
                  </Button>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Release History Block */}
        <div className="grid grid-cols-3 gap-10 bg-secondary/20 p-8 rounded-lg mt-6">

          <div>
            <FieldLegend>Release history</FieldLegend>
            <FieldDescription>
              View all releases and their changelogs.
            </FieldDescription>
          </div>

          <div className="col-span-2">
            {releasesLoading ? (
              <div className="flex items-center gap-3 py-4">
                <Spinner />
                <span className="text-sm text-muted-foreground">Loading releases...</span>
              </div>
            ) : releases.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No releases found.</p>
            ) : (
              <div className="space-y-6">
                {releases.map((release, index) => (
                  <div key={release.version}>
                    {index > 0 && <FieldSeparator className="mb-6" />}
                    
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Badge 
                          variant={release.isCurrent ? 'default' : 'secondary'}
                          className={release.isCurrent ? 'bg-green-600 hover:bg-green-600' : ''}
                        >
                          v{release.version}
                        </Badge>
                        {release.isCurrent && (
                          <span className="text-xs text-green-600 font-medium">Current</span>
                        )}
                        {release.isPrerelease && (
                          <Badge variant="outline" className="text-xs">Pre-release</Badge>
                        )}
                        <span className="text-xs text-muted-foreground ml-auto">
                          {formatDate(release.publishedAt)}
                        </span>
                      </div>

                      {release.body && (
                        <div 
                          className="prose prose-sm dark:prose-invert max-w-none text-sm text-muted-foreground [&>ul]:list-disc [&>ul]:ml-4 [&>ol]:list-decimal [&>ol]:ml-4 [&>p]:mb-2 [&>h1]:text-base [&>h1]:font-semibold [&>h1]:mb-2 [&>h2]:text-sm [&>h2]:font-semibold [&>h2]:mb-2 [&>h3]:text-sm [&>h3]:font-medium [&>h3]:mb-1"
                          dangerouslySetInnerHTML={{ __html: marked(release.body) as string }}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
