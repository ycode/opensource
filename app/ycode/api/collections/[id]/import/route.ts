import { NextRequest } from 'next/server';
import { createImport } from '@/lib/repositories/collectionImportRepository';
import { getCollectionById } from '@/lib/repositories/collectionRepository';
import { noCache } from '@/lib/api-response';
import { getErrorMessage } from '@/lib/csv-utils';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /ycode/api/collections/[id]/import
 * Create a new CSV import job for a collection
 *
 * Body:
 *  - columnMapping: Record<string, string> - Maps CSV column names to field IDs
 *  - csvData: Record<string, string>[] - Parsed CSV rows
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify collection exists
    const collection = await getCollectionById(id, false);
    if (!collection) {
      return noCache(
        { error: 'Collection not found' },
        404
      );
    }

    const body = await request.json();
    const { columnMapping, csvData } = body;

    // Validate required fields
    if (!columnMapping || typeof columnMapping !== 'object') {
      return noCache(
        { error: 'Column mapping is required' },
        400
      );
    }

    if (!csvData || !Array.isArray(csvData) || csvData.length === 0) {
      return noCache(
        { error: 'CSV data is required and must not be empty' },
        400
      );
    }

    // Create import job
    const importJob = await createImport({
      collection_id: id,
      column_mapping: columnMapping,
      csv_data: csvData,
      total_rows: csvData.length,
    });

    return noCache(
      { data: { importId: importJob.id } },
      201
    );
  } catch (error) {
    console.error('Error creating import job:', error);
    return noCache(
      { error: getErrorMessage(error) },
      500
    );
  }
}
