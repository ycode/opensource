import { NextResponse } from 'next/server';
import packageJson from '../../../../package.json';
import { noCache } from '@/lib/api-response';

const UPSTREAM_REPO = 'liamwalder/test'; // Official YCode repo
const CURRENT_VERSION = packageJson.version;

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/updates/check
 * 
 * Check for updates from the official YCode repository
 */
export async function GET() {
  try {
    // Fetch latest release from upstream repo
    const response = await fetch(
      `https://api.github.com/repos/${UPSTREAM_REPO}/releases/latest`,
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'YCode-Update-Checker',
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      // No releases yet, or rate limited
      return noCache({
        available: false,
        currentVersion: CURRENT_VERSION,
        message: 'Unable to check for updates',
      });
    }

    const release = await response.json();
    const latestVersion = release.tag_name?.replace(/^v/, '') || '1.0.0';
    
    // Compare versions (simple string comparison for now)
    const hasUpdate = latestVersion !== CURRENT_VERSION && 
                      compareVersions(latestVersion, CURRENT_VERSION) > 0;

    // Detect deployment environment
    const isVercel = process.env.VERCEL === '1';
    const vercelGitProvider = process.env.VERCEL_GIT_PROVIDER; // 'github', 'gitlab', 'bitbucket'
    const vercelGitRepoOwner = process.env.VERCEL_GIT_REPO_OWNER;
    const vercelGitRepoSlug = process.env.VERCEL_GIT_REPO_SLUG;

    // Check if user's repo is a fork of the official repo
    let isFork = false;
    if (vercelGitProvider === 'github' && vercelGitRepoOwner && vercelGitRepoSlug) {
      try {
        const repoResponse = await fetch(
          `https://api.github.com/repos/${vercelGitRepoOwner}/${vercelGitRepoSlug}`,
          {
            headers: {
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'YCode-Update-Checker',
            },
            cache: 'no-store',
          }
        );
        
        if (repoResponse.ok) {
          const repoData = await repoResponse.json();
          // Check if it's a fork and if parent matches our upstream
          isFork = repoData.fork && 
                   repoData.parent?.full_name === UPSTREAM_REPO;
        }
      } catch (error) {
        console.error('Failed to check fork status:', error);
      }
    }

    // Determine update method
    let updateMethod: 'github-sync' | 'git-pull' | 'manual' = 'manual';
    let autoSyncUrl: string | undefined;
    let steps: string[] = [];

    if (isVercel && vercelGitProvider === 'github' && vercelGitRepoOwner && vercelGitRepoSlug) {
      if (isFork) {
        // User forked first, then deployed - ONE CLICK! ✨
        updateMethod = 'github-sync';
        autoSyncUrl = `https://github.com/${vercelGitRepoOwner}/${vercelGitRepoSlug}`;
        
        steps = [
          `Go to <a href="https://github.com/${vercelGitRepoOwner}/${vercelGitRepoSlug}" target="_blank" class="underline font-semibold">your GitHub repository</a>`,
          'Click the <strong class="text-white">"Sync fork"</strong> button (above the file list)',
          'Click <strong class="text-white">"Update branch"</strong>',
          'Done! Vercel will automatically redeploy with the latest changes ✨',
        ];
      } else {
        // User deployed directly without forking - needs git pull
        updateMethod = 'git-pull';
        autoSyncUrl = `https://github.com/${vercelGitRepoOwner}/${vercelGitRepoSlug}`;
        
        steps = [
          '⚠️ <strong class="text-yellow-300">Your repo is not a fork.</strong> For easier one-click updates in the future, consider forking the official repo first.',
          '',
          '<strong class="text-white">To update now:</strong>',
          'Open terminal in your project directory',
          'Add upstream remote (first time only):<br/><code class="bg-blue-800 px-2 py-1 rounded text-xs font-mono">git remote add upstream https://github.com/${UPSTREAM_REPO}.git</code>',
          'Fetch latest changes:<br/><code class="bg-blue-800 px-2 py-1 rounded text-xs font-mono">git fetch upstream</code>',
          'Merge updates:<br/><code class="bg-blue-800 px-2 py-1 rounded text-xs font-mono">git merge upstream/main</code>',
          'Push to your repo:<br/><code class="bg-blue-800 px-2 py-1 rounded text-xs font-mono">git push origin main</code>',
          'Vercel will automatically redeploy ✨',
        ];
      }
    } else {
      // Manual git pull method
      updateMethod = 'git-pull';
      steps = [
        'Open your terminal in the project directory',
        'Run: <code class="bg-blue-800 px-2 py-1 rounded">git fetch upstream</code>',
        'Run: <code class="bg-blue-800 px-2 py-1 rounded">git merge upstream/main</code>',
        'Run: <code class="bg-blue-800 px-2 py-1 rounded">git push origin main</code>',
        'Your deployment will update automatically',
      ];
    }

    return noCache({
      available: hasUpdate,
      currentVersion: CURRENT_VERSION,
      latestVersion,
      releaseUrl: release.html_url,
      releaseNotes: release.body,
      publishedAt: release.published_at,
      updateInstructions: {
        method: updateMethod,
        steps,
        autoSyncUrl,
      },
    });
  } catch (error) {
    console.error('Failed to check for updates:', error);
    
    return noCache({
      available: false,
      currentVersion: CURRENT_VERSION,
      error: 'Failed to check for updates',
    });
  }
}

/**
 * Simple version comparison (semantic versioning)
 * Returns: 1 if a > b, -1 if a < b, 0 if equal
 */
function compareVersions(a: string, b: string): number {
  const aParts = a.split('.').map(Number);
  const bParts = b.split('.').map(Number);
  
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aNum = aParts[i] || 0;
    const bNum = bParts[i] || 0;
    
    if (aNum > bNum) return 1;
    if (aNum < bNum) return -1;
  }
  
  return 0;
}

