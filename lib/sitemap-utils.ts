/**
 * Sitemap Utility Functions
 *
 * Generates sitemap XML for published pages with localization support
 */

import type {
  Page,
  PageFolder,
  Locale,
  Translation,
  SitemapSettings,
  SitemapChangeFrequency,
  CollectionItem,
} from '@/types';
import { buildSlugPath, buildLocalizedSlugPath } from './page-utils';
import { getTranslatableKey } from './localisation-utils';

export interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: SitemapChangeFrequency;
  alternates?: SitemapAlternate[];
}

export interface SitemapAlternate {
  hreflang: string;
  href: string;
}

/**
 * Build sitemap URLs for a static page (non-dynamic)
 */
function buildStaticPageUrls(
  page: Page,
  folders: PageFolder[],
  baseUrl: string,
  settings: SitemapSettings,
  locales: Locale[],
  translationsByLocale: Map<string, Record<string, Translation>>
): SitemapUrl[] {
  // Always skip pages with noindex
  if (page.settings?.seo?.noindex) {
    return [];
  }

  // Skip error pages (401, 404, 500)
  if (page.error_page != null) {
    return [];
  }

  const defaultLocale = locales.find(l => l.is_default);
  const nonDefaultLocales = locales.filter(l => !l.is_default);

  // Build the default (base) URL
  const defaultPath = buildSlugPath(page, folders, 'page');
  const defaultUrl = `${baseUrl}${defaultPath}`;

  const sitemapUrl: SitemapUrl = {
    loc: defaultUrl,
    lastmod: page.updated_at,
    changefreq: settings.defaultChangeFrequency,
  };

  // Always add localized alternates when multiple locales exist
  if (locales.length > 1) {
    const alternates: SitemapAlternate[] = [];

    // Add default locale alternate
    if (defaultLocale) {
      alternates.push({
        hreflang: defaultLocale.code,
        href: defaultUrl,
      });
    }

    // Add non-default locale alternates
    for (const locale of nonDefaultLocales) {
      const translations = translationsByLocale.get(locale.id);
      const localizedPath = buildLocalizedSlugPath(
        page,
        folders,
        'page',
        locale,
        translations
      );
      alternates.push({
        hreflang: locale.code,
        href: `${baseUrl}${localizedPath}`,
      });
    }

    // Add x-default for language negotiation
    alternates.push({
      hreflang: 'x-default',
      href: defaultUrl,
    });

    sitemapUrl.alternates = alternates;
  }

  return [sitemapUrl];
}

/**
 * Build sitemap URLs for a dynamic page with collection items
 */
function buildDynamicPageUrls(
  page: Page,
  folders: PageFolder[],
  baseUrl: string,
  settings: SitemapSettings,
  collectionItems: CollectionItem[],
  slugFieldId: string,
  itemValues: Map<string, Map<string, string>>, // itemId -> fieldId -> value
  locales: Locale[],
  translationsByLocale: Map<string, Record<string, Translation>>
): SitemapUrl[] {
  // Always skip error pages (401, 404, 500)
  if (page.error_page != null) {
    return [];
  }

  // Always skip pages with noindex
  if (page.settings?.seo?.noindex) {
    return [];
  }

  const urls: SitemapUrl[] = [];
  const defaultLocale = locales.find(l => l.is_default);
  const nonDefaultLocales = locales.filter(l => !l.is_default);

  // Build folder path prefix (without the {slug} placeholder)
  const folderPath = buildSlugPath(page, folders, 'page', '').replace(/\/$/, '');

  for (const item of collectionItems) {
    // Get the slug value from item values
    const fieldValues = itemValues.get(item.id);
    const slugValue = fieldValues?.get(slugFieldId);

    if (!slugValue) continue;

    const itemPath = folderPath ? `${folderPath}/${slugValue}` : `/${slugValue}`;
    const itemUrl = `${baseUrl}${itemPath}`;

    const sitemapUrl: SitemapUrl = {
      loc: itemUrl,
      lastmod: item.updated_at,
      changefreq: settings.defaultChangeFrequency,
    };

    // Always add localized alternates when multiple locales exist
    if (locales.length > 1) {
      const alternates: SitemapAlternate[] = [];

      // Add default locale alternate
      if (defaultLocale) {
        alternates.push({
          hreflang: defaultLocale.code,
          href: itemUrl,
        });
      }

      // Add non-default locale alternates
      for (const locale of nonDefaultLocales) {
        const translations = translationsByLocale.get(locale.id);
        // Build localized folder path
        const localizedFolderPath = buildLocalizedSlugPath(
          page,
          folders,
          'page',
          locale,
          translations,
          ''
        ).replace(/\/$/, '');

        // Get translated slug for the CMS item if available
        const translatedSlugKey = getTranslatableKey({
          source_type: 'cms',
          source_id: item.id,
          content_key: slugFieldId,
        });
        const translatedSlug = translations?.[translatedSlugKey]?.content_value || slugValue;

        const localizedItemPath = localizedFolderPath
          ? `${localizedFolderPath}/${translatedSlug}`
          : `/${locale.code}/${translatedSlug}`;

        alternates.push({
          hreflang: locale.code,
          href: `${baseUrl}${localizedItemPath}`,
        });
      }

      // Add x-default
      alternates.push({
        hreflang: 'x-default',
        href: itemUrl,
      });

      sitemapUrl.alternates = alternates;
    }

    urls.push(sitemapUrl);
  }

  return urls;
}

