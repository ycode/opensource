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
import { Label } from '@/components/ui/label';
import { Empty, EmptyTitle } from '@/components/ui/empty';

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
    month: 'short',
    day: 'numeric',
  });
}

export default function UpdatesSettingsPage() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [releasesLoading, setReleasesLoading] = useState(true);
  const [releasesError, setReleasesError] = useState<string | null>(null);

  useEffect(() => {
    checkForUpdates();
    fetchReleases();
  }, []);

  const checkForUpdates = async () => {
    setLoading(true);
    try {
      const response = await fetch('/ycode/api/updates/check');
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
    setReleasesError(null);
    try {
      const response = await fetch('/ycode/api/updates/releases');
      if (response.ok) {
        const data: ReleasesResponse = await response.json();
        console.log('Releases API response:', data);
        setReleases(data.releases || []);
        if (data.error) {
          setReleasesError(data.error);
        }
      } else {
        setReleasesError(`Failed to fetch releases: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to fetch releases:', error);
      setReleasesError('Failed to fetch releases');
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
              <Empty className="bg-input">
                <Spinner />
              </Empty>
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
              <div className="flex flex-col gap-4">

                <div className="flex items-center gap-4">
                  <div className="size-12 rounded-full bg-secondary flex items-center justify-center font-medium text-[11px] text-current/60">
                    {updateInfo.latestVersion}
                  </div>
                  <div>
                    <Label>Update available</Label>
                    <Label variant="muted">Current version {updateInfo?.currentVersion}</Label>
                  </div>
                </div>

                <FieldSeparator />

                {updateInfo.updateInstructions && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">How to update</span>
                    </div>

                    <ol className="flex flex-col gap-3 text-sm text-muted-foreground">
                      {updateInfo.updateInstructions.steps
                        .filter(step => step.trim() !== '')
                        .map((step, index) => (
                          <li key={index} className="flex gap-2">
                            <span className="font-medium text-foreground/50 size-6 shrink-0 bg-input rounded-md flex items-center justify-center">{index + 1}</span>
                            <span className="mt-0.5" dangerouslySetInnerHTML={{ __html: step }} />
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
              <div className="flex flex-col gap-4">

                <div className="flex items-center gap-4">
                  <div className="size-12 rounded-full bg-green-400/10 flex items-center justify-center">
                    <Icon name="check" className="size-6 text-green-400" />
                  </div>
                  <div>
                    <Label>You&apos;re up to date</Label>
                    <Label variant="muted">Version {updateInfo?.currentVersion}</Label>
                  </div>
                </div>

                <FieldSeparator />

                <div className="flex gap-1">
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
              <Empty className="bg-input">
                <Spinner />
              </Empty>
            ) : releasesError ? (
              <Empty className="bg-input">
                <EmptyTitle>{releasesError}</EmptyTitle>
              </Empty>
            ) : releases.length === 0 ? (
              <Empty className="bg-input">
                <EmptyTitle>No releases found</EmptyTitle>
              </Empty>
            ) : (
              <ul className="divide-y divide-border">
                {(() => {
                  // Find the index of the current version to determine which releases are newer
                  const currentIndex = releases.findIndex((r) => r.isCurrent);
                  return releases.map((release, index) => {
                    // A release is newer if it appears before the current version in the list
                    const isNewerThanCurrent = currentIndex !== -1 && index < currentIndex;
                    return (
                      <li key={release.version}>
                        {index > 0 }

                        <div className="relative flex gap-x-4 py-5">

                          <div className="absolute top-0 bottom-0 left-0 flex w-6 justify-center">
                            <div className="w-px bg-secondary"></div>
                          </div>
                          <div className="relative flex size-6 flex-none items-center justify-center bg-[#1c1c1c]">
                            {release.isCurrent && !updateInfo?.available ? (
                              <div className="size-1.5 rounded-full bg-green-400 ring ring-green-400" />
                            ) : release.isCurrent && updateInfo?.available ? (
                              <div className="size-1.5 rounded-full bg-white/50 ring ring-white/50" />
                            ) : (
                              <div className="size-1.5 rounded-full bg-[#1c1c1c] ring ring-secondary" />
                            )}
                          </div>

                          <div className="flex-auto py-0.5">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={
                                  index === 0 && release.isCurrent ? 'green' :
                                    index === 0 ? 'default' :
                                      release.isCurrent ? 'secondary' :
                                        'outline'
                                }
                                className="gap-2"
                              >
                                {release.version}
                              </Badge>
                              <div className="size-1 bg-secondary rounded-full" />
                              <time className="flex-none py-0.5 opacity-50">{formatDate(release.publishedAt)}</time>
                              {release.isCurrent && (
                                <div className="flex items-center gap-2">
                                  <div className="size-1 bg-secondary rounded-full" />
                                  <Label variant="muted">Current</Label>
                                </div>
                              )}
                              {index === 0 && !release.isCurrent && (
                                <div className="flex items-center gap-2">
                                  <div className="size-1 bg-secondary rounded-full" />
                                  <Label variant="muted">Newest</Label>
                                </div>
                              )}
                            </div>
                            {release.isPrerelease && (
                              <Badge variant="outline" className="text-xs">Pre-release</Badge>
                            )}
                            {release.body && (
                              <div
                                className="mt-2 prose prose-sm dark:prose-invert max-w-none text-sm text-muted-foreground [&>ul]:list-disc [&>ul]:ml-4 [&>ol]:list-decimal [&>ol]:ml-4 [&>p]:mb-2 [&>h1]:text-base [&>h1]:font-semibold [&>h1]:mb-2 [&>h2]:text-sm [&>h2]:font-semibold [&>h2]:mb-2 [&>h3]:text-sm [&>h3]:font-medium [&>h3]:mb-1"
                                dangerouslySetInnerHTML={{ __html: marked(release.body) as string }}
                              />
                            )}
                          </div>

                        </div>

                      </li>
                    );
                  });
                })()}
              </ul>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
