/**
 * Reference Field Resolver for API
 * 
 * Resolves reference and multi-reference fields by fetching the actual
 * referenced item data and returning it as nested objects/arrays.
 */

import { getItemWithValues } from '@/lib/repositories/collectionItemRepository';
import { getFieldsByCollectionId } from '@/lib/repositories/collectionFieldRepository';
import type { CollectionField } from '@/types';

/**
 * Resolved reference item structure
 */
export interface ResolvedItem {
  _id: string;
  [fieldName: string]: any;
}

/**
 * Transform an item's values, resolving reference fields to nested objects
 * 
 * @param itemId - The item's database UUID
 * @param itemValues - Raw item values (field_id -> value)
 * @param fields - Collection fields with type information
 * @param isPublished - Whether to fetch published referenced items
 * @param visited - Set of visited item IDs to prevent circular references
 * @param maxDepth - Maximum depth for nested reference resolution (default: 3)
 * @param currentDepth - Current recursion depth
 * @returns Object with field names as keys and resolved values
 */
export async function resolveItemReferences(
  itemId: string,
  itemValues: Record<string, string>,
  fields: CollectionField[],
  isPublished: boolean = true,
  visited: Set<string> = new Set(),
  maxDepth: number = 6,
  currentDepth: number = 0
): Promise<Record<string, any>> {
  const result: Record<string, any> = {
    _id: itemId,
  };

  // Prevent infinite loops
  if (visited.has(itemId)) {
    return result;
  }
  visited.add(itemId);

  // Check depth limit
  if (currentDepth >= maxDepth) {
    // At max depth, just return raw values without resolving references
    for (const field of fields) {
      const value = itemValues[field.id];
      if (value !== undefined && value !== null) {
        result[field.name] = value;
      }
    }
    return result;
  }

  for (const field of fields) {
    const value = itemValues[field.id];
    
    // Skip if no value
    if (value === undefined || value === null) {
      continue;
    }

    if (field.type === 'reference' && field.reference_collection_id) {
      // Single reference - resolve to nested object
      try {
        const refItem = await getItemWithValues(value, isPublished);
        if (refItem) {
          const refFields = await getFieldsByCollectionId(field.reference_collection_id, isPublished);
          const resolved = await resolveItemReferences(
            refItem.id,
            refItem.values,
            refFields,
            isPublished,
            new Set(visited), // Clone to allow same item in different branches
            maxDepth,
            currentDepth + 1
          );
          result[field.name] = resolved;
        } else {
          result[field.name] = null;
        }
      } catch (error) {
        console.error(`Failed to resolve reference field ${field.name}:`, error);
        result[field.name] = null;
      }
    } else if (field.type === 'multi_reference' && field.reference_collection_id) {
      // Multi-reference - resolve to array of objects
      try {
        // Parse the JSON array of item IDs
        let itemIds: string[] = [];
        try {
          itemIds = JSON.parse(value);
          if (!Array.isArray(itemIds)) {
            itemIds = [];
          }
        } catch {
          // If not valid JSON, treat as empty array
          itemIds = [];
        }

        const resolvedItems: ResolvedItem[] = [];
        const refFields = await getFieldsByCollectionId(field.reference_collection_id, isPublished);
        
        for (const refItemId of itemIds) {
          const refItem = await getItemWithValues(refItemId, isPublished);
          if (refItem) {
            const resolved = await resolveItemReferences(
              refItem.id,
              refItem.values,
              refFields,
              isPublished,
              new Set(visited), // Clone to allow same item in different branches
              maxDepth,
              currentDepth + 1
            );
            resolvedItems.push(resolved as ResolvedItem);
          }
        }
        
        result[field.name] = resolvedItems;
      } catch (error) {
        console.error(`Failed to resolve multi-reference field ${field.name}:`, error);
        result[field.name] = [];
      }
    } else {
      // Regular field - just copy the value
      result[field.name] = value;
    }
  }

  return result;
}

/**
 * Transform an item to public API format with resolved references
 * This is the main function to use in API routes
 */
export async function transformItemToPublicWithRefs(
  item: { id: string; values: Record<string, string> },
  fields: CollectionField[],
  isPublished: boolean = true
): Promise<Record<string, any>> {
  return resolveItemReferences(
    item.id,
    item.values,
    fields,
    isPublished
  );
}
