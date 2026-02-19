/**
 * Collection & Field Usage Utilities
 *
 * Functions to detect where collections and collection fields are used
 * across pages, components, and other collections (reference fields).
 */

import { getSupabaseAdmin } from '@/lib/supabase-server';
import type { Layer, CollectionVariable, FieldVariable, DesignColorVariable } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UsageEntry {
  id: string;
  name: string;
}

export interface ReferenceFieldUsageEntry extends UsageEntry {
  collectionId: string;
  collectionName: string;
}

export interface CollectionUsageResult {
  pages: UsageEntry[];
  components: UsageEntry[];
  referenceFields: ReferenceFieldUsageEntry[];
  total: number;
}

export interface CollectionFieldUsageResult {
  pages: UsageEntry[];
  components: UsageEntry[];
  total: number;
}

// ---------------------------------------------------------------------------
// Layer scanning helpers
// ---------------------------------------------------------------------------

/** Extract collection variable from a layer */
function getCollectionVar(layer: Layer): CollectionVariable | null {
  return layer.variables?.collection ?? null;
}

/** Check if a layer's collection binding references the given collection ID */
function layerReferencesCollection(layer: Layer, collectionId: string): boolean {
  const cv = getCollectionVar(layer);
  if (cv?.id === collectionId) return true;

  // Page-level CMS binding is checked separately via page settings
  return false;
}

/** Recursively check if any layer references a collection */
function layersReferenceCollection(layers: Layer[], collectionId: string): boolean {
  for (const layer of layers) {
    if (layerReferencesCollection(layer, collectionId)) return true;
    if (layer.children && layersReferenceCollection(layer.children, collectionId)) return true;
  }
  return false;
}

/** Check if a variable is a FieldVariable referencing the given field ID */
function isFieldVarWithId(v: unknown, fieldId: string): boolean {
  if (!v || typeof v !== 'object') return false;
  const fv = v as FieldVariable;
  return fv.type === 'field' && fv.data?.field_id === fieldId;
}

/** Check if a layer's collection sort_by references the given field ID */
function collectionVarUsesField(layer: Layer, fieldId: string): boolean {
  const cv = getCollectionVar(layer);
  if (!cv) return false;

  if (cv.sort_by === fieldId) return true;
  if (cv.source_field_id === fieldId) return true;

  // Check collection filter conditions
  if (cv.filters?.groups) {
    for (const group of cv.filters.groups) {
      for (const condition of group.conditions) {
        if (condition.fieldId === fieldId) return true;
      }
    }
  }

  return false;
}

/** Check if a DesignColorVariable references a field ID (solid field or gradient stops) */
function designColorUsesField(dcv: DesignColorVariable | undefined, fieldId: string): boolean {
  if (!dcv) return false;
  if (isFieldVarWithId(dcv.field, fieldId)) return true;
  for (const stop of dcv.linear?.stops ?? []) {
    if (isFieldVarWithId(stop.field, fieldId)) return true;
  }
  for (const stop of dcv.radial?.stops ?? []) {
    if (isFieldVarWithId(stop.field, fieldId)) return true;
  }
  return false;
}

/** Recursively scan all field variable bindings in a layer's variables */
function layerFieldVarsContainId(layer: Layer, fieldId: string): boolean {
  const vars = layer.variables;
  if (!vars) return false;

  // Image src
  if (isFieldVarWithId(vars.image?.src, fieldId)) return true;
  // Image alt
  if (isFieldVarWithId(vars.image?.alt, fieldId)) return true;
  // Audio src
  if (isFieldVarWithId(vars.audio?.src, fieldId)) return true;
  // Video src / poster
  if (isFieldVarWithId(vars.video?.src, fieldId)) return true;
  if (isFieldVarWithId(vars.video?.poster, fieldId)) return true;
  // Background image src
  if (isFieldVarWithId(vars.backgroundImage?.src, fieldId)) return true;
  // Text variable
  if (isFieldVarWithId(vars.text, fieldId)) return true;
  // Link field
  if (isFieldVarWithId(vars.link?.field, fieldId)) return true;

  // Inline variables (dynamic text)
  const textVar = vars.text as Record<string, unknown> | undefined;
  if (textVar?.type === 'dynamic_text' || textVar?.type === 'dynamic_rich_text') {
    const data = textVar.data as Record<string, unknown> | undefined;
    if (data?.variables && Array.isArray(data.variables)) {
      for (const iv of data.variables) {
        if (isFieldVarWithId(iv, fieldId)) return true;
      }
    }
    if (data?.content) {
      if (richTextContainsFieldId(data.content, fieldId)) return true;
    }
  }

  // Design color variable field bindings (backgroundColor, color, borderColor, etc.)
  if (vars.design) {
    if (designColorUsesField(vars.design.backgroundColor, fieldId)) return true;
    if (designColorUsesField(vars.design.color, fieldId)) return true;
    if (designColorUsesField(vars.design.borderColor, fieldId)) return true;
    if (designColorUsesField(vars.design.divideColor, fieldId)) return true;
    if (designColorUsesField(vars.design.textDecorationColor, fieldId)) return true;
  }

  return false;
}

