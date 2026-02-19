/**
 * Reference Field Resolver for API
 * 
 * Resolves reference and multi-reference fields by fetching the actual
 * referenced item data and returning it as nested objects/arrays.
 * 
 * Supports field projections to limit returned fields:
 * - fieldProjections["Blog Posts"] = Set(["Name", "Summary", "Author"])
 * - fieldProjections["Blog Posts.Author"] = Set(["Name", "Email"])
 */

import { getItemWithValues } from '@/lib/repositories/collectionItemRepository';
import { getFieldsByCollectionId } from '@/lib/repositories/collectionFieldRepository';
import { getCollectionById } from '@/lib/repositories/collectionRepository';
import type { CollectionField } from '@/types';

/**
 * Field projections map: path -> Set of allowed field names
 * Path format: "CollectionName" or "CollectionName.RefField.NestedRefField"
 */
export type FieldProjections = Record<string, Set<string>>;

/**
 * Resolved reference item structure
 */
export interface ResolvedItem {
  _id: string;
  [fieldName: string]: any;
}

/**
 * Check if a field name is allowed by the projections
 * Uses case-insensitive matching
 */
function isFieldAllowed(
  fieldName: string,
  allowedFields: Set<string> | undefined
): boolean {
  if (!allowedFields) {
    // No restrictions, all fields allowed
    return true;
  }
  // Case-insensitive match
  const normalizedFieldName = fieldName.toLowerCase();
  for (const allowed of allowedFields) {
    if (allowed.toLowerCase() === normalizedFieldName) {
      return true;
    }
  }
  return false;
}

/**
 * Transform an item's values, resolving reference fields to nested objects
 * 
 * @param itemId - The item's database UUID
 * @param itemValues - Raw item values (field_id -> value)
 * @param fields - Collection fields with type information
 * @param isPublished - Whether to fetch published referenced items
 * @param visited - Set of visited item IDs to prevent circular references
 * @param maxDepth - Maximum depth for nested reference resolution (default: 6)
 * @param currentDepth - Current recursion depth
 * @param fieldProjections - Optional map of path -> allowed field names
 * @param currentPath - Current path for field projections (e.g., "Blog Posts.Author")
 * @returns Object with field names as keys and resolved values
 */
export async function resolveItemReferences(
  itemId: string,
  itemValues: Record<string, string>,
  fields: CollectionField[],
  isPublished: boolean = true,
  visited: Set<string> = new Set(),
  maxDepth: number = 6,
  currentDepth: number = 0,
  fieldProjections?: FieldProjections,
  currentPath?: string
): Promise<Record<string, any>> {
  const result: Record<string, any> = {
    _id: itemId,
  };

  // Prevent infinite loops
  if (visited.has(itemId)) {
    return result;
  }
  visited.add(itemId);

  // Get allowed fields for current path (if projections specified)
  const allowedFields = currentPath && fieldProjections ? fieldProjections[currentPath] : undefined;

  // Check depth limit
  if (currentDepth >= maxDepth) {
    // At max depth, just return raw values without resolving references
    for (const field of fields) {
      // Skip if not in allowed fields list
      if (!isFieldAllowed(field.name, allowedFields)) {
        continue;
      }
      const value = itemValues[field.id];
      if (value !== undefined && value !== null) {
        result[field.name] = value;
      }
    }
    return result;
  }

  for (const field of fields) {
    // Skip if not in allowed fields list
    if (!isFieldAllowed(field.name, allowedFields)) {
      continue;
    }

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
          const refFields = await getFieldsByCollectionId(field.reference_collection_id, isPublished, { excludeComputed: true });
          // Build the path for nested projections
          const nestedPath = currentPath ? `${currentPath}.${field.name}` : undefined;
          const resolved = await resolveItemReferences(
            refItem.id,
            refItem.values,
            refFields,
            isPublished,
            new Set(visited), // Clone to allow same item in different branches
            maxDepth,
            currentDepth + 1,
            fieldProjections,
            nestedPath
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
        // Build the path for nested projections
        const nestedPath = currentPath ? `${currentPath}.${field.name}` : undefined;
        
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
              currentDepth + 1,
              fieldProjections,
              nestedPath
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
 * 
 * @param item - The item with id and values
 * @param fields - Collection fields
 * @param isPublished - Whether to fetch published data
 * @param fieldProjections - Optional field projections map
 * @param collectionName - Collection name for building projection path
 */
export async function transformItemToPublicWithRefs(
  item: { id: string; values: Record<string, string> },
  fields: CollectionField[],
  isPublished: boolean = true,
  fieldProjections?: FieldProjections,
  collectionName?: string
): Promise<Record<string, any>> {
  return resolveItemReferences(
    item.id,
    item.values,
    fields,
    isPublished,
    new Set(),
    6,
    0,
    fieldProjections,
    collectionName
  );
}

/**
 * Parse fields query parameters into a FieldProjections map
 * 
 * @param searchParams - URL search params
 * @returns Map of path -> Set of allowed field names
 * 
 * Example: ?fields[Blog Posts]=Name,Summary&fields[Blog Posts.Author]=Name
 * Returns: { "Blog Posts": Set(["Name", "Summary"]), "Blog Posts.Author": Set(["Name"]) }
 */
export function parseFieldProjections(searchParams: URLSearchParams): FieldProjections {
  const projections: FieldProjections = {};
  
  searchParams.forEach((value, key) => {
    const match = key.match(/^fields\[(.+)\]$/);
    if (match) {
      const path = match[1]; // e.g., "Blog Posts" or "Blog Posts.Author"
      const fieldNames = value.split(',').map(f => f.trim()).filter(f => f.length > 0);
      if (fieldNames.length > 0) {
        projections[path] = new Set(fieldNames);
      }
    }
  });
  
  return projections;
}
