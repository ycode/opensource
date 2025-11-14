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
  try {
    // Revalidate using the cache tag (matches unstable_cache tags)
    revalidateTag(`route-/${routePath}`);

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

