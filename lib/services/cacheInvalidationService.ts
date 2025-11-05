import { revalidateTag, revalidatePath } from 'next/cache';

/**
 * Cache Invalidation Service
 * 
 * Handles CDN cache invalidation for published pages using Next.js revalidation
 */

/**
 * Invalidate cache for a specific page by slug
 * This will clear both the Next.js cache and trigger CDN purge on Vercel
 */
export async function invalidatePage(slug: string): Promise<boolean> {
  try {
    // Revalidate using the cache tag (matches unstable_cache tags)
    revalidateTag(`page-${slug}`);
    
    // Also revalidate the path to ensure all caches are cleared
    revalidatePath(`/${slug}`);
    
    return true;
  } catch (error) {
    console.error('❌ Cache invalidation error:', error);
    return false;
  }
}

/**
 * Invalidate cache for multiple pages
 */
export async function invalidatePages(slugs: string[]): Promise<boolean> {
  const results = await Promise.all(slugs.map((slug) => invalidatePage(slug)));
  return results.every((result) => result);
}