/**
 * Generate sitemap URLs from pages and collection data
 */
export function generateSitemapUrls(
  pages: Page[],
  folders: PageFolder[],
  baseUrl: string,
  settings: SitemapSettings,
  locales: Locale[],
  translationsByLocale: Map<string, Record<string, Translation>>,
  dynamicPageData: Map<string, {
    items: CollectionItem[];
    slugFieldId: string;
    itemValues: Map<string, Map<string, string>>;
  }>
): SitemapUrl[] {
  const urls: SitemapUrl[] = [];

  for (const page of pages) {
    if (page.is_dynamic && page.settings?.cms) {
      // Dynamic page - generate URLs for each collection item
      const data = dynamicPageData.get(page.id);
      if (data) {
        urls.push(...buildDynamicPageUrls(
          page,
          folders,
          baseUrl,
          settings,
          data.items,
          data.slugFieldId,
          data.itemValues,
          locales,
          translationsByLocale
        ));
      }
    } else {
      // Static page
      urls.push(...buildStaticPageUrls(
        page,
        folders,
        baseUrl,
        settings,
        locales,
        translationsByLocale
      ));
    }
  }

  return urls;
}

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Format date for sitemap (W3C Datetime format)
 */
function formatSitemapDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toISOString().split('T')[0];
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * Generate XML sitemap from URLs
 */
export function generateSitemapXml(urls: SitemapUrl[]): string {
  const hasAlternates = urls.some(url => url.alternates && url.alternates.length > 0);

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"';

  if (hasAlternates) {
    xml += '\n        xmlns:xhtml="http://www.w3.org/1999/xhtml"';
  }

  xml += '>\n';

  for (const url of urls) {
    xml += '  <url>\n';
    xml += `    <loc>${escapeXml(url.loc)}</loc>\n`;

    if (url.lastmod) {
      xml += `    <lastmod>${formatSitemapDate(url.lastmod)}</lastmod>\n`;
    }

    if (url.changefreq) {
      xml += `    <changefreq>${url.changefreq}</changefreq>\n`;
    }

    // Add xhtml:link elements for language alternates
    if (url.alternates && url.alternates.length > 0) {
      for (const alt of url.alternates) {
        xml += `    <xhtml:link rel="alternate" hreflang="${escapeXml(alt.hreflang)}" href="${escapeXml(alt.href)}" />\n`;
      }
    }

    xml += '  </url>\n';
  }

  xml += '</urlset>';

  return xml;
}

/**
 * Default sitemap settings (Ycode-generated sitemap enabled for new apps)
 */
export function getDefaultSitemapSettings(): SitemapSettings {
  return {
    mode: 'auto',
    includeImages: false,
    defaultChangeFrequency: 'weekly',
    customXml: '',
  };
}
