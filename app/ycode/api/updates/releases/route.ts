import packageJson from '../../../../../package.json';
import { noCache } from '@/lib/api-response';

const UPSTREAM_REPO = 'ycode/opensource'; // Official YCode repo
const CURRENT_VERSION = packageJson.version;

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  html_url: string;
  prerelease: boolean;
  draft: boolean;
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

/**
 * GET /ycode/api/updates/releases
 *
 * Fetch all releases from the official YCode repository
 */
export async function GET() {
  try {
    // Fetch all releases from upstream repo
    const response = await fetch(
      `https://api.github.com/repos/${UPSTREAM_REPO}/releases`,
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'YCode-Update-Checker',
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      return noCache({
        releases: [],
        currentVersion: CURRENT_VERSION,
        error: 'Unable to fetch releases',
      });
    }

    const githubReleases: GitHubRelease[] = await response.json();

    // Filter out drafts and transform the data
    const releases: Release[] = githubReleases
      .filter(release => !release.draft)
      .map(release => {
        const version = release.tag_name?.replace(/^v/, '') || '';
        return {
          version,
          name: release.name || `Version ${version}`,
          body: release.body || '',
          publishedAt: release.published_at,
          url: release.html_url,
          isCurrent: version === CURRENT_VERSION,
          isPrerelease: release.prerelease,
        };
      });

    return noCache({
      releases,
      currentVersion: CURRENT_VERSION,
    });
  } catch (error) {
    console.error('Failed to fetch releases:', error);

    return noCache({
      releases: [],
      currentVersion: CURRENT_VERSION,
      error: 'Failed to fetch releases',
    });
  }
}
