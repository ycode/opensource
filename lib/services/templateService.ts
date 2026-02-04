import { getKnexClient, closeKnexClient, testKnexConnection } from '../knex-client';
import { getSupabaseAdmin } from '../supabase-server';

/**
 * Template Service
 *
 * Handles fetching templates from the template service and applying them
 * to the local database.
 */

const STORAGE_BUCKET = 'assets';

// Production template service URL (can be overridden for local development)
const TEMPLATE_API_URL =
  process.env.TEMPLATE_API_URL || 'https://templates-lv53y07hp-ycode.vercel.app';

/**
 * Tables to truncate when applying a template.
 * Order matters for foreign key constraints (children first).
 */
const TABLES_TO_TRUNCATE = [
  'translations',
  'locales',
  'versions',
  'collection_item_values',
  'collection_items',
  'collection_fields',
  'collections',
  'layer_styles',
  'components',
  'page_layers',
  'pages',
  'page_folders',
];

export interface TemplateCategory {
  id: string;
  name: string;
  description: string;
  order: number;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  preview: string;
  stats?: {
    pages: number;
    components: number;
    collections: number;
  };
  categoryId: string | null;
  livePreviewUrl: string | null;
}

export interface TemplateDetails extends Template {
  version: string;
  createdAt: string;
  tables: string[];
}

export interface ApplyTemplateResult {
  success: boolean;
  templateName?: string;
  error?: string;
}

/**
 * List available templates and categories from the template service
 */
export async function listTemplatesWithCategories(): Promise<{
  templates: Template[];
  categories: TemplateCategory[];
}> {
  const response = await fetch(`${TEMPLATE_API_URL}/api/templates`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch templates');
  }

  const data = await response.json();
  return {
    templates: data.templates || [],
    categories: data.categories || [],
  };
}

/**
 * List available templates from the template service
 * @deprecated Use listTemplatesWithCategories instead
 */
export async function listTemplates(): Promise<Template[]> {
  const { templates } = await listTemplatesWithCategories();
  return templates;
}

/**
 * List template categories from the template service
 * @deprecated Use listTemplatesWithCategories instead
 */
export async function listCategories(): Promise<TemplateCategory[]> {
  const { categories } = await listTemplatesWithCategories();
  return categories;
}

/**
 * Get template details from the template service
 */
