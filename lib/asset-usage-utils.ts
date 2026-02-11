/**
 * Asset Usage Utilities
 *
 * Functions to find and count asset usage across pages, components, and CMS items
 */

import { getSupabaseAdmin } from '@/lib/supabase-server';
import type { Layer } from '@/types';
import { findDisplayField } from './collection-field-utils';

export interface AssetUsageEntry {
  id: string;
  name: string;
}

export interface CmsItemUsageEntry extends AssetUsageEntry {
  collectionId: string;
  collectionName: string;
}

export interface AssetUsageResult {
  pages: AssetUsageEntry[];
  components: AssetUsageEntry[];
  cmsItems: CmsItemUsageEntry[];
  total: number;
}

/**
 * Check if a variable contains an asset reference with the given ID
 */
function isAssetVarWithId(
  v: any,
  assetId: string
): boolean {
  return v?.type === 'asset' && v?.data?.asset_id === assetId;
}

/**
 * Check if a link variable contains an asset reference with the given ID
 */
function linkHasAssetId(link: any, assetId: string): boolean {
  return link?.asset?.id === assetId;
}

/**
 * Scan rich text content for asset references
 */
function richTextContainsAsset(content: any, assetId: string): boolean {
  if (!content || typeof content !== 'object') return false;

  // Check marks for richTextLink with asset
  if (Array.isArray(content.marks)) {
    for (const mark of content.marks) {
      if (mark.type === 'richTextLink' && mark.attrs?.asset?.id === assetId) {
        return true;
      }
    }
  }

  // Recurse into content arrays
  if (Array.isArray(content.content)) {
    for (const child of content.content) {
      if (richTextContainsAsset(child, assetId)) return true;
    }
  }
  if (Array.isArray(content)) {
    for (const child of content) {
      if (richTextContainsAsset(child, assetId)) return true;
    }
  }

  return false;
}

/**
 * Check if a layer contains a reference to a specific asset
 */
function layerContainsAsset(layer: Layer, assetId: string): boolean {
  // Image source
  if (isAssetVarWithId(layer.variables?.image?.src, assetId)) return true;

  // Video source and poster
  if (isAssetVarWithId(layer.variables?.video?.src, assetId)) return true;
  if (isAssetVarWithId(layer.variables?.video?.poster, assetId)) return true;

  // Audio source
  if (isAssetVarWithId(layer.variables?.audio?.src, assetId)) return true;

  // Icon source
  if (isAssetVarWithId(layer.variables?.icon?.src, assetId)) return true;

  // Direct asset link
  if (linkHasAssetId(layer.variables?.link, assetId)) return true;

  // Rich text links with asset type
  const textVar = layer.variables?.text;
  if (textVar?.type === 'dynamic_rich_text' && (textVar as any).data?.content) {
    if (richTextContainsAsset((textVar as any).data.content, assetId)) return true;
  }

  // Component variable overrides (image type)
  const imageOverrides = layer.componentOverrides?.image;
  if (imageOverrides) {
    for (const value of Object.values(imageOverrides)) {
      if (typeof value === 'string' && value === assetId) return true;
    }
  }

  return false;
}

/**
 * Recursively check if layers contain a reference to a specific asset
 */
function layersContainAsset(layers: Layer[], assetId: string): boolean {
  for (const layer of layers) {
    if (layerContainsAsset(layer, assetId)) return true;
    if (layer.children && layersContainAsset(layer.children, assetId)) return true;
  }
  return false;
}

/**
 * Check if page settings contain an asset reference
 */
function pageSettingsContainAsset(settings: any, assetId: string): boolean {
  // Check SEO image
  if (settings?.seo?.image === assetId) return true;
  return false;
}

/**
 * Get asset usage with names across pages, components, and CMS items
 */
