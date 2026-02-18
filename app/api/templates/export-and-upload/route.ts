import { NextRequest } from 'next/server';
import { noCache } from '@/lib/api-response';
import { exportAndUploadTemplate } from '@/lib/services/templateExportService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Allow longer timeout for asset upload
export const maxDuration = 120;

/**
 * POST /api/templates/export-and-upload
 *
 * Export the current database content and upload it to the template service.
 * This combines export + asset collection + upload in one operation.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { templateId, templateName, description, email } = body;

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

    const result = await exportAndUploadTemplate(
      templateId,
      templateName,
      description || '',
      email || ''
    );

    if (!result.success) {
      return noCache({ error: result.error }, 500);
    }

    return noCache({
      success: true,
      message: `Template "${templateName}" exported and uploaded successfully`,
      templateId,
    });
  } catch (error) {
    console.error('[POST /api/templates/export-and-upload] Error:', error);

    return noCache(
      { error: error instanceof Error ? error.message : 'Export and upload failed' },
      500
    );
  }
}
