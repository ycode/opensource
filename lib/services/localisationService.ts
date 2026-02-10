/**
 * Localisation Publishing Service
 * Handles publishing of locales and translations
 */

import { getSupabaseAdmin } from '../supabase-server';
import type { Locale, Translation } from '@/types';

export interface PublishLocalisationResult {
  locales: number;
  translations: number;
  timing: {
    localesDurationMs: number;
    translationsDurationMs: number;
  };
}

/**
 * Publish all draft locales and translations
 * Creates/updates published versions while keeping drafts unchanged
 */
export async function publishLocalisation(): Promise<PublishLocalisationResult> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const deletedAt = new Date().toISOString();
  let publishedLocalesCount = 0;
  let publishedTranslationsCount = 0;
  let localesDurationMs = 0;
  let translationsDurationMs = 0;

  // === LOCALES ===
  const localesStart = performance.now();

  // Step 1: Fetch all draft locales (including soft-deleted)
  const { data: allDraftLocales, error: localesError } = await client
    .from('locales')
    .select('*')
    .eq('is_published', false);

  if (localesError) {
    throw new Error(`Failed to fetch draft locales: ${localesError.message}`);
  }

  if (allDraftLocales && allDraftLocales.length > 0) {
    const activeDraftLocales = allDraftLocales.filter((l: Locale) => l.deleted_at === null);
    const softDeletedDraftLocales = allDraftLocales.filter((l: Locale) => l.deleted_at !== null);

    // Step 2: Soft-delete published versions of soft-deleted draft locales (single query)
    if (softDeletedDraftLocales.length > 0) {
      const localeIds = softDeletedDraftLocales.map((locale: Locale) => locale.id);
      const { error: deleteLocalesError } = await client
        .from('locales')
        .update({ deleted_at: deletedAt })
        .in('id', localeIds)
        .eq('is_published', true)
        .is('deleted_at', null);

      if (deleteLocalesError) {
        throw new Error(`Failed to soft-delete locales: ${deleteLocalesError.message}`);
      }
    }

    // Step 3: Insert or update published locales
    if (activeDraftLocales.length > 0) {
      // First, fetch existing published locales to determine insert vs update
      const { data: existingPublished } = await client
        .from('locales')
        .select('id')
        .eq('is_published', true)
        .in('id', activeDraftLocales.map((l: Locale) => l.id));

      const existingPublishedIds = new Set(existingPublished?.map(l => l.id) || []);

      const localesToInsert: any[] = [];
      const localesToUpdate: any[] = [];

      for (const locale of activeDraftLocales) {
        const publishedData = {
          id: locale.id,
          code: locale.code,
          label: locale.label,
          is_default: locale.is_default,
          is_published: true,
          created_at: locale.created_at,
          updated_at: locale.updated_at,
          deleted_at: null,
        };

        if (existingPublishedIds.has(locale.id)) {
          localesToUpdate.push(publishedData);
        } else {
          localesToInsert.push(publishedData);
        }
      }

      // Insert new published locales
      if (localesToInsert.length > 0) {
        const { error: insertError } = await client
          .from('locales')
          .insert(localesToInsert);

        if (insertError) {
          throw new Error(`Failed to insert published locales: ${insertError.message}`);
        }
      }

      // Update existing published locales (batch operation)
      if (localesToUpdate.length > 0) {
        // Use upsert for updates since we know these records exist
        const { error: updateError } = await client
          .from('locales')
          .upsert(localesToUpdate, {
            onConflict: 'id,is_published',
          });

        if (updateError) {
          throw new Error(`Failed to update published locales: ${updateError.message}`);
        }
      }

      publishedLocalesCount = activeDraftLocales.length;
    }
  }

  localesDurationMs = Math.round(performance.now() - localesStart);

  // === TRANSLATIONS ===
  const translationsStart = performance.now();

  // Step 4: Fetch all draft translations (including soft-deleted)
  const { data: allDraftTranslations, error: translationsError } = await client
    .from('translations')
    .select('*')
    .eq('is_published', false);

  if (translationsError) {
    throw new Error(`Failed to fetch draft translations: ${translationsError.message}`);
  }

  if (allDraftTranslations && allDraftTranslations.length > 0) {
    const activeDraftTranslations = allDraftTranslations.filter((t: Translation) => t.deleted_at === null);
    const softDeletedDraftTranslations = allDraftTranslations.filter((t: Translation) => t.deleted_at !== null);

    // Step 5: Soft-delete published versions of soft-deleted draft translations (single query)
    if (softDeletedDraftTranslations.length > 0) {
      const translationIds = softDeletedDraftTranslations.map((translation: Translation) => translation.id);
      const { error: deleteTranslationsError } = await client
        .from('translations')
        .update({ deleted_at: deletedAt })
        .in('id', translationIds)
        .eq('is_published', true)
        .is('deleted_at', null);

      if (deleteTranslationsError) {
        throw new Error(`Failed to soft-delete translations: ${deleteTranslationsError.message}`);
      }
    }

    // Step 6: Insert or update published translations
    if (activeDraftTranslations.length > 0) {
      // First, fetch existing published translations to determine insert vs update
      const { data: existingPublished } = await client
        .from('translations')
        .select('id')
        .eq('is_published', true)
        .in('id', activeDraftTranslations.map((t: Translation) => t.id));

      const existingPublishedIds = new Set(existingPublished?.map(t => t.id) || []);

      const translationsToInsert: any[] = [];
      const translationsToUpdate: any[] = [];

      for (const translation of activeDraftTranslations) {
        const publishedData = {
          id: translation.id,
          locale_id: translation.locale_id,
          source_type: translation.source_type,
          source_id: translation.source_id,
          content_key: translation.content_key,
          content_type: translation.content_type,
          content_value: translation.content_value,
          is_completed: translation.is_completed,
          is_published: true,
          created_at: translation.created_at,
          updated_at: translation.updated_at,
          deleted_at: null,
        };

        if (existingPublishedIds.has(translation.id)) {
          translationsToUpdate.push(publishedData);
        } else {
          translationsToInsert.push(publishedData);
        }
      }

      // Insert new published translations
      if (translationsToInsert.length > 0) {
        const { error: insertError } = await client
          .from('translations')
          .insert(translationsToInsert);

        if (insertError) {
          throw new Error(`Failed to insert published translations: ${insertError.message}`);
        }
      }

      // Update existing published translations (batch operation)
      if (translationsToUpdate.length > 0) {
        // Use upsert for updates since we know these records exist
        const { error: updateError } = await client
          .from('translations')
          .upsert(translationsToUpdate, {
            onConflict: 'id,is_published',
          });

        if (updateError) {
          throw new Error(`Failed to update published translations: ${updateError.message}`);
        }
      }

      publishedTranslationsCount = activeDraftTranslations.length;
    }
  }

  translationsDurationMs = Math.round(performance.now() - translationsStart);

  return {
    locales: publishedLocalesCount,
    translations: publishedTranslationsCount,
    timing: {
      localesDurationMs,
      translationsDurationMs,
    },
  };
}
