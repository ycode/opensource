import { NextResponse } from 'next/server';

// This would be set in package.json
const CURRENT_VERSION = '1.0.0';
const GITHUB_REPO = 'YOUR_USERNAME/ycode-4'; // TODO: Update with actual repo

/**
 * GET /api/updates/check
 * 
 * Check for updates from GitHub releases
 */
export async function GET() {
  try {
    // Fetch latest release from GitHub
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'YCode',
        },
        next: { revalidate: 3600 }, // Cache for 1 hour
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch latest release');
    }

    const release = await response.json();

    return NextResponse.json({
      current_version: CURRENT_VERSION,
      latest_version: release.tag_name.replace(/^v/, ''),
      has_update: release.tag_name.replace(/^v/, '') !== CURRENT_VERSION,
      release_url: release.html_url,
      release_notes: release.body,
    });
  } catch (error) {
    console.error('Failed to check for updates:', error);
    
    return NextResponse.json(
      {
        current_version: CURRENT_VERSION,
        has_update: false,
        error: 'Failed to check for updates',
      },
      { status: 500 }
    );
  }
}

