/**
 * Dynamic Sitemap XML Route
 *
 * Generates sitemap.xml from published pages with localization support
 */

import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';

import { getAllPages } from '@/lib/repositories/pageRepository';
import { getAllPublishedPageFolders } from '@/lib/repositories/pageFolderRepository';
import { getAllLocales } from '@/lib/repositories/localeRepository';
import { getTranslationsByLocale } from '@/lib/repositories/translationRepository';
import { getSettingByKey } from '@/lib/repositories/settingsRepository';
import { getItemsByCollectionId } from '@/lib/repositories/collectionItemRepository';
import { getValuesByItemIds } from '@/lib/repositories/collectionItemValueRepository';
import {
  generateSitemapUrls,
  generateSitemapXml,
  getDefaultSitemapSettings,
} from '@/lib/sitemap-utils';
import type { SitemapSettings, Translation, CollectionItem } from '@/types';

/**
 * Get the base URL for sitemap generation
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
      const xml = generateSitemapXml([]);
      return new NextResponse(xml, {
        headers: {
          'Content-Type': 'application/xml',
          'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        },
      });
    }

    // Get sitemap settings
    const storedSettings = await getSettingByKey('sitemap');
    const settings: SitemapSettings = storedSettings || getDefaultSitemapSettings();

    // If sitemap is disabled, return 404
    if (settings.mode === 'none') {
      return new NextResponse('Sitemap not enabled', { status: 404 });
    }

    // If custom XML mode, return the custom content
    if (settings.mode === 'custom' && settings.customXml) {
      return new NextResponse(settings.customXml, {
        headers: {
          'Content-Type': 'application/xml',
          'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        },
      });
    }

    // Auto-generate sitemap
    const baseUrl = getBaseUrl();

    // Fetch published pages and folders
    const [pages, folders, locales] = await Promise.all([
      getAllPages({ is_published: true }),
      getAllPublishedPageFolders(),
      getAllLocales(true), // Get published locales
    ]);

    // Filter out error pages (401, 404, 500) and soft-deleted pages
    const validPages = pages.filter(
      p => p.error_page == null && p.deleted_at == null
    );

    // Fetch translations for each locale (always include localized URLs)
    const translationsByLocale = new Map<string, Record<string, Translation>>();
    if (locales.length > 1) {
      for (const locale of locales) {
        if (!locale.is_default) {
          const translations = await getTranslationsByLocale(locale.id, true); // Get published translations
          const translationsMap: Record<string, Translation> = {};
          for (const t of translations) {
            // Create key: source_type:source_id:content_key
            const key = `${t.source_type}:${t.source_id}:${t.content_key}`;
            translationsMap[key] = t;
          }
          translationsByLocale.set(locale.id, translationsMap);
        }
      }
    }

    // Fetch dynamic page data (collection items)
    const dynamicPageData = new Map<string, {
      items: CollectionItem[];
      slugFieldId: string;
      itemValues: Map<string, Map<string, string>>;
    }>();

    const dynamicPages = validPages.filter(p => p.is_dynamic && p.settings?.cms);

    for (const page of dynamicPages) {
      const collectionId = page.settings?.cms?.collection_id;
      const slugFieldId = page.settings?.cms?.slug_field_id;

      if (!collectionId || !slugFieldId) continue;

      try {
        // Fetch published items for this collection
        const { items } = await getItemsByCollectionId(collectionId, true);

        if (items.length === 0) continue;

        // Fetch values for these items (returns Record<itemId, Record<fieldId, value>>)
        const itemIds = items.map(i => i.id);
        const valuesByItem = await getValuesByItemIds(itemIds, true);

        // Build itemValues map: itemId -> fieldId -> value
        const itemValues = new Map<string, Map<string, string>>();
        for (const [itemId, fieldValues] of Object.entries(valuesByItem)) {
          const fieldMap = new Map<string, string>();
          for (const [fieldId, value] of Object.entries(fieldValues)) {
            fieldMap.set(fieldId, value != null ? String(value) : '');
          }
          itemValues.set(itemId, fieldMap);
        }

        dynamicPageData.set(page.id, {
          items,
          slugFieldId,
          itemValues,
        });
      } catch (error) {
        console.error(`[sitemap] Error fetching items for page ${page.id}:`, error);
      }
    }

    // Generate sitemap URLs
    const sitemapUrls = generateSitemapUrls(
      validPages,
      folders,
      baseUrl,
      settings,
      locales,
      translationsByLocale,
      dynamicPageData
    );

    // Generate XML
    const xml = generateSitemapXml(sitemapUrls);

    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (error) {
    console.error('[sitemap] Error generating sitemap:', error);
    return new NextResponse('Error generating sitemap', { status: 500 });
  }
}