export async function getTemplate(id: string): Promise<TemplateDetails | null> {
  const response = await fetch(`${TEMPLATE_API_URL}/api/templates/${id}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error('Failed to fetch template');
  }

  const data = await response.json();
  return data.template;
}

/**
 * Copy template assets from the template-service CDN to the user's storage.
 * This ensures assets are owned by the user and won't break if template is deleted.
 *
 * @param knex - Knex transaction or client
 */
async function copyTemplateAssetsToUserStorage(knex: ReturnType<typeof getKnexClient> extends Promise<infer T> ? T : never): Promise<void> {
  const supabase = await getSupabaseAdmin();
  if (!supabase) {
    console.warn('[copyTemplateAssets] Supabase not configured, skipping asset copy');
    return;
  }

  // Find all template assets that need to be copied (have public_url but no storage_path)
  const templateAssets = await knex('assets')
    .whereNotNull('public_url')
    .whereNull('storage_path')
    .where('source', 'like', 'template:%')
    .select('id', 'filename', 'public_url', 'mime_type');

  if (templateAssets.length === 0) {
    console.log('[copyTemplateAssets] No template assets to copy');
    return;
  }

  console.log(`[copyTemplateAssets] Copying ${templateAssets.length} assets to user storage...`);

  for (const asset of templateAssets) {
    try {
      // Download from template-service CDN with timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      console.log(`[copyTemplateAssets] Downloading ${asset.filename} from ${asset.public_url}...`);

      let response: Response;
      try {
        response = await fetch(asset.public_url, { signal: controller.signal });
      } catch (fetchErr) {
        clearTimeout(timeout);
        console.warn(`[copyTemplateAssets] Failed to fetch ${asset.filename}:`, fetchErr);
        continue;
      }
      clearTimeout(timeout);

      if (!response.ok) {
        console.warn(`[copyTemplateAssets] Failed to download ${asset.filename}: ${response.status}`);
        continue;
      }

      const blob = await response.blob();
      const buffer = Buffer.from(await blob.arrayBuffer());

      // Generate unique storage path
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 15);
      const extension = asset.filename.split('.').pop() || 'bin';
      const storagePath = `${timestamp}-${random}.${extension}`;

      // Upload to user's storage
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, buffer, {
          contentType: asset.mime_type || 'application/octet-stream',
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        console.warn(`[copyTemplateAssets] Failed to upload ${asset.filename}:`, error);
        continue;
      }

      // Get new public URL
      const { data: urlData } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(data.path);

      // Update asset record with new storage path and URL
      await knex('assets')
        .where('id', asset.id)
        .update({
          storage_path: data.path,
          public_url: urlData.publicUrl,
        });

      console.log(`[copyTemplateAssets] Copied ${asset.filename} -> ${data.path}`);
    } catch (err) {
      console.warn(`[copyTemplateAssets] Error copying ${asset.filename}:`, err);
    }
  }

  console.log('[copyTemplateAssets] Asset copy complete');
}

/**
 * Apply a template to the database
 *
 * This will:
 * 1. Fetch the processed SQL from the template service
 * 2. Clear previous template assets (keep user uploads)
 * 3. Truncate content tables
 * 4. Execute the template INSERT statements
 * 5. Copy template assets to user's storage
 *
 * @param templateId - The template ID to apply
 * @param tenantId - Optional tenant ID for cloud multi-tenant
 */
export async function applyTemplate(
  templateId: string,
  tenantId?: string
): Promise<ApplyTemplateResult> {
  // Test database connection first
  const canConnect = await testKnexConnection();
  if (!canConnect) {
    return {
      success: false,
      error: 'Cannot connect to database. Please check your configuration.',
    };
  }

  const knex = await getKnexClient();

  try {
    // 1. Fetch processed SQL from template service
    const response = await fetch(
      `${TEMPLATE_API_URL}/api/templates/${templateId}/apply`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.error || 'Failed to fetch template',
      };
    }

    const { template, sql } = await response.json();

    // 2. Execute in a transaction for atomicity
    await knex.transaction(async (trx) => {
      console.log('[applyTemplate] Starting template application...');

      // Disable FK constraints temporarily for truncation
      await trx.raw('SET session_replication_role = replica');

      // 2a. Clear previous template assets (keep user uploads) - only if table exists
      const assetsTableExists = await trx.schema.hasTable('assets');
      if (assetsTableExists) {
        console.log('[applyTemplate] Clearing previous template assets...');
        await trx.raw(sql.clearPreviousTemplate);
      }

      // 2b. Clean up empty asset folders from previous template - only if tables exist
      const assetFoldersTableExists = await trx.schema.hasTable('asset_folders');
      if (assetFoldersTableExists && assetsTableExists) {
        await trx.raw(`
          DELETE FROM asset_folders 
          WHERE id NOT IN (
            SELECT DISTINCT asset_folder_id FROM assets 
            WHERE asset_folder_id IS NOT NULL
          )
          AND id NOT IN (
            SELECT DISTINCT asset_folder_id FROM asset_folders 
            WHERE asset_folder_id IS NOT NULL
          )
        `);
      }

      // 2c. Truncate content tables (only tables that exist)
      console.log('[applyTemplate] Truncating content tables...');
      const existingTables: string[] = [];
      for (const table of TABLES_TO_TRUNCATE) {
        const exists = await trx.schema.hasTable(table);
        if (exists) {
          existingTables.push(table);
        }
      }
      if (existingTables.length > 0) {
        await trx.raw(`TRUNCATE ${existingTables.join(', ')} CASCADE;`);
      }

      // 2d. Insert template data
      console.log('[applyTemplate] Inserting template data...');
      await trx.raw(sql.insert);

      // Re-enable FK constraints
      await trx.raw('SET session_replication_role = DEFAULT');

      console.log('[applyTemplate] Template data inserted successfully');
    });

    // 3. Copy template assets to user's storage (outside transaction)
    // This happens after template data is committed, so partial asset failures
    // won't roll back the template
    console.log('[applyTemplate] Copying template assets to user storage...');
    await copyTemplateAssetsToUserStorage(knex);

    console.log('[applyTemplate] Template applied successfully');

    return {
      success: true,
      templateName: template.name,
    };
  } catch (error) {
    console.error('[applyTemplate] Failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Template application failed',
    };
  } finally {
    await closeKnexClient();
  }
}
