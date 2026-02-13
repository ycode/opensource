/**
 * Dynamic Robots.txt Route
 *
 * Generates robots.txt with configurable content and sitemap reference
 */

import { NextResponse } from 'next/server';
import { getSettingByKey } from '@/lib/repositories/settingsRepository';
import { storage } from '@/lib/storage';
import type { SitemapSettings } from '@/types';

/**
 * Get the base URL for robots.txt generation
 */
function getBaseUrl(): string {
  // Use environment variable if set
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  }

  // Fallback to Vercel URL
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // Development fallback
  return 'http://localhost:3002';
}

export async function GET() {
  try {
    const hasSupabaseCredentials = await storage.exists();
    if (!hasSupabaseCredentials) {
      const baseUrl = getBaseUrl();
      const fallback = `# Default robots.txt
User-agent: *
Allow: /
Disallow: /ycode/

# Sitemap
Sitemap: ${baseUrl}/sitemap.xml`;

      return new NextResponse(fallback, {
        headers: {
          'Content-Type': 'text/plain',
          'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        },
      });
    }

    // Get custom robots.txt content if set
    const customRobots = await getSettingByKey('robots_txt');

    // Get sitemap settings to determine if we should include sitemap reference
    const sitemapSettings = await getSettingByKey('sitemap') as SitemapSettings | null;
    const sitemapEnabled = sitemapSettings?.mode && sitemapSettings.mode !== 'none';

    let content: string;

    if (customRobots && typeof customRobots === 'string' && customRobots.trim()) {
      // Use custom robots.txt content
      content = customRobots.trim();

      // If sitemap is enabled and not already referenced, append it
      if (sitemapEnabled && !content.toLowerCase().includes('sitemap:')) {
        const baseUrl = getBaseUrl();
        content += `\n\nSitemap: ${baseUrl}/sitemap.xml`;
      }
    } else {
      // Generate default robots.txt
      const baseUrl = getBaseUrl();

      content = `# Default robots.txt
User-agent: *
Allow: /

# Disallow admin/editor paths
Disallow: /ycode/`;

      // Add sitemap reference if enabled
      if (sitemapEnabled) {
        content += `\n\n# Sitemap\nSitemap: ${baseUrl}/sitemap.xml`;
      }
    }

    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    });
  } catch (error) {
    console.error('[robots.txt] Error generating robots.txt:', error);

    // Return default on error
    const fallback = `User-agent: *
Allow: /
Disallow: /ycode/`;

    return new NextResponse(fallback, {
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }
}
