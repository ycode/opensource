import { revalidateTag, revalidatePath } from 'next/cache';

/**
 * Cache Invalidation Service
 *
 * Handles CDN cache invalidation for published pages using Next.js revalidation
 */

/**
 * Invalidate cache for a specific page by route path
 * This will clear both the Next.js cache and trigger CDN purge on Vercel
 *
 * @param routePath - Route path
 */
export async function invalidatePage(routePath: string): Promise<boolean> {
  console.log(`[Cache] Invalidation path: "${routePath}"`);
  console.log(`[Cache] Revalidating tag: "route-/${routePath}"`);

  try {
    // Revalidate using the cache tag (matches unstable_cache tags)
    revalidateTag(`route-/${routePath}`, 'max');

    // Revalidate the specific page path (clears full route cache including static generation)
    revalidatePath(`/${routePath}`, 'page');
    return true;
  } catch (error) {
    console.error('❌ [Cache] Invalidation error:', error);
    return false;
  }
}

/**
 * Invalidate cache for multiple pages
 *
 * @param routePaths - Array of route paths
 */
export async function invalidatePages(routePaths: string[]): Promise<boolean> {
  const results = await Promise.all(
    routePaths.map((routePath) => invalidatePage(routePath))
  );

  return results.every((result) => result);
}

/**
 * Clear all cache (full site invalidation)
 * Invalidates the root layout which cascades to all pages
 */
export async function clearAllCache(): Promise<void> {
  try {
    // Invalidate Data Cache entries created by public page unstable_cache calls.
    revalidateTag('all-pages', 'max');
    revalidatePath('/', 'layout');
  } catch (error) {
    console.error('❌ [Cache] Clear all error:', error);
    throw new Error('Failed to clear all cache');
  }
}
