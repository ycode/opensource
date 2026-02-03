/**
 * Generate Page Metadata
 *
 * SERVER-ONLY: This module uses server-only utilities and should never be imported in client code.
 */

import 'server-only';

import { cache } from 'react';
import type { Metadata } from 'next';
import type { Page } from '@/types';
import type { CollectionItemWithValues } from '@/types';
import { resolveInlineVariables, resolveImageUrl } from '@/lib/resolve-cms-variables';
import { getSettingsByKeys } from '@/lib/repositories/settingsRepository';

/**
 * Global page render settings fetched once per page render
 */
export interface GlobalPageSettings {
  googleSiteVerification?: string | null;
  globalCanonicalUrl?: string | null;
  gaMeasurementId?: string | null;
  publishedCss?: string | null;
  globalCustomCodeHead?: string | null;
  globalCustomCodeBody?: string | null;
}

/** @deprecated Use GlobalPageSettings instead */
export type GlobalSeoSettings = GlobalPageSettings;

/**
 * Generate metadata options
 */
export interface GenerateMetadataOptions {
  /** Include [Preview] prefix in title */
  isPreview?: boolean;
  /** Fallback title if page has no name */
  fallbackTitle?: string;
  /** Fallback description if page has no SEO description */
  fallbackDescription?: string;
  /** Collection item for resolving field variables (for dynamic pages) */
  collectionItem?: CollectionItemWithValues;
  /** Current page path for canonical URL */
  pagePath?: string;
  /** Pre-fetched global SEO settings (avoids duplicate fetches) */
  globalSeoSettings?: GlobalSeoSettings;
}

/**
 * Fetch all global page settings in a single database query
 * Includes SEO settings, published CSS, and global custom code
 * Wrapped with React cache to deduplicate within the same request
 */
export const fetchGlobalPageSettings = cache(async (): Promise<GlobalPageSettings> => {
  const settings = await getSettingsByKeys([
    'google_site_verification',
    'global_canonical_url',
    'ga_measurement_id',
    'published_css',
    'custom_code_head',
    'custom_code_body',
  ]);

  return {
    googleSiteVerification: settings.google_site_verification || null,
    globalCanonicalUrl: settings.global_canonical_url || null,
    gaMeasurementId: settings.ga_measurement_id || null,
    publishedCss: settings.published_css || null,
    globalCustomCodeHead: settings.custom_code_head || null,
    globalCustomCodeBody: settings.custom_code_body || null,
  };
});

/** @deprecated Use fetchGlobalPageSettings instead */
export const fetchGlobalSeoSettings = fetchGlobalPageSettings;

/**
 * Generate Next.js metadata from a page object
 * Handles SEO settings, Open Graph, Twitter Card, and noindex rules
 * Resolves field variables for dynamic pages
 *
 * @param page - The page object containing settings and metadata
 * @param options - Optional configuration for metadata generation
 * @returns Next.js Metadata object
 */
export async function generatePageMetadata(
  page: Page,
  options: GenerateMetadataOptions = {}
): Promise<Metadata> {
  const { isPreview = false, fallbackTitle, fallbackDescription, collectionItem, pagePath } = options;

  const seo = page.settings?.seo;
  const isErrorPage = page.error_page !== null;

  // Build title - resolve field variables if collection item is available
  let title = seo?.title || page.name || fallbackTitle || 'Page';
  if (collectionItem && seo?.title) {
    title = resolveInlineVariables(seo.title, collectionItem) || page.name || fallbackTitle || 'Page';
  }
  if (isPreview) {
    title = `[Preview] ${title}`;
  }

  // Build description - resolve field variables if collection item is available
  let description = seo?.description || fallbackDescription || `${page.name} - Built with YCode`;
  if (collectionItem && seo?.description) {
    description = resolveInlineVariables(seo.description, collectionItem) || fallbackDescription || `${page.name} - Built with YCode`;
  }

  // Base metadata
  const metadata: Metadata = {
    title,
    description,
  };

  // Use pre-fetched global SEO settings or fetch if not provided (skip for preview mode)
  if (!isPreview) {
    const seoSettings = options.globalSeoSettings || await fetchGlobalSeoSettings();

    // Add Google Site Verification meta tag
    if (seoSettings.googleSiteVerification) {
      metadata.verification = {
        google: seoSettings.googleSiteVerification,
      };
    }

    // Add canonical URL
    if (seoSettings.globalCanonicalUrl && pagePath !== undefined) {
      const canonicalBase = seoSettings.globalCanonicalUrl.replace(/\/$/, '');
      const canonicalUrl = pagePath === '/' || pagePath === ''
        ? canonicalBase
        : `${canonicalBase}${pagePath.startsWith('/') ? pagePath : '/' + pagePath}`;

      metadata.alternates = {
        canonical: canonicalUrl,
      };
    }
  }

  // Add Open Graph and Twitter Card metadata (not for error pages)
  if (seo?.image && !isErrorPage) {
    // Resolve image URL (handles both Asset ID string and FieldVariable)
    const imageUrl = await resolveImageUrl(seo.image, collectionItem);

    if (imageUrl) {
      metadata.openGraph = {
        title,
        description,
        images: [
          {
            url: imageUrl,
            width: 1200,
            height: 630,
          },
        ],
      };
      metadata.twitter = {
        card: 'summary_large_image',
        title,
        description,
        images: [imageUrl],
      };
    }
  }

  // Add noindex if enabled, if error page, or if preview
  if (seo?.noindex || isErrorPage || isPreview) {
    metadata.robots = {
      index: false,
      follow: false,
    };
  }

  return metadata;
}