export async function getAssetUsage(assetId: string): Promise<AssetUsageResult> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const pageEntries: AssetUsageEntry[] = [];
  const componentEntries: AssetUsageEntry[] = [];
  const cmsItemEntries: CmsItemUsageEntry[] = [];

  // Track unique page IDs that use this asset
  const pageIdsWithAsset = new Set<string>();

  // Check page layers (draft versions)
  const { data: pageLayersRecords, error: pageLayersError } = await client
    .from('page_layers')
    .select('id, page_id, layers')
    .eq('is_published', false)
    .is('deleted_at', null);

  if (pageLayersError) {
    throw new Error(`Failed to fetch page layers: ${pageLayersError.message}`);
  }

  for (const record of pageLayersRecords || []) {
    if (record.layers && layersContainAsset(record.layers, assetId)) {
      pageIdsWithAsset.add(record.page_id);
    }
  }

  // Check page settings for SEO images
  const { data: pagesData, error: pagesError } = await client
    .from('pages')
    .select('id, name, settings')
    .eq('is_published', false)
    .is('deleted_at', null);

  if (pagesError) {
    throw new Error(`Failed to fetch pages: ${pagesError.message}`);
  }

  for (const page of pagesData || []) {
    if (page.settings && pageSettingsContainAsset(page.settings, assetId)) {
      pageIdsWithAsset.add(page.id);
    }
  }

  // Build page entries with names
  const pageIds = Array.from(pageIdsWithAsset);
  const pagesWithAsset = (pagesData || []).filter((p) => pageIds.includes(p.id));
  for (const pageId of pageIds) {
    const page = pagesWithAsset.find((p) => p.id === pageId);
    pageEntries.push({ id: pageId, name: page?.name ?? 'Unknown Page' });
  }

  // Check components (draft versions)
  const { data: components, error: componentsError } = await client
    .from('components')
    .select('id, name, layers')
    .eq('is_published', false)
    .is('deleted_at', null);

  if (componentsError) {
    throw new Error(`Failed to fetch components: ${componentsError.message}`);
  }

  for (const component of components || []) {
    if (component.layers && layersContainAsset(component.layers, assetId)) {
      componentEntries.push({ id: component.id, name: component.name ?? 'Unknown Component' });
    }
  }

  // Check CMS collection item values (image/file fields)
  const { data: imageFields, error: fieldsError } = await client
    .from('collection_fields')
    .select('id, collection_id')
    .in('type', ['image', 'file'])
    .eq('is_published', false)
    .is('deleted_at', null);

  if (fieldsError) {
    throw new Error(`Failed to fetch collection fields: ${fieldsError.message}`);
  }

  if (imageFields && imageFields.length > 0) {
    const fieldIds = imageFields.map((f) => f.id);

    const { data: itemValues, error: valuesError } = await client
      .from('collection_item_values')
      .select('item_id')
      .in('field_id', fieldIds)
      .eq('value', assetId)
      .eq('is_published', false)
      .is('deleted_at', null);

    if (valuesError) {
      throw new Error(`Failed to fetch item values: ${valuesError.message}`);
    }

    const uniqueItemIds = [...new Set(itemValues?.map((v) => v.item_id) || [])];
    if (uniqueItemIds.length > 0) {
      // Get items with collection_id
      const { data: items, error: itemsError } = await client
        .from('collection_items')
        .select('id, collection_id')
        .in('id', uniqueItemIds)
        .eq('is_published', false)
        .is('deleted_at', null);

      if (itemsError) {
        throw new Error(`Failed to fetch collection items: ${itemsError.message}`);
      }

      const collectionIds = [...new Set((items || []).map((i) => i.collection_id))];

      // Get collection names
      const { data: collections, error: collectionsError } = await client
        .from('collections')
        .select('id, name')
        .in('id', collectionIds)
        .eq('is_published', false)
        .is('deleted_at', null);

      if (collectionsError) {
        throw new Error(`Failed to fetch collections: ${collectionsError.message}`);
      }

      const collectionNamesById: Record<string, string> = {};
      (collections || []).forEach((c: any) => {
        collectionNamesById[c.id] = c.name ?? 'Unknown Collection';
      });

      // Get fields for display name (key=name, title, or first text field)
      const { data: allFields, error: allFieldsError } = await client
        .from('collection_fields')
        .select('id, key, type, fillable, collection_id')
        .in('collection_id', collectionIds)
        .eq('is_published', false)
        .is('deleted_at', null);

      if (allFieldsError) {
        throw new Error(`Failed to fetch collection fields: ${allFieldsError.message}`);
      }

      // Find display field per collection
      const displayFieldByCollection: Record<string, { id: string }> = {};
      for (const collectionId of collectionIds) {
        const fields = (allFields || []).filter((f) => f.collection_id === collectionId);
        const displayField = findDisplayField(fields as any);
        if (displayField) {
          displayFieldByCollection[collectionId] = { id: displayField.id };
        }
      }

      // Get values for display fields
      const displayFieldIds = Object.values(displayFieldByCollection).map((f) => f.id);
      const { data: displayValues, error: displayValuesError } = await client
        .from('collection_item_values')
        .select('item_id, field_id, value')
        .in('item_id', uniqueItemIds)
        .in('field_id', displayFieldIds)
        .eq('is_published', false)
        .is('deleted_at', null);

      if (displayValuesError) {
        throw new Error(`Failed to fetch display values: ${displayValuesError.message}`);
      }

      const valueByItem: Record<string, string> = {};
      displayValues?.forEach((row: any) => {
        valueByItem[`${row.item_id}:${row.field_id}`] = row.value ?? '';
      });

      for (const item of items || []) {
        const displayField = displayFieldByCollection[item.collection_id];
        const name =
          displayField && valueByItem[`${item.id}:${displayField.id}`]
            ? valueByItem[`${item.id}:${displayField.id}`]
            : 'Untitled';
        const collectionName = collectionNamesById[item.collection_id] ?? 'Unknown Collection';
        cmsItemEntries.push({ id: item.id, name, collectionId: item.collection_id, collectionName });
      }
    }
  }

  return {
    pages: pageEntries,
    components: componentEntries,
    cmsItems: cmsItemEntries,
    total: pageEntries.length + componentEntries.length + cmsItemEntries.length,
  };
}

