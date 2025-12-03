import { publishAllPages } from '@/lib/services/publishingService';
import { invalidatePage } from '@/lib/services/cacheInvalidationService';
import { buildSlugPath } from '@/lib/page-utils';
import { noCache } from '@/lib/api-response';
import { cleanupDeletedCollections } from '@/lib/services/collectionPublishingService';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/publish
 *
 * Publish all draft records (pages, folders, layers, and clean up deleted collections)
 * Optimized with batch queries
 * Draft records remain unchanged
 */
export async function POST() {
  try {
    // Publish all draft pages, folders, and their layers
    const result = await publishAllPages();

    // Clean up any soft-deleted collections
    await cleanupDeletedCollections();

    // Count error pages vs regular pages
    const errorPages = result.published.filter(({ page }) => page.error_page !== null);
    const regularPages = result.published.filter(({ page }) => page.error_page === null);

    // Log error pages separately
    if (errorPages.length > 0) {
      console.log('[Publish] Error pages published:', errorPages.map(({ page }) =>
        `${page.error_page} (${page.name})`
      ).join(', '));
    }

    // Invalidate cache for all published pages using full route paths
    const invalidations = result.published.map(({ page }) => {
      // Error pages don't use normal routing - skip cache invalidation for them
      if (page.error_page !== null) {
        console.log(`[Publish] Skipping cache invalidation for error page: ${page.error_page}`);
        return Promise.resolve(true);
      }

      const fullPath = buildSlugPath(page, result.publishedFolders, 'page');
      const routePath = fullPath.slice(1) || '';

      return invalidatePage(routePath);
    });

    await Promise.all(invalidations);
    console.log(`[Publish] Cache invalidated for ${regularPages.length} page(s)`);

    // Build success message
    const messageParts = [];
    if (result.publishedFolders.length > 0) {
      messageParts.push(`${result.publishedFolders.length} folder(s)`);
    }
    if (regularPages.length > 0) {
      messageParts.push(`${regularPages.length} page(s)`);
    }
    if (errorPages.length > 0) {
      messageParts.push(`${errorPages.length} error page(s)`);
    }

    return noCache({
      data: result,
      message: `Published ${messageParts.join(', ')} successfully`,
    });
  } catch (error) {
    console.error('Failed to publish pages:', error);

    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to publish pages' },
      500
    );
  }
}
