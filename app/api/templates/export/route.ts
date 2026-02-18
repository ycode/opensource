import { NextRequest } from 'next/server';
import { noCache } from '@/lib/api-response';
import { exportTemplateSQL } from '@/lib/services/templateExportService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/templates/export
 *
 * Export the current database content as template SQL.
 * Returns the manifest and SQL for download or manual upload.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { templateId, templateName, description } = body;

    // Validate required fields
    if (!templateId || !templateName) {
      return noCache(
        { error: 'templateId and templateName are required' },
        400
      );
    }

    // Validate template ID format
    if (!/^[a-z0-9-]+$/.test(templateId)) {
      return noCache(
        { error: 'templateId must be lowercase alphanumeric with hyphens only' },
        400
      );
    }

    const result = await exportTemplateSQL(
      templateId,
      templateName,
      description || ''
    );

    if (!result.success) {
      return noCache({ error: result.error }, 500);
    }

    return noCache({
      success: true,
      manifest: result.manifest,
      sql: result.sql,
    });
  } catch (error) {
    console.error('[POST /api/templates/export] Error:', error);

    return noCache(
      { error: error instanceof Error ? error.message : 'Export failed' },
      500
    );
  }
}