/**
 * Get bulk asset usage for multiple assets
 * More efficient than calling getAssetUsage multiple times
 */
export async function getBulkAssetUsage(
  assetIds: string[]
): Promise<Record<string, AssetUsageResult>> {
  if (assetIds.length === 0) {
    return {};
  }

  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  // Initialize results
  const results: Record<string, AssetUsageResult> = {};
  for (const assetId of assetIds) {
    results[assetId] = { pages: [], components: [], cmsItems: [], total: 0 };
  }

  // Create a set for faster lookup
  const assetIdSet = new Set(assetIds);

  // Check page layers
  const { data: pageLayersRecords, error: pageLayersError } = await client
    .from('page_layers')
    .select('id, page_id, layers')
    .eq('is_published', false)
    .is('deleted_at', null);

  if (pageLayersError) {
    throw new Error(`Failed to fetch page layers: ${pageLayersError.message}`);
  }

  // Track page IDs per asset
  const pageIdsByAsset: Record<string, Set<string>> = {};
  for (const assetId of assetIds) {
    pageIdsByAsset[assetId] = new Set();
  }

  for (const record of pageLayersRecords || []) {
    if (!record.layers) continue;

    for (const assetId of assetIds) {
      if (layersContainAsset(record.layers, assetId)) {
        pageIdsByAsset[assetId].add(record.page_id);
      }
    }
  }

  // Check page settings
  const { data: pages, error: pagesError } = await client
    .from('pages')
    .select('id, settings')
    .eq('is_published', false)
    .is('deleted_at', null);

  if (pagesError) {
    throw new Error(`Failed to fetch pages: ${pagesError.message}`);
  }

  for (const page of pages || []) {
    if (!page.settings) continue;

    for (const assetId of assetIds) {
      if (pageSettingsContainAsset(page.settings, assetId)) {
        pageIdsByAsset[assetId].add(page.id);
      }
    }
  }

  // Get page names
  const pageIds = [...new Set(assetIds.flatMap((id) => [...pageIdsByAsset[id]]))];
  let pageNamesById: Record<string, string> = {};
  if (pageIds.length > 0) {
    const { data: pagesWithNames } = await client
      .from('pages')
      .select('id, name')
      .in('id', pageIds)
      .eq('is_published', false);
    pageNamesById = (pagesWithNames || []).reduce((acc, p) => ({ ...acc, [p.id]: p.name ?? 'Unknown Page' }), {});
  }

  for (const assetId of assetIds) {
    results[assetId].pages = [...pageIdsByAsset[assetId]].map((id) => ({
      id,
      name: pageNamesById[id] ?? 'Unknown Page',
    }));
  }

  // Check components
  const { data: components, error: componentsError } = await client
    .from('components')
    .select('id, name, layers')
    .eq('is_published', false)
    .is('deleted_at', null);

  if (componentsError) {
    throw new Error(`Failed to fetch components: ${componentsError.message}`);
  }

  for (const component of components || []) {
    if (!component.layers) continue;

    for (const assetId of assetIds) {
      if (layersContainAsset(component.layers, assetId)) {
        results[assetId].components.push({ id: component.id, name: component.name ?? 'Unknown Component' });
      }
    }
  }

  // Check CMS items
  const { data: imageFields, error: fieldsError } = await client
    .from('collection_fields')
    .select('id')
    .in('type', ['image', 'file'])
    .eq('is_published', false)
    .is('deleted_at', null);

  if (fieldsError) {
    throw new Error(`Failed to fetch collection fields: ${fieldsError.message}`);
  }

  if (imageFields && imageFields.length > 0) {
    const fieldIds = imageFields.map((f) => f.id);

    const { data: itemValues, error: valuesError } = await client
      .from('collection_item_values')
      .select('item_id, value')
      .in('field_id', fieldIds)
      .in('value', assetIds)
      .eq('is_published', false)
      .is('deleted_at', null);

    if (valuesError) {
      throw new Error(`Failed to fetch item values: ${valuesError.message}`);
    }

    const itemIdsByAsset: Record<string, Set<string>> = {};
    for (const assetId of assetIds) {
      itemIdsByAsset[assetId] = new Set();
    }

    for (const v of itemValues || []) {
      if (v.value && assetIdSet.has(v.value)) {
        itemIdsByAsset[v.value].add(v.item_id);
      }
    }

    const uniqueItemIds = [...new Set(Object.values(itemIdsByAsset).flatMap((s) => [...s]))];
    const collectionNamesById: Record<string, string> = {};
    const itemCollectionById: Record<string, string> = {};

    if (uniqueItemIds.length > 0) {
      const { data: items } = await client
        .from('collection_items')
        .select('id, collection_id')
        .in('id', uniqueItemIds)
        .eq('is_published', false)
        .is('deleted_at', null);

      (items || []).forEach((i: any) => {
        itemCollectionById[i.id] = i.collection_id;
      });

      const collectionIds = [...new Set(Object.values(itemCollectionById))];
      if (collectionIds.length > 0) {
        const { data: collections } = await client
          .from('collections')
          .select('id, name')
          .in('id', collectionIds)
          .eq('is_published', false)
          .is('deleted_at', null);

        (collections || []).forEach((c: any) => {
          collectionNamesById[c.id] = c.name ?? 'Unknown Collection';
        });
      }
    }

    for (const assetId of assetIds) {
      results[assetId].cmsItems = [...itemIdsByAsset[assetId]].map((id) => {
        const collectionId = itemCollectionById[id] ?? '';
        return {
          id,
          name: 'Untitled',
          collectionId,
          collectionName: collectionNamesById[collectionId] ?? 'Unknown Collection',
        };
      });
    }
  }

  for (const assetId of assetIds) {
    const r = results[assetId];
    r.total = r.pages.length + r.components.length + r.cmsItems.length;
  }

  return results;
}

