import { NextRequest, NextResponse } from 'next/server';
import { bulkDeleteAssets, bulkUpdateAssets } from '@/lib/repositories/assetRepository';
import { noCache } from '@/lib/api-response';
import { cleanupAssetReferences, AffectedPageEntity, AffectedComponentEntity } from '@/lib/asset-usage-utils';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/assets/bulk
 *
 * Bulk operations on assets
 * Body:
 * - action: 'delete' | 'move'
 * - ids: string[] - Array of asset IDs
 * - asset_folder_id?: string | null - Target folder ID for move action
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ids, asset_folder_id } = body;

    if (!action || !Array.isArray(ids) || ids.length === 0) {
      return noCache(
        { error: 'Action and ids array are required' },
        400
      );
    }

    if (action === 'delete') {
      // Clean up references for all assets before deletion
      const cleanupPromises = ids.map((id: string) => cleanupAssetReferences(id));
      const cleanupResults = await Promise.all(cleanupPromises);

      // Aggregate affected entities (deduplicate by ID)
      const affectedPagesMap = new Map<string, AffectedPageEntity>();
      const affectedComponentsMap = new Map<string, AffectedComponentEntity>();

      for (const cleanup of cleanupResults) {
        for (const page of cleanup.affectedPages) {
          // Keep the latest newLayers for each page
          affectedPagesMap.set(page.pageId, page);
        }
        for (const component of cleanup.affectedComponents) {
          // Keep the latest newLayers for each component
          affectedComponentsMap.set(component.componentId, component);
        }
      }

      const result = await bulkDeleteAssets(ids);

      return noCache({
        data: {
          ...result,
          cleanup: {
            affectedPages: Array.from(affectedPagesMap.values()),
            affectedComponents: Array.from(affectedComponentsMap.values()),
          },
        },
      });
    }

    if (action === 'move') {
      if (asset_folder_id === undefined) {
        return noCache(
          { error: 'asset_folder_id is required for move action' },
          400
        );
      }

      const result = await bulkUpdateAssets(ids, { asset_folder_id });

      return noCache({
        data: result,
      });
    }

    return noCache(
      { error: 'Invalid action. Supported actions: delete, move' },
      400
    );
  } catch (error) {
    console.error('Bulk operation failed:', error);

    return noCache(
      { error: error instanceof Error ? error.message : 'Bulk operation failed' },
      500
    );
  }
}
