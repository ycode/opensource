/**
 * Generate Page Metadata
 *
 * SERVER-ONLY: This module uses server-only utilities and should never be imported in client code.
 */

import 'server-only';

import type { Metadata } from 'next';
import type { Page } from '@/types';
import type { CollectionItemWithValues } from '@/types';
import { resolveInlineVariables, resolveImageUrl } from '@/lib/resolve-cms-variables';

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
}

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
  const { isPreview = false, fallbackTitle, fallbackDescription, collectionItem } = options;

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