// =============================================================================
// Asset Cleanup Functions
// =============================================================================

/**
 * Remove asset references from rich text content
 */
function removeAssetFromRichText(content: any, assetId: string): any {
  if (!content || typeof content !== 'object') return content;

  // Clone the content to avoid mutation
  const cloned = JSON.parse(JSON.stringify(content));

  const processNode = (node: any): any => {
    if (!node || typeof node !== 'object') return node;

    // Remove richTextLink marks with matching asset
    if (Array.isArray(node.marks)) {
      node.marks = node.marks.filter((mark: any) => {
        if (mark.type === 'richTextLink' && mark.attrs?.asset?.id === assetId) {
          return false; // Remove this mark
        }
        return true;
      });
    }

    // Recurse into content arrays
    if (Array.isArray(node.content)) {
      node.content = node.content.map(processNode);
    }

    return node;
  };

  if (Array.isArray(cloned)) {
    return cloned.map(processNode);
  }

  return processNode(cloned);
}

/**
 * Remove asset references from a single layer
 * Returns a new layer object with asset references nullified
 */
function removeAssetFromLayer(layer: Layer, assetId: string): Layer {
  const newLayer = JSON.parse(JSON.stringify(layer)) as Layer;

  // Image source
  if (isAssetVarWithId(newLayer.variables?.image?.src, assetId)) {
    (newLayer.variables!.image!.src as any).data.asset_id = null;
  }

  // Video source
  if (isAssetVarWithId(newLayer.variables?.video?.src, assetId)) {
    (newLayer.variables!.video!.src as any).data.asset_id = null;
  }

  // Video poster
  if (isAssetVarWithId(newLayer.variables?.video?.poster, assetId)) {
    (newLayer.variables!.video!.poster as any).data.asset_id = null;
  }

  // Audio source
  if (isAssetVarWithId(newLayer.variables?.audio?.src, assetId)) {
    (newLayer.variables!.audio!.src as any).data.asset_id = null;
  }

  // Icon source
  if (isAssetVarWithId(newLayer.variables?.icon?.src, assetId)) {
    (newLayer.variables!.icon!.src as any).data.asset_id = null;
  }

  // Link asset
  if (linkHasAssetId(newLayer.variables?.link, assetId)) {
    newLayer.variables!.link!.asset = { id: null };
  }

  // Rich text content
  const textVar = newLayer.variables?.text;
  if (textVar?.type === 'dynamic_rich_text' && (textVar as any).data?.content) {
    (textVar as any).data.content = removeAssetFromRichText((textVar as any).data.content, assetId);
  }

  // Component variable overrides (image type)
  if (newLayer.componentOverrides?.image) {
    const imageOverrides = newLayer.componentOverrides.image as Record<string, string>;
    for (const [key, value] of Object.entries(imageOverrides)) {
      if (value === assetId) {
        delete imageOverrides[key];
      }
    }
  }

  return newLayer;
}

