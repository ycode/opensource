import { NextRequest } from 'next/server';
import {
  getPendingImports,
  getImportById,
  updateImportStatus,
  updateImportProgress,
  completeImport,
} from '@/lib/repositories/collectionImportRepository';
import { createItemsBulk, getMaxIdValue } from '@/lib/repositories/collectionItemRepository';
import { insertValuesBulk } from '@/lib/repositories/collectionItemValueRepository';
import { getFieldsByCollectionId } from '@/lib/repositories/collectionFieldRepository';
import {
  convertValueForFieldType,
  SKIP_COLUMN,
  AUTO_FIELD_KEYS,
  truncateValue,
  getErrorMessage,
  isAssetFieldType,
  isValidUrl,
} from '@/lib/csv-utils';
import { uploadFile } from '@/lib/file-upload';
import { noCache } from '@/lib/api-response';
import { randomUUID } from 'crypto';
import type { CollectionField } from '@/types';

/**
 * Download a file from a URL and upload it to the asset manager
 * Returns the asset ID if successful, null otherwise
 */
async function downloadAndUploadAsset(
  url: string,
  fieldType: string
): Promise<string | null> {
  try {
    // Fetch the file from the URL
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'YCode-CSV-Import/1.0',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch asset from URL: ${url}, status: ${response.status}`);
      return null;
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const blob = await response.blob();

    // Extract filename from URL or generate one
    let filename = 'imported-file';
    try {
      const urlPath = new URL(url).pathname;
      const urlFilename = urlPath.split('/').pop();
      if (urlFilename && urlFilename.includes('.')) {
        filename = urlFilename;
      } else {
        // Generate filename based on content type
        const ext = contentType.split('/')[1]?.split(';')[0] || 'bin';
        filename = `imported-${Date.now()}.${ext}`;
      }
    } catch {
      // Keep default filename
    }

    // Create a File object from the blob
    const file = new File([blob], filename, { type: contentType });

    // Upload to asset manager
    const asset = await uploadFile(file, 'csv-import');

    if (!asset) {
      console.error(`Failed to upload asset from URL: ${url}`);
      return null;
    }

    return asset.id;
  } catch (error) {
    console.error(`Error downloading/uploading asset from URL: ${url}`, error);
    return null;
  }
}

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const BATCH_SIZE = 50;

interface PreparedValue {
  item_id: string;
  field_id: string;
  value: string | null;
  is_published: boolean;
}

interface PendingAssetValue {
  index: number; // Index in the values array
  url: string;
  fieldType: string;
}

interface PreparedRow {
  rowNumber: number;
  itemId: string;
  item: { id: string; collection_id: string; manual_order: number; is_published: boolean };
  values: PreparedValue[];
  pendingAssets: PendingAssetValue[]; // Asset URLs that need to be downloaded
}

/**
 * Prepare a single CSV row into item + values, collecting conversion warnings.
 * Pure data transformation — no DB calls.
 * Asset fields are marked as pending for async download/upload.
 */
function prepareRow(
  row: Record<string, string>,
  rowNumber: number,
  collectionId: string,
  columnMapping: Record<string, string>,
  fieldMap: Map<string, CollectionField>,
  autoFields: { idField?: CollectionField; createdAtField?: CollectionField; updatedAtField?: CollectionField },
  currentMaxId: number,
  now: string,
  warnings: string[]
): { prepared: PreparedRow; newMaxId: number } {
  const itemId = randomUUID();
  let maxId = currentMaxId;

  const values: PreparedValue[] = [];
  const pendingAssets: PendingAssetValue[] = [];

  // Auto-generated fields
  if (autoFields.idField) {
    maxId++;
    values.push({ item_id: itemId, field_id: autoFields.idField.id, value: String(maxId), is_published: false });
  }
  if (autoFields.createdAtField) {
    values.push({ item_id: itemId, field_id: autoFields.createdAtField.id, value: now, is_published: false });
  }
  if (autoFields.updatedAtField) {
    values.push({ item_id: itemId, field_id: autoFields.updatedAtField.id, value: now, is_published: false });
  }

  // Map CSV columns to field values
  for (const [csvColumn, fieldId] of Object.entries(columnMapping)) {
    if (!fieldId || fieldId === '' || fieldId === SKIP_COLUMN) continue;

    const field = fieldMap.get(fieldId);
    if (!field) continue;

    const rawValue = row[csvColumn] || '';
    const trimmedValue = rawValue.trim();

    // Handle asset fields (image, video, audio, document)
    if (isAssetFieldType(field.type) && trimmedValue && isValidUrl(trimmedValue)) {
      // Mark as pending asset to be downloaded
      const valueIndex = values.length;
      values.push({ item_id: itemId, field_id: fieldId, value: null, is_published: false });
      pendingAssets.push({
        index: valueIndex,
        url: trimmedValue,
        fieldType: field.type,
      });
      continue;
    }

    // Regular field conversion
    const convertedValue = convertValueForFieldType(rawValue, field.type);

    if (convertedValue !== null) {
      values.push({ item_id: itemId, field_id: fieldId, value: convertedValue, is_published: false });
    } else if (trimmedValue !== '') {
      // Non-empty value could not be converted — warn the user
      warnings.push(
        `Row ${rowNumber}, column "${csvColumn}": value "${truncateValue(rawValue)}" is not a valid ${field.type} for field "${field.name}", skipped`
      );
    }
  }

  return {
    prepared: {
      rowNumber,
      itemId,
      item: { id: itemId, collection_id: collectionId, manual_order: rowNumber - 1, is_published: false },
      values,
      pendingAssets,
    },
    newMaxId: maxId,
  };
}

/**
 * Fallback: insert rows one by one to pinpoint which row(s) caused the DB error.
 * Only called when the bulk insert fails.
 */
async function insertRowByRow(
  preparedRows: PreparedRow[],
  errors: string[]
): Promise<{ succeeded: number; failed: number }> {
  let succeeded = 0;
  let failed = 0;

  for (const row of preparedRows) {
    try {
      await createItemsBulk([row.item]);

      if (row.values.length > 0) {
        await insertValuesBulk(row.values);
      }

      succeeded++;
    } catch (error) {
      failed++;
      errors.push(`Row ${row.rowNumber}: DB insert failed — ${getErrorMessage(error)}`);
    }
  }

  return { succeeded, failed };
}

/**
 * POST /ycode/api/collections/import/process
 * Process pending import jobs in batches.
 * Uses bulk INSERT operations to minimize DB round-trips,
 * with row-by-row fallback for precise error identification.
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

    // Re-fetch to get the latest processed_rows value (prevents race conditions)
    const freshImportJob = await getImportById(importJob.id);
    if (!freshImportJob || freshImportJob.status === 'completed' || freshImportJob.status === 'failed') {
      return noCache({
        data: {
          importId: importJob.id,
          status: freshImportJob?.status || 'unknown',
          message: 'Import state changed'
        }
      });
    }
    // Use the fresh data
    importJob = freshImportJob;

    // Get collection fields (1 query, reused for all rows)
    const fields = await getFieldsByCollectionId(importJob.collection_id, false);
    const fieldMap = new Map(fields.map(f => [f.id, f]));

    // Find auto-generated fields
    const autoFields = {
      idField: fields.find(f => f.key === AUTO_FIELD_KEYS[0]),
      createdAtField: fields.find(f => f.key === AUTO_FIELD_KEYS[1]),
      updatedAtField: fields.find(f => f.key === AUTO_FIELD_KEYS[2]),
    };

    // Get max ID for auto-increment (1 query)
    let currentMaxId = await getMaxIdValue(importJob.collection_id, false);

    // Calculate which rows to process
    const startIndex = importJob.processed_rows;
    const endIndex = Math.min(startIndex + BATCH_SIZE, importJob.total_rows);
    const rowsToProcess = importJob.csv_data.slice(startIndex, endIndex);

    const errors: string[] = [...(importJob.errors || [])];
    let processedCount = importJob.processed_rows;
    let failedCount = importJob.failed_rows;

    // --- Phase 1: Prepare all rows in memory (no DB calls) ---
    const now = new Date().toISOString();
    const preparedRows: PreparedRow[] = [];

    for (let i = 0; i < rowsToProcess.length; i++) {
      const row = rowsToProcess[i];
      const rowNumber = startIndex + i + 1;

      try {
        const { prepared, newMaxId } = prepareRow(
          row, rowNumber, importJob.collection_id,
          importJob.column_mapping, fieldMap, autoFields,
          currentMaxId, now, errors
        );
        currentMaxId = newMaxId;
        preparedRows.push(prepared);
      } catch (error) {
        failedCount++;
        errors.push(`Row ${rowNumber}: failed to prepare — ${getErrorMessage(error)}`);
      }
    }

    // --- Phase 1.5: Process pending assets in parallel (download URLs and upload to asset manager) ---
    // Collect all pending assets with their row context
    const allPendingAssets: Array<{
      row: PreparedRow;
      asset: PendingAssetValue;
    }> = [];

    for (const row of preparedRows) {
      for (const asset of row.pendingAssets) {
        allPendingAssets.push({ row, asset });
      }
    }

    if (allPendingAssets.length > 0) {
      // Process assets in parallel with concurrency limit
      const ASSET_CONCURRENCY = 5;
      for (let i = 0; i < allPendingAssets.length; i += ASSET_CONCURRENCY) {
        const batch = allPendingAssets.slice(i, i + ASSET_CONCURRENCY);

        const results = await Promise.allSettled(
          batch.map(async ({ row, asset }) => {
            const assetId = await downloadAndUploadAsset(asset.url, asset.fieldType);
            return { row, asset, assetId };
          })
        );

        // Process results
        for (const result of results) {
          if (result.status === 'fulfilled') {
            const { row, asset, assetId } = result.value;
            if (assetId) {
              row.values[asset.index].value = assetId;
            } else {
              errors.push(
                `Row ${row.rowNumber}: failed to import ${asset.fieldType} from URL "${truncateValue(asset.url)}", skipped`
              );
            }
          } else {
            // Promise rejected - find the corresponding asset info from the batch
            const batchIndex = results.indexOf(result);
            const { row, asset } = batch[batchIndex];
            errors.push(
              `Row ${row.rowNumber}: error importing ${asset.fieldType} from URL "${truncateValue(asset.url)}" — ${getErrorMessage(result.reason)}`
            );
          }
        }
      }
    }

    // --- Phase 2: Bulk insert, with row-by-row fallback on failure ---
    if (preparedRows.length > 0) {
      try {
        // Bulk insert items (1 query)
        await createItemsBulk(preparedRows.map(r => r.item));

        // Bulk insert values (1 query)
        const allValues = preparedRows.flatMap(r => r.values);
        if (allValues.length > 0) {
          await insertValuesBulk(allValues);
        }

        processedCount += preparedRows.length;
      } catch (bulkError) {
        // Bulk failed — fall back to row-by-row to identify the culprit(s)
        console.error('Bulk insert failed, falling back to row-by-row:', bulkError);

        const { succeeded, failed } = await insertRowByRow(preparedRows, errors);
        processedCount += succeeded;
        failedCount += failed;
      }
    }

    // Cap stored errors to prevent huge payloads
    if (errors.length > 100) {
      errors.splice(50, errors.length - 100);
      if (!errors.includes('...some errors omitted...')) {
        errors.splice(50, 0, '...some errors omitted...');
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
      { error: getErrorMessage(error) },
      500
    );
  }
}