/** Scan rich text content for FieldVariable references */
function richTextContainsFieldId(content: unknown, fieldId: string): boolean {
  if (!content || typeof content !== 'object') return false;
  const node = content as Record<string, unknown>;

  // Check inline variable marks
  if (Array.isArray(node.marks)) {
    for (const mark of node.marks) {
      const m = mark as Record<string, unknown>;
      if (m.type === 'inlineVariable' && isFieldVarWithId(m.attrs, fieldId)) return true;
    }
  }

  // Recurse
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      if (richTextContainsFieldId(child, fieldId)) return true;
    }
  }
  if (Array.isArray(content)) {
    for (const child of content) {
      if (richTextContainsFieldId(child, fieldId)) return true;
    }
  }
  return false;
}

/** Check if a layer references a specific field (bindings + collection config) */
function layerReferencesField(layer: Layer, fieldId: string): boolean {
  if (collectionVarUsesField(layer, fieldId)) return true;
  if (layerFieldVarsContainId(layer, fieldId)) return true;
  return false;
}

/** Recursively check if layers reference a field */
function layersReferenceField(layers: Layer[], fieldId: string): boolean {
  for (const layer of layers) {
    if (layerReferencesField(layer, fieldId)) return true;
    if (layer.children && layersReferenceField(layer.children, fieldId)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get collection usage across pages, components, and reference fields
 */
export async function getCollectionUsage(collectionId: string): Promise<CollectionUsageResult> {
  const client = await getSupabaseAdmin();
  if (!client) throw new Error('Supabase not configured');

  const pages: UsageEntry[] = [];
  const components: UsageEntry[] = [];
  const referenceFields: ReferenceFieldUsageEntry[] = [];

  const pageIdsWithUsage = new Set<string>();

  // 1. Check page layers for collection bindings
  const { data: pageLayersRecords, error: plErr } = await client
    .from('page_layers')
    .select('page_id, layers')
    .eq('is_published', false)
    .is('deleted_at', null);

  if (plErr) throw new Error(`Failed to fetch page layers: ${plErr.message}`);

  for (const record of pageLayersRecords || []) {
    if (record.layers && layersReferenceCollection(record.layers, collectionId)) {
      pageIdsWithUsage.add(record.page_id);
    }
  }

  // 2. Check page-level CMS settings (collection pages)
  const { data: pagesData, error: pagesErr } = await client
    .from('pages')
    .select('id, name, settings')
    .eq('is_published', false)
    .is('deleted_at', null);

  if (pagesErr) throw new Error(`Failed to fetch pages: ${pagesErr.message}`);

  for (const page of pagesData || []) {
    if (page.settings?.cms?.collection_id === collectionId) {
      pageIdsWithUsage.add(page.id);
    }
  }

  // Build page entries with names
  for (const pageId of pageIdsWithUsage) {
    const page = (pagesData || []).find((p) => p.id === pageId);
    pages.push({ id: pageId, name: page?.name ?? 'Unknown Page' });
  }

  // 3. Check components
  const { data: componentsData, error: compErr } = await client
    .from('components')
    .select('id, name, layers')
    .eq('is_published', false)
    .is('deleted_at', null);

  if (compErr) throw new Error(`Failed to fetch components: ${compErr.message}`);

  for (const component of componentsData || []) {
    if (component.layers && layersReferenceCollection(component.layers, collectionId)) {
      components.push({ id: component.id, name: component.name ?? 'Unknown Component' });
    }
  }

  // 4. Check reference fields pointing to this collection
  const { data: refFields, error: rfErr } = await client
    .from('collection_fields')
    .select('id, name, collection_id')
    .eq('reference_collection_id', collectionId)
    .eq('is_published', false)
    .is('deleted_at', null);

  if (rfErr) throw new Error(`Failed to fetch reference fields: ${rfErr.message}`);

  if (refFields && refFields.length > 0) {
    const parentCollectionIds = [...new Set(refFields.map((f) => f.collection_id))];

    const { data: parentCollections, error: pcErr } = await client
      .from('collections')
      .select('id, name')
      .in('id', parentCollectionIds)
      .eq('is_published', false)
      .is('deleted_at', null);

    if (pcErr) throw new Error(`Failed to fetch collections: ${pcErr.message}`);

    const collectionNames: Record<string, string> = {};
    (parentCollections || []).forEach((c) => {
      collectionNames[c.id] = c.name ?? 'Unknown Collection';
    });

    for (const field of refFields) {
      referenceFields.push({
        id: field.id,
        name: field.name ?? 'Unknown Field',
        collectionId: field.collection_id,
        collectionName: collectionNames[field.collection_id] ?? 'Unknown Collection',
      });
    }
  }

  return {
    pages,
    components,
    referenceFields,
    total: pages.length + components.length + referenceFields.length,
  };
}

/**
 * Get collection field usage across pages and components (layer bindings)
 */
export async function getCollectionFieldUsage(fieldId: string): Promise<CollectionFieldUsageResult> {
  const client = await getSupabaseAdmin();
  if (!client) throw new Error('Supabase not configured');

  const pages: UsageEntry[] = [];
  const components: UsageEntry[] = [];

  const pageIdsWithUsage = new Set<string>();

  // 1. Check page layers for field bindings
  const { data: pageLayersRecords, error: plErr } = await client
    .from('page_layers')
    .select('page_id, layers')
    .eq('is_published', false)
    .is('deleted_at', null);

  if (plErr) throw new Error(`Failed to fetch page layers: ${plErr.message}`);

  for (const record of pageLayersRecords || []) {
    if (record.layers && layersReferenceField(record.layers, fieldId)) {
      pageIdsWithUsage.add(record.page_id);
    }
  }

  // 2. Check page-level CMS settings (slug field)
  const { data: pagesData, error: pagesErr } = await client
    .from('pages')
    .select('id, name, settings')
    .eq('is_published', false)
    .is('deleted_at', null);

  if (pagesErr) throw new Error(`Failed to fetch pages: ${pagesErr.message}`);

  for (const page of pagesData || []) {
    if (page.settings?.cms?.slug_field_id === fieldId) {
      pageIdsWithUsage.add(page.id);
    }
    // SEO image field binding
    const seoImage = page.settings?.seo?.image;
    if (seoImage && typeof seoImage === 'object' && (seoImage as FieldVariable).type === 'field') {
      if ((seoImage as FieldVariable).data?.field_id === fieldId) {
        pageIdsWithUsage.add(page.id);
      }
    }
  }

  // Build page entries
  for (const pageId of pageIdsWithUsage) {
    const page = (pagesData || []).find((p) => p.id === pageId);
    pages.push({ id: pageId, name: page?.name ?? 'Unknown Page' });
  }

  // 3. Check components
  const { data: componentsData, error: compErr } = await client
    .from('components')
    .select('id, name, layers')
    .eq('is_published', false)
    .is('deleted_at', null);

  if (compErr) throw new Error(`Failed to fetch components: ${compErr.message}`);

  for (const component of componentsData || []) {
    if (component.layers && layersReferenceField(component.layers, fieldId)) {
      components.push({ id: component.id, name: component.name ?? 'Unknown Component' });
    }
  }

  return {
    pages,
    components,
    total: pages.length + components.length,
  };
}