/**
 * Recursively remove asset references from layers
 * Returns new layers array with asset references nullified
 */
function removeAssetFromLayers(layers: Layer[], assetId: string): Layer[] {
  return layers.map((layer) => {
    const newLayer = removeAssetFromLayer(layer, assetId);

    if (newLayer.children && newLayer.children.length > 0) {
      newLayer.children = removeAssetFromLayers(newLayer.children, assetId);
    }

    return newLayer;
  });
}

export interface AffectedPageEntity {
  pageId: string;
  previousLayers: Layer[];
  newLayers: Layer[];
}

export interface AffectedComponentEntity {
  componentId: string;
  previousLayers: Layer[];
  newLayers: Layer[];
}

export interface AssetCleanupResult {
  pagesUpdated: number;
  componentsUpdated: number;
  cmsItemsUpdated: number;
  affectedPages: AffectedPageEntity[];
  affectedComponents: AffectedComponentEntity[];
}

/**
 * Clean up all references to an asset before deletion
 * Updates pages, components, and CMS items to remove the asset reference
 * Returns affected entities with before/after states for version tracking
 */
export async function cleanupAssetReferences(assetId: string): Promise<AssetCleanupResult> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  let pagesUpdated = 0;
  let componentsUpdated = 0;
  let cmsItemsUpdated = 0;
  const affectedPages: AffectedPageEntity[] = [];
  const affectedComponents: AffectedComponentEntity[] = [];

  // 1. Update page layers (draft versions)
  const { data: pageLayersRecords, error: pageLayersError } = await client
    .from('page_layers')
    .select('id, page_id, layers')
    .eq('is_published', false)
    .is('deleted_at', null);

  if (pageLayersError) {
    throw new Error(`Failed to fetch page layers: ${pageLayersError.message}`);
  }

  const pageLayersToUpdate: Array<{ id: string; pageId: string; previousLayers: Layer[]; newLayers: Layer[] }> = [];

  for (const record of pageLayersRecords || []) {
    if (record.layers && layersContainAsset(record.layers, assetId)) {
      const cleanedLayers = removeAssetFromLayers(record.layers, assetId);
      pageLayersToUpdate.push({
        id: record.id,
        pageId: record.page_id,
        previousLayers: record.layers,
        newLayers: cleanedLayers,
      });
    }
  }

  // Batch update page layers
  if (pageLayersToUpdate.length > 0) {
    for (const { id, pageId, previousLayers, newLayers } of pageLayersToUpdate) {
      const { error } = await client
        .from('page_layers')
        .update({ layers: newLayers, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('is_published', false);

      if (error) {
        console.error(`Failed to update page_layers ${id}:`, error);
      } else {
        pagesUpdated++;
        affectedPages.push({ pageId, previousLayers, newLayers });
      }
    }
  }

  // 2. Update page settings (SEO images)
  const { data: pagesData, error: pagesError } = await client
    .from('pages')
    .select('id, settings')
    .eq('is_published', false)
    .is('deleted_at', null);

  if (pagesError) {
    throw new Error(`Failed to fetch pages: ${pagesError.message}`);
  }

  const pagesToUpdate: Array<{ id: string; settings: any }> = [];

  for (const page of pagesData || []) {
    if (pageSettingsContainAsset(page.settings, assetId)) {
      const newSettings = JSON.parse(JSON.stringify(page.settings));
      if (newSettings.seo?.image === assetId) {
        newSettings.seo.image = null;
      }
      pagesToUpdate.push({ id: page.id, settings: newSettings });
    }
  }

  // Batch update pages
  if (pagesToUpdate.length > 0) {
    for (const { id, settings } of pagesToUpdate) {
      const { error } = await client
        .from('pages')
        .update({ settings, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('is_published', false);

      if (error) {
        console.error(`Failed to update page ${id}:`, error);
      }
      // Note: page settings changes don't need layer version tracking
    }
  }

  // 3. Update components (draft versions)
  const { data: components, error: componentsError } = await client
    .from('components')
    .select('id, layers')
    .eq('is_published', false)
    .is('deleted_at', null);

  if (componentsError) {
    throw new Error(`Failed to fetch components: ${componentsError.message}`);
  }

  const componentsToUpdate: Array<{ id: string; previousLayers: Layer[]; newLayers: Layer[] }> = [];

  for (const component of components || []) {
    if (component.layers && layersContainAsset(component.layers, assetId)) {
      const cleanedLayers = removeAssetFromLayers(component.layers, assetId);
      componentsToUpdate.push({
        id: component.id,
        previousLayers: component.layers,
        newLayers: cleanedLayers,
      });
    }
  }

  // Batch update components
  if (componentsToUpdate.length > 0) {
    for (const { id, previousLayers, newLayers } of componentsToUpdate) {
      const { error } = await client
        .from('components')
        .update({ layers: newLayers, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('is_published', false);

      if (error) {
        console.error(`Failed to update component ${id}:`, error);
      } else {
        componentsUpdated++;
        affectedComponents.push({ componentId: id, previousLayers, newLayers });
      }
    }
  }

  // 4. Update CMS collection item values (nullify asset references)
  const { data: imageFields, error: fieldsError } = await client
    .from('collection_fields')
    .select('id')
    .in('type', ['image', 'file'])
    .eq('is_published', false)
    .is('deleted_at', null);

  if (fieldsError) {
    throw new Error(`Failed to fetch collection fields: ${fieldsError.message}`);
  }

  if (imageFields && imageFields.length > 0) {
    const fieldIds = imageFields.map((f) => f.id);

    // Update all values that reference this asset to null
    const { data: updatedValues, error: updateError } = await client
      .from('collection_item_values')
      .update({ value: null, updated_at: new Date().toISOString() })
      .in('field_id', fieldIds)
      .eq('value', assetId)
      .eq('is_published', false)
      .is('deleted_at', null)
      .select('id');

    if (updateError) {
      console.error('Failed to update CMS values:', updateError);
    } else {
      cmsItemsUpdated = updatedValues?.length ?? 0;
    }
  }

  return {
    pagesUpdated,
    componentsUpdated,
    cmsItemsUpdated,
    affectedPages,
    affectedComponents,
  };
}
