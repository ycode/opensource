/**
 * Settings Service
 *
 * Business logic for managing application settings
 */

import { getSettingsByKeys, setSetting } from '@/lib/repositories/settingsRepository';
import type { Setting } from '@/types';

/**
 * Copy draft CSS to published CSS if it changed
 * @returns True if CSS was updated, false if unchanged or missing
 */
export async function publishCSS(): Promise<boolean> {
  try {
    const { draft_css: draftCSS, published_css: publishedCSS } =
      await getSettingsByKeys(['draft_css', 'published_css']);

    if (!draftCSS) {
      return false;
    }

    if (draftCSS === publishedCSS) {
      return false;
    }

    await setSetting('published_css', draftCSS);
    return true;
  } catch (error) {
    console.error('Failed to publish CSS:', error);
    return false;
  }
}

/**
 * Save the published timestamp
 * @param timestamp - ISO timestamp string
 * @returns The created/updated setting
 */
export async function savePublishedAt(timestamp: string): Promise<Setting> {
  return await setSetting('published_at', timestamp);
}
