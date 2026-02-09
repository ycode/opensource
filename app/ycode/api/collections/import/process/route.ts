import { NextRequest } from 'next/server';
import {
  getPendingImports,
  getImportById,
  updateImportStatus,
  updateImportProgress,
  completeImport,
} from '@/lib/repositories/collectionImportRepository';
import { createItem, getMaxIdValue } from '@/lib/repositories/collectionItemRepository';
import { setValuesByFieldName } from '@/lib/repositories/collectionItemValueRepository';
import { getFieldsByCollectionId } from '@/lib/repositories/collectionFieldRepository';
import { convertValueForFieldType } from '@/lib/csv-utils';
import { noCache } from '@/lib/api-response';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const BATCH_SIZE = 50;

/**
 * POST /ycode/api/collections/import/process
 * Process pending import jobs in batches
 *
 * Body (optional):
 *  - importId: string - Process specific import (otherwise processes next pending)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { importId } = body;

    let importJob;

    if (importId) {
      // Process specific import
      importJob = await getImportById(importId);
      if (!importJob) {
        return noCache(
          { error: 'Import job not found' },
          404
        );
      }
    } else {
      // Get next pending import
      const pendingImports = await getPendingImports(1);
      if (pendingImports.length === 0) {
        return noCache({
          data: { message: 'No pending imports' }
        });
      }
      importJob = pendingImports[0];
    }

    // Skip if already completed or failed
    if (importJob.status === 'completed' || importJob.status === 'failed') {
      return noCache({
        data: {
          importId: importJob.id,
          status: importJob.status,
          message: 'Import already finished'
        }
      });
    }

    // Mark as processing
    if (importJob.status === 'pending') {
      await updateImportStatus(importJob.id, 'processing');
    }

    // Get collection fields
    const fields = await getFieldsByCollectionId(importJob.collection_id, false);
    const fieldMap = new Map(fields.map(f => [f.id, f]));

    // Find auto-generated fields
    const idField = fields.find(f => f.key === 'id');
    const createdAtField = fields.find(f => f.key === 'created_at');
    const updatedAtField = fields.find(f => f.key === 'updated_at');

    // Get max ID for auto-increment
    let currentMaxId = await getMaxIdValue(importJob.collection_id, false);

    // Calculate which rows to process
    const startIndex = importJob.processed_rows;
    const endIndex = Math.min(startIndex + BATCH_SIZE, importJob.total_rows);
    const rowsToProcess = importJob.csv_data.slice(startIndex, endIndex);

    const errors: string[] = [...(importJob.errors || [])];
    let processedCount = importJob.processed_rows;
    let failedCount = importJob.failed_rows;

    // Process each row
    for (let i = 0; i < rowsToProcess.length; i++) {
      const row = rowsToProcess[i];
      const rowNumber = startIndex + i + 1; // 1-indexed for user display

      try {
        // Create new item
        const item = await createItem({
          collection_id: importJob.collection_id,
          manual_order: rowNumber - 1,
          is_published: false,
        });

        // Build values object
        const values: Record<string, string | null> = {};
        const now = new Date().toISOString();

        // Set auto-generated fields
        if (idField) {
          currentMaxId++;
          values[idField.id] = String(currentMaxId);
        }
        if (createdAtField) {
          values[createdAtField.id] = now;
        }
        if (updatedAtField) {
          values[updatedAtField.id] = now;
        }

        // Map CSV columns to field values
        for (const [csvColumn, fieldId] of Object.entries(importJob.column_mapping)) {
          if (!fieldId || fieldId === '' || fieldId === '__skip__') continue; // Skip unmapped columns

          const field = fieldMap.get(fieldId);
          if (!field) continue;

          const rawValue = row[csvColumn];
          const convertedValue = convertValueForFieldType(rawValue || '', field.type);

          if (convertedValue !== null) {
            values[fieldId] = convertedValue;
          }
        }

        // Save values
        await setValuesByFieldName(
          item.id,
          importJob.collection_id,
          values,
          {},
          false // Draft
        );

        processedCount++;
      } catch (error) {
        failedCount++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Row ${rowNumber}: ${errorMessage}`);

        // Limit stored errors to prevent huge payloads
        if (errors.length > 100) {
          errors.splice(50, errors.length - 100);
          if (!errors.includes('...some errors omitted...')) {
            errors.splice(50, 0, '...some errors omitted...');
          }
        }
      }
    }

    // Update progress
    await updateImportProgress(importJob.id, processedCount, failedCount, errors);

    // Check if complete
    const isComplete = processedCount + failedCount >= importJob.total_rows;

    if (isComplete) {
      await completeImport(importJob.id, processedCount, failedCount, errors);
    }

    return noCache({
      data: {
        importId: importJob.id,
        status: isComplete ? 'completed' : 'processing',
        totalRows: importJob.total_rows,
        processedRows: processedCount,
        failedRows: failedCount,
        isComplete,
        errors: errors.slice(-10), // Return last 10 errors for display
      }
    });
  } catch (error) {
    console.error('Error processing import:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to process import' },
      500
    );
  }
}
