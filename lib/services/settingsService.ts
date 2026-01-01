/**
 * Settings Service
 *
 * Business logic for managing application settings
 */

import { getSettingByKey, setSetting } from '../repositories/settingsRepository';
import type { Setting } from '@/types';

/**
 * Copy draft CSS to published CSS
 * @returns True if CSS was successfully published
 */
export async function publishCSS(): Promise<boolean> {
  try {
    const draftCSS = await getSettingByKey('draft_css');
    
    if (draftCSS) {
      await setSetting('published_css', draftCSS);
      return true;
    }
    
    return false;
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
