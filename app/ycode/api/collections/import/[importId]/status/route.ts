import { NextRequest } from 'next/server';
import { getImportById } from '@/lib/repositories/collectionImportRepository';
import { noCache } from '@/lib/api-response';
import { getErrorMessage } from '@/lib/csv-utils';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /ycode/api/collections/import/[importId]/status
 * Get the current status of an import job
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ importId: string }> }
) {
  try {
    const { importId } = await params;

    const importJob = await getImportById(importId);

    if (!importJob) {
      return noCache(
        { error: 'Import job not found' },
        404
      );
    }

    return noCache({
      data: {
        id: importJob.id,
        collectionId: importJob.collection_id,
        status: importJob.status,
        totalRows: importJob.total_rows,
        processedRows: importJob.processed_rows,
        failedRows: importJob.failed_rows,
        errors: importJob.errors?.slice(-20) || [], // Return last 20 errors
        createdAt: importJob.created_at,
        updatedAt: importJob.updated_at,
      }
    });
  } catch (error) {
    console.error('Error fetching import status:', error);
    return noCache(
      { error: getErrorMessage(error) },
      500
    );
  }
}
