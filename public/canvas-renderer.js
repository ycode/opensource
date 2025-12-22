/**
 * YCode Canvas Renderer
 * Runs inside the iframe - renders layers and handles user interactions
 */

(function() {
  'use strict';

  // State
  let layers = [];
  let selectedLayerId = null;
  let editingLayerId = null;
  let hoveredLayerId = null;
  let editMode = true;
  let currentBreakpoint = 'desktop';
  let currentUIState = 'neutral'; // Active UI state for visual preview
  let componentMap = {}; // Maps layer IDs to their root component layer ID
  let editingComponentId = null; // ID of component being edited
  let collectionItems = {}; // Collection items by collection ID (for CMS view)
  let collectionFields = {}; // Collection fields by collection ID
  let collectionLayerData = {}; // Collection items by layer ID (for collection layers)
  let pageCollectionItem = null; // Collection item for dynamic page preview
  let pageCollectionFields = [];
  
  // Pagination state for collection layers
  let paginationState = {}; // { layerId: { page: number, loading: boolean, meta: {...} } }
  let paginationDataCache = {}; // { layerId: CollectionItemWithValues[] } - current page data

  // Root element
  const root = document.getElementById('canvas-root');

  /**
   * Send message to parent window
   */
  function sendToParent(type, payload) {
    if (window.parent) {
      window.parent.postMessage({ type, payload }, '*');
    }
  }

  /**
   * Listen for messages from parent
   */
  window.addEventListener('message', function(event) {
    const message = event.data;

    if (!message || !message.type) return;

    switch (message.type) {
      case 'UPDATE_LAYERS':
        layers = message.payload.layers || [];
        selectedLayerId = message.payload.selectedLayerId;
        componentMap = message.payload.componentMap || {};
        editingComponentId = message.payload.editingComponentId;
        collectionItems = message.payload.collectionItems || {};
        collectionFields = message.payload.collectionFields || {};
        pageCollectionItem = message.payload.pageCollectionItem || null;
        pageCollectionFields = message.payload.pageCollectionFields || [];
        render();
        break;

      case 'UPDATE_SELECTION':
        selectedLayerId = message.payload.layerId;
        updateSelection();
        break;

      case 'UPDATE_BREAKPOINT':
        currentBreakpoint = message.payload.breakpoint;
        updateBreakpoint();
        break;

      case 'UPDATE_UI_STATE':
        currentUIState = message.payload.uiState;
        updateUIState();
        break;

      case 'ENABLE_EDIT_MODE':
        editMode = message.payload.enabled;
        render();
        break;

      case 'COLLECTION_LAYER_DATA':
        // Store collection data specific to this layer
        collectionLayerData[message.payload.layerId] = message.payload.items;
        console.log('[Canvas] Received COLLECTION_LAYER_DATA', {
          layerId: message.payload.layerId,
          itemsCount: message.payload.items.length
        });
        render();
        break;

      case 'UPDATE_PAGINATION_DATA':
        // Update pagination data for a collection layer
        const { layerId, items, meta } = message.payload;
        paginationDataCache[layerId] = items;
        paginationState[layerId] = {
          page: meta.currentPage,
          loading: false,
          meta: meta
        };
        console.log('[Canvas] Received UPDATE_PAGINATION_DATA', {
          layerId,
          itemsCount: items.length,
          meta
        });
        render();
        break;

      case 'HIGHLIGHT_DROP_ZONE':
        highlightDropZone(message.payload.layerId);
        break;

      case 'UPDATE_HOVER':
        hoveredLayerId = message.payload.layerId;
        updateHover();
        break;
    }
  });

  /**
   * Get HTML tag for layer
   */
  function getLayerHtmlTag(layer) {
    // Body layer should render as div (actual <body> is the iframe's body)
    if (layer.id === 'body' || layer.name === 'body') {
      return 'div';
    }

    // Check for custom tag in settings
    if (layer.settings && layer.settings.tag) {
      return layer.settings.tag;
    }

    // Map layer type to HTML tag
    if (layer.name) {
      return layer.name;
    }

    // Default fallback
    return 'div';
  }

  /**
   * Get classes string from layer with UI state applied
   * For hover/focus/active states, we need to make Tailwind's state classes apply
   */
  function getClassesString(layer) {
    let classes = Array.isArray(layer.classes) ? layer.classes.join(' ') : (layer.classes || '');

    if (currentUIState === 'neutral') {
      // In neutral state, keep only non-state classes
      classes = filterNeutralClasses(classes);
    } else {
      // In a specific state, activate that state's classes
      classes = activateStateClasses(classes, currentUIState);
    }

    return classes;
  }

  /**
   * Filter out state-specific classes, keeping only neutral/base classes
   * Used when currentUIState is 'neutral'
   */
  function filterNeutralClasses(classesString) {
    if (!classesString) return classesString;

    const classArray = classesString.split(' ').filter(Boolean);
    const neutralClasses = [];

    const stateModifiers = ['hover:', 'focus:', 'active:', 'disabled:', 'visited:'];

    classArray.forEach(cls => {
      // Check if this class has a state modifier
      let hasStateModifier = false;

      // Check for direct state modifiers (hover:, focus:, etc.)
      for (const modifier of stateModifiers) {
        if (cls.startsWith(modifier)) {
          hasStateModifier = true;
          break;
        }
      }

      // Check for breakpoint + state modifiers (max-md:hover:, max-lg:focus:, etc.)
      if (!hasStateModifier) {
        const afterBreakpoint = cls.replace(/^(max-lg:|max-md:|lg:|md:)/, '');
        if (afterBreakpoint !== cls) {
          // Has a breakpoint prefix, check if what follows is a state modifier
          for (const modifier of stateModifiers) {
            if (afterBreakpoint.startsWith(modifier)) {
              hasStateModifier = true;
              break;
            }
          }
        }
      }

      // Only keep classes without state modifiers
      if (!hasStateModifier) {
        neutralClasses.push(cls);
      }
    });

    return neutralClasses.join(' ');
  }

  /**
   * Activate state-specific classes by converting them to active classes
   * e.g., "hover:bg-blue-500" becomes "bg-blue-500" when currentUIState is 'hover'
   * Also filters out OTHER state classes (e.g., removes focus: classes when in hover state)
   * CRITICAL: Removes conflicting neutral classes when state-specific classes are activated
   */
  function activateStateClasses(classesString, state) {
    if (!classesString) return classesString;

    const classArray = classesString.split(' ').filter(Boolean);
    const statePrefix = state === 'current' ? 'visited:' : `${state}:`;
    const activatedClasses = [];
    const activatedBaseClasses = new Set(); // Track which base classes we've activated

    // List of all state modifiers to filter out others
    const stateModifiers = ['hover:', 'focus:', 'active:', 'disabled:', 'visited:'];
    const otherStates = stateModifiers.filter(m => m !== statePrefix);

    // First pass: collect all activated state classes and track their base classes
    classArray.forEach(cls => {
      // Check if this class is for the current active state
      if (cls.startsWith(statePrefix)) {
        // Extract the base class (remove state prefix)
        const baseClass = cls.substring(statePrefix.length);
        // Add the activated version (without prefix)
        activatedClasses.push(baseClass);
        // Track this so we can filter out conflicting neutral classes
        activatedBaseClasses.add(getClassPrefix(baseClass));
      } else if (cls.startsWith('max-lg:' + statePrefix)) {
        // Handle breakpoint + state combo: max-lg:hover:bg-blue-500
        const baseClass = cls.substring(('max-lg:' + statePrefix).length);
        const fullClass = 'max-lg:' + baseClass;
        activatedClasses.push(fullClass);
        // Track with breakpoint prefix
        activatedBaseClasses.add('max-lg:' + getClassPrefix(baseClass));
      } else if (cls.startsWith('max-md:' + statePrefix)) {
        // Handle breakpoint + state combo: max-md:hover:bg-blue-500
        const baseClass = cls.substring(('max-md:' + statePrefix).length);
        const fullClass = 'max-md:' + baseClass;
        activatedClasses.push(fullClass);
        // Track with breakpoint prefix
        activatedBaseClasses.add('max-md:' + getClassPrefix(baseClass));
      }
    });

    // Second pass: add neutral classes only if they don't conflict with activated classes
    classArray.forEach(cls => {
      // Skip state-specific classes (already processed)
      if (cls.startsWith(statePrefix) ||
          cls.startsWith('max-lg:' + statePrefix) ||
          cls.startsWith('max-md:' + statePrefix)) {
        return;
      }

      // Check if this is a different state's class - if so, skip it
      let isOtherState = false;
      for (const otherState of otherStates) {
        if (cls.startsWith(otherState)) {
          isOtherState = true;
          break;
        }
        // Check for breakpoint + other state combo
        if (cls.startsWith('max-lg:' + otherState) || cls.startsWith('max-md:' + otherState)) {
          isOtherState = true;
          break;
        }
      }

      if (isOtherState) {
        return; // Skip other state classes
      }

      // Check if this neutral class conflicts with an activated state class
      const classPrefix = getClassPrefix(cls);
      if (activatedBaseClasses.has(classPrefix)) {
        // Conflict detected - skip this neutral class
        // Example: hover:m-[100px] activated to m-[100px], so skip neutral m-[50px]
        return;
      }

      // No conflict - keep this neutral class
      activatedClasses.push(cls);
    });

    return activatedClasses.join(' ');
  }

  /**
   * Get the property prefix from a Tailwind class for conflict detection
   * Examples:
   *   "m-[100px]" → "m-"
   *   "bg-[#ff0000]" → "bg-"
   *   "text-[1rem]" → "text-"
   *   "text-red-500" → "text-" (named color)
   *   "max-lg:m-[50px]" → "max-lg:m-"
   *   "flex" → "display"
   *   "block" → "display"
   */
  function getClassPrefix(cls) {
    // Handle breakpoint prefixes
    let prefix = '';
    if (cls.startsWith('max-lg:')) {
      prefix = 'max-lg:';
      cls = cls.substring(7);
    } else if (cls.startsWith('max-md:')) {
      prefix = 'max-md:';
      cls = cls.substring(7);
    }

    // Special cases: display values without dashes should all conflict with each other
    const displayValues = ['flex', 'inline-flex', 'block', 'inline-block', 'inline', 'grid', 'inline-grid', 'hidden', 'table', 'table-row', 'table-cell'];
    if (displayValues.includes(cls)) {
      return prefix + 'display';
    }

    // Special cases: flex/grid direction values
    const flexDirectionValues = ['flex-row', 'flex-row-reverse', 'flex-col', 'flex-col-reverse'];
    if (flexDirectionValues.includes(cls)) {
      return prefix + 'flex-direction';
    }

    // Special cases: flex wrap values
    const flexWrapValues = ['flex-wrap', 'flex-wrap-reverse', 'flex-nowrap'];
    if (flexWrapValues.includes(cls)) {
      return prefix + 'flex-wrap';
    }

    // Special cases: justify-content values
    if (cls.startsWith('justify-')) {
      return prefix + 'justify-';
    }

    // Special cases: align-items values
    if (cls.startsWith('items-')) {
      return prefix + 'items-';
    }

    // Special cases: text/bg/border colors with named values (text-red-500, bg-blue-300)
    // These should conflict with arbitrary colors (text-[#ff0000], bg-[#00ff00])
    if (cls.match(/^text-[a-z]+-\d+$/)) {
      return prefix + 'text-';
    }
    if (cls.match(/^bg-[a-z]+-\d+$/)) {
      return prefix + 'bg-';
    }
    if (cls.match(/^border-[a-z]+-\d+$/)) {
      return prefix + 'border-';
    }

    // Extract the property part before the value
    // Match patterns like: m-, mt-, bg-, text-, etc.
    const match = cls.match(/^([a-z-]+)-/);
    if (match) {
      return prefix + match[1] + '-';
    }

    // For classes without dash (shouldn't reach here after special cases above)
    return prefix + cls;
  }

  /**
   * Compute item counts for all collection layers on the page
   * Used for page collection visibility conditions
   */
  function computePageCollectionCounts(layerList) {
    const counts = {};

    function traverse(layers) {
      for (const layer of layers) {
        const collectionVariable = layer.variables?.collection || layer.collection || null;
        if (collectionVariable?.id) {
          // Get the item count for this layer
          const items = collectionLayerData[layer.id] || [];
          counts[layer.id] = items.length;
        }
        if (layer.children) {
          traverse(layer.children);
        }
      }
    }

    traverse(layerList);
    return counts;
  }

  /**
   * Evaluate a single visibility condition
   */
  function evaluateCondition(condition, context) {
    const { collectionItemData, pageCollectionCounts } = context;

    if (condition.source === 'page_collection') {
      const count = pageCollectionCounts?.[condition.collectionLayerId] ?? 0;
      
      switch (condition.operator) {
        case 'has_items':
          return count > 0;
        case 'has_no_items':
          return count === 0;
        case 'item_count': {
          const compareValue = condition.compareValue ?? 0;
          const compareOp = condition.compareOperator ?? 'eq';
          switch (compareOp) {
            case 'eq': return count === compareValue;
            case 'lt': return count < compareValue;
            case 'lte': return count <= compareValue;
            case 'gt': return count > compareValue;
            case 'gte': return count >= compareValue;
            default: return count === compareValue;
          }
        }
        default:
          return true;
      }
    }

    // Collection field conditions
    if (condition.source === 'collection_field') {
      const fieldId = condition.fieldId;
      if (!fieldId) return true;

      const rawValue = collectionItemData?.[fieldId];
      const value = rawValue ?? '';
      const compareValue = condition.value ?? '';
      const fieldType = condition.fieldType || 'text';

      const isPresent = rawValue !== undefined && rawValue !== null && rawValue !== '';

      switch (condition.operator) {
        // Text operators
        case 'is':
          if (fieldType === 'boolean') {
            return value.toLowerCase() === compareValue.toLowerCase();
          }
          if (fieldType === 'number') {
            return parseFloat(value) === parseFloat(compareValue);
          }
          return value === compareValue;
        
        case 'is_not':
          if (fieldType === 'number') {
            return parseFloat(value) !== parseFloat(compareValue);
          }
          return value !== compareValue;
        
        case 'contains':
          return value.toLowerCase().includes(compareValue.toLowerCase());
        
        case 'does_not_contain':
          return !value.toLowerCase().includes(compareValue.toLowerCase());
        
        case 'is_present':
          return isPresent;
        
        case 'is_empty':
          return !isPresent;

        // Number operators
        case 'lt':
          return parseFloat(value) < parseFloat(compareValue);
        
        case 'lte':
          return parseFloat(value) <= parseFloat(compareValue);
        
        case 'gt':
          return parseFloat(value) > parseFloat(compareValue);
        
        case 'gte':
          return parseFloat(value) >= parseFloat(compareValue);

        // Date operators
        case 'is_before': {
          const dateValue = new Date(value);
          const compareDateValue = new Date(compareValue);
          return dateValue < compareDateValue;
        }
        
        case 'is_after': {
          const dateValue = new Date(value);
          const compareDateValue = new Date(compareValue);
          return dateValue > compareDateValue;
        }
        
        case 'is_between': {
          const dateValue = new Date(value);
          const startDate = new Date(compareValue);
          const endDate = new Date(condition.value2 ?? '');
          return dateValue >= startDate && dateValue <= endDate;
        }
        
        case 'is_not_empty':
          return isPresent;

        // Reference operators
        case 'is_one_of': {
          try {
            const allowedIds = JSON.parse(compareValue || '[]');
            if (!Array.isArray(allowedIds)) return false;
            // For multi-reference, value might be a JSON array
            try {
              const valueIds = JSON.parse(value);
              if (Array.isArray(valueIds)) {
                // Check if any of the value IDs are in the allowed list
                return valueIds.some(id => allowedIds.includes(id));
              }
            } catch {
              // Not a JSON array, treat as single ID
            }
            return allowedIds.includes(value);
          } catch {
            return false;
          }
        }

        case 'is_not_one_of': {
          try {
            const excludedIds = JSON.parse(compareValue || '[]');
            if (!Array.isArray(excludedIds)) return true;
            // For multi-reference, value might be a JSON array
            try {
              const valueIds = JSON.parse(value);
              if (Array.isArray(valueIds)) {
                // Check if none of the value IDs are in the excluded list
                return !valueIds.some(id => excludedIds.includes(id));
              }
            } catch {
              // Not a JSON array, treat as single ID
            }
            return !excludedIds.includes(value);
          } catch {
            return true;
          }
        }

        case 'exists':
          return isPresent;

        case 'does_not_exist':
          return !isPresent;

        // Multi-reference operators
        case 'contains_all_of': {
          try {
            const requiredIds = JSON.parse(compareValue || '[]');
            if (!Array.isArray(requiredIds)) return false;
            // Parse the multi-reference value
            let valueIds = [];
            try {
              const parsed = JSON.parse(value);
              valueIds = Array.isArray(parsed) ? parsed : [];
            } catch {
              valueIds = value ? [value] : [];
            }
            return requiredIds.every(id => valueIds.includes(id));
          } catch {
            return false;
          }
        }

        case 'contains_exactly': {
          try {
            const requiredIds = JSON.parse(compareValue || '[]');
            if (!Array.isArray(requiredIds)) return false;
            // Parse the multi-reference value
            let valueIds = [];
            try {
              const parsed = JSON.parse(value);
              valueIds = Array.isArray(parsed) ? parsed : [];
            } catch {
              valueIds = value ? [value] : [];
            }
            // Check exact match (same items, regardless of order)
            return requiredIds.length === valueIds.length && 
                   requiredIds.every(id => valueIds.includes(id));
          } catch {
            return false;
          }
        }

        // For multi-reference has_items / has_no_items - check if array has items
        case 'has_items': {
          if (condition.source === 'collection_field') {
            try {
              const arr = JSON.parse(value || '[]');
              return Array.isArray(arr) && arr.length > 0;
            } catch {
              return isPresent;
            }
          }
          return true;
        }

        case 'has_no_items': {
          if (condition.source === 'collection_field') {
            try {
              const arr = JSON.parse(value || '[]');
              return !Array.isArray(arr) || arr.length === 0;
            } catch {
              return !isPresent;
            }
          }
          return true;
        }

        // Multi-reference item_count - compare the count of references
        case 'item_count': {
          if (condition.source === 'collection_field' && condition.fieldType === 'multi_reference') {
            let count = 0;
            try {
              const arr = JSON.parse(value || '[]');
              count = Array.isArray(arr) ? arr.length : 0;
            } catch {
              count = 0;
            }
            const compareVal = condition.compareValue ?? 0;
            const compareOp = condition.compareOperator ?? 'eq';
            switch (compareOp) {
              case 'eq': return count === compareVal;
              case 'lt': return count < compareVal;
              case 'lte': return count <= compareVal;
              case 'gt': return count > compareVal;
              case 'gte': return count >= compareVal;
              default: return count === compareVal;
            }
          }
          return true;
        }

        default:
          return true;
      }
    }

    return true;
  }

  /**
   * Evaluate conditional visibility for a layer
   * Groups are AND'd together; conditions within a group are OR'd
   */
  function evaluateVisibility(conditionalVisibility, context) {
    if (!conditionalVisibility || !conditionalVisibility.groups || conditionalVisibility.groups.length === 0) {
      return true;
    }

    for (const group of conditionalVisibility.groups) {
      if (!group.conditions || group.conditions.length === 0) {
        continue;
      }

      let groupResult = false;
      for (const condition of group.conditions) {
        if (evaluateCondition(condition, context)) {
          groupResult = true;
          break;
        }
      }

      if (!groupResult) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if a layer is text-editable
   */
  function isTextEditable(layer) {
    return layer.formattable ?? false;
  }

  /**
   * Get text content from layer
   * If collectionItemData is provided, use it for field variable resolution
   * If collectionId is provided, validates that referenced fields still exist
   */
  function getText(layer, collectionItemData, collectionId) {
    const text = layer.text || '';

    // Check if text is a field variable
    if (text && typeof text === 'object' && text.type === 'field' && text.data && text.data.field_id) {
      // Resolve field variable from collection item data
      if (collectionItemData) {
        const fieldId = text.data.field_id;
        const relationships = text.data.relationships || [];
        const itemValues = collectionItemData.values || collectionItemData;
        
        // If there are relationships, resolve the reference path
        if (relationships.length > 0) {
          const resolvedValue = resolveReferenceFieldValue(
            fieldId,
            relationships,
            itemValues,
            collectionId
          );
          if (resolvedValue !== null) {
            return resolvedValue;
          }
          return '';
        }
        
        // No relationships - direct field access
        const value = itemValues[fieldId];
        if (value !== undefined && value !== null) {
          return value;
        }
      }
      return ''; // No data to resolve
    }

    // Check if it's inline variable content (variables.text structure)
    if (layer.variables && layer.variables.text) {
      const inlineContent = layer.variables.text;

      // New format: simple string with embedded JSON variables
      if (typeof inlineContent === 'string') {
        let resolvedText = inlineContent;

        const jsonRegex = /<ycode-inline-variable>([\s\S]*?)<\/ycode-inline-variable>/g;

        if (resolvedText.includes('<ycode-inline-variable>')) {
          if (collectionItemData) {
            resolvedText = resolvedText.replace(jsonRegex, function(match, jsonContent) {
              try {
                const variable = JSON.parse(jsonContent.trim());
                if (variable && variable.type === 'field' && variable.data && variable.data.field_id) {
                  const fieldId = variable.data.field_id;
                  const relationships = variable.data.relationships || [];
                  
                  // Get the current item's values
                  const itemValues = collectionItemData.values || collectionItemData;
                  
                  // If there are relationships, resolve the reference path
                  if (relationships.length > 0) {
                    const resolvedValue = resolveReferenceFieldValue(
                      fieldId,
                      relationships,
                      itemValues,
                      collectionId
                    );
                    if (resolvedValue !== null) {
                      return resolvedValue;
                    }
                    return '';
                  }
                  
                  // No relationships - direct field access
                  const value = itemValues[fieldId];
                  if (value !== undefined && value !== null) {
                    return value;
                  }
                }
              } catch (error) {
                console.warn('[getText] Failed to parse inline variable JSON:', jsonContent, error);
              }
              return '';
            });
          } else {
            resolvedText = resolvedText.replace(jsonRegex, '');
          }
        }

        return resolvedText;
      }

      // Legacy format: { data, variables } map
      const inlineData = inlineContent.data || '';
      let resolvedText = inlineData;

      const idRegex = /<ycode-inline-variable id="([^"]+)"><\/ycode-inline-variable>/g;

      if (collectionItemData && inlineContent.variables) {
        let fieldsForCollection = [];
        if (collectionId && collectionFields[collectionId]) {
          fieldsForCollection = collectionFields[collectionId];
        } else if (pageCollectionFields && pageCollectionFields.length > 0) {
          fieldsForCollection = pageCollectionFields;
        }

        resolvedText = resolvedText.replace(idRegex, function(match, variableId) {
          const variable = inlineContent.variables[variableId];
          if (variable && variable.type === 'field' && variable.data && variable.data.field_id) {
            const fieldId = variable.data.field_id;
            const fieldExists = fieldsForCollection.some(f => f.id === fieldId);
            if (!fieldExists) {
              return '';
            }

            const value = collectionItemData[fieldId];
            if (value !== undefined && value !== null) {
              return value;
            }
          }
          return '';
        });
      } else {
        resolvedText = resolvedText.replace(idRegex, '');
      }

      return resolvedText;
    }

    // Check if text is a string but contains variable tags (shouldn't happen, but handle it)
    if (typeof text === 'string' && text.includes('<ycode-inline-variable')) {
      // Strip out variable tags completely for display
      return text.replace(/<ycode-inline-variable[^>]*>.*?<\/ycode-inline-variable>/g, '');
    }

    return text;
  }

  /**
   * Resolve a reference field value by following the relationship path
   * @param {string} rootFieldId - The root reference field ID
   * @param {string[]} relationships - Array of field IDs to traverse
   * @param {Object} currentItemValues - The current item's values
   * @param {string} currentCollectionId - The current collection ID
   * @returns {string|null} The resolved value or null
   */
  function resolveReferenceFieldValue(rootFieldId, relationships, currentItemValues, currentCollectionId) {
    // Get the root field to find its reference_collection_id
    let currentFields = collectionFields[currentCollectionId] || pageCollectionFields || [];
    let currentValues = currentItemValues;
    let currentFieldId = rootFieldId;
    
    // Traverse the relationship path
    const pathToTraverse = [rootFieldId, ...relationships];
    
    for (let i = 0; i < pathToTraverse.length; i++) {
      const fieldId = pathToTraverse[i];
      const isLastField = i === pathToTraverse.length - 1;
      
      if (isLastField) {
        // Last field in path - return its value
        const value = currentValues?.[fieldId];
        return value !== undefined && value !== null ? value : null;
      }
      
      // Not the last field - it's a reference field, follow it
      const field = currentFields.find(f => f.id === fieldId);
      if (!field || field.type !== 'reference' || !field.reference_collection_id) {
        console.warn('[resolveReferenceFieldValue] Field not found or not a reference:', fieldId);
        return null;
      }
      
      // Get the referenced item ID
      const referencedItemId = currentValues?.[fieldId];
      if (!referencedItemId) {
        return null;
      }
      
      // Look up the referenced item in the collection's data
      const referencedCollectionId = field.reference_collection_id;
      const referencedItems = collectionItems[referencedCollectionId] || [];
      const referencedItem = referencedItems.find(item => item.id === referencedItemId);
      
      // Also check collection layer data (items loaded for layers)
      let foundItem = referencedItem;
      if (!foundItem) {
        // Search through all layer data for the referenced item
        for (const layerId in collectionLayerData) {
          const layerItems = collectionLayerData[layerId] || [];
          foundItem = layerItems.find(item => item.id === referencedItemId);
          if (foundItem) break;
        }
      }
      
      if (!foundItem) {
        console.warn('[resolveReferenceFieldValue] Referenced item not found:', referencedItemId);
        return null;
      }
      
      // Update current context for next iteration
      currentValues = foundItem.values || {};
      currentFields = collectionFields[referencedCollectionId] || [];
    }
    
    return null;
  }

  /**
   * Sort collection items based on layer sorting settings
   * @param {Array} items - Array of collection items to sort
   * @param {Object} collectionVariable - Collection variable containing sorting preferences
   * @param {Array} fields - Array of collection fields for field-based sorting
   * @returns {Array} Sorted array of collection items
   */
  function sortCollectionItems(items, collectionVariable, fields) {
    // If no collection variable or no items, return as-is
    if (!collectionVariable || items.length === 0) {
      return items;
    }

    const sortBy = collectionVariable.sort_by;
    const sortOrder = collectionVariable.sort_order || 'asc';

    // Create a copy to avoid mutating the original array
    const sortedItems = [...items];

    // No sorting - return database order (as-is)
    if (!sortBy || sortBy === 'none') {
      return sortedItems;
    }

    // Manual sorting - sort by manual_order field
    if (sortBy === 'manual') {
      return sortedItems.sort((a, b) => a.manual_order - b.manual_order);
    }

    // Random sorting - shuffle the array
    if (sortBy === 'random') {
      for (let i = sortedItems.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [sortedItems[i], sortedItems[j]] = [sortedItems[j], sortedItems[i]];
      }
      return sortedItems;
    }

    // Field-based sorting - sortBy is a field ID
    return sortedItems.sort((a, b) => {
      const aValue = a.values[sortBy] || '';
      const bValue = b.values[sortBy] || '';

      // Try to parse as numbers if possible
      const aNum = parseFloat(String(aValue));
      const bNum = parseFloat(String(bValue));

      if (!isNaN(aNum) && !isNaN(bNum)) {
        // Numeric comparison
        return sortOrder === 'asc' ? aNum - bNum : bNum - aNum;
      }

      // String comparison
      const comparison = String(aValue).localeCompare(String(bValue));
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }

  /**
   * Measure and report content height to parent
   */
  function reportContentHeight() {
    requestAnimationFrame(() => {
      // Measure actual content inside the Body layer (ignoring Body's min-height)
      let contentHeight = 0;

      function measureElement(el) {
        // Skip the Body layer itself - measure its children instead
        const isBody = el.getAttribute('data-layer-id') === 'body';

        if (!isBody) {
          const rect = el.getBoundingClientRect();
          const bottom = rect.bottom;
          if (bottom > contentHeight) {
            contentHeight = bottom;
          }
        }

        // Always measure children to find deepest content
        for (let i = 0; i < el.children.length; i++) {
          measureElement(el.children[i]);
        }
      }

      // Measure all children of root
      for (let i = 0; i < root.children.length; i++) {
        measureElement(root.children[i]);
      }

      // Minimum height of 100 to avoid zero height
      contentHeight = Math.max(contentHeight, 100);

      sendToParent('CONTENT_HEIGHT', { height: Math.ceil(contentHeight) });
    });
  }

  /**
   * Apply limit and offset to collection items (after sorting)
   * @param {Array} items - Array of collection items
   * @param {number} limit - Maximum number of items to show
   * @param {number} offset - Number of items to skip
   * @returns {Array} Filtered array of collection items
   */
  function applyLimitOffset(items, limit, offset) {
    let result = [...items];

    // Apply offset first (skip items)
    if (offset && offset > 0) {
      result = result.slice(offset);
    }

    // Apply limit (take first N items)
    if (limit && limit > 0) {
      result = result.slice(0, limit);
    }

    return result;
  }

  /**
   * Extract gap value from Tailwind classes
   */
  function extractGapValue(classesString) {
    if (!classesString) return null;

    // Match gap-[value] arbitrary values
    const arbitraryMatch = classesString.match(/gap-\[([^\]]+)\]/);
    if (arbitraryMatch) {
      return arbitraryMatch[1];
    }

    // Match standard gap-{size} classes
    const standardMatch = classesString.match(/gap-(\d+\.?\d*)/);
    if (standardMatch) {
      const value = parseFloat(standardMatch[1]);
      // Tailwind uses 0.25rem per unit (e.g., gap-4 = 1rem)
      return (value * 0.25) + 'rem';
    }

    return null;
  }

  /**
   * Convert gap value string to pixels
   */
  function parseGapValueToPixels(gapValue) {
    if (!gapValue) return 0;

    // Already in pixels
    if (gapValue.endsWith('px')) {
      return parseFloat(gapValue);
    }

    // Convert rem to pixels (1rem = 16px by default)
    if (gapValue.endsWith('rem')) {
      return parseFloat(gapValue) * 16;
    }

    // Convert em to pixels (assume 16px base)
    if (gapValue.endsWith('em')) {
      return parseFloat(gapValue) * 16;
    }

    // Try to parse as number (assume pixels)
    const num = parseFloat(gapValue);
    return isNaN(num) ? 0 : num;
  }

  // Track if we're currently dragging to prevent re-rendering
  let isCurrentlyDragging = false;

  /**
   * Render gap indicators as overlays (without affecting DOM structure)
   */
  function renderGapIndicators() {
    // Don't re-render while dragging to prevent blinking
    if (isCurrentlyDragging) {
      return;
    }

    // Remove existing gap overlay container
    let overlayContainer = document.getElementById('gap-indicators-overlay');
    if (overlayContainer) {
      overlayContainer.remove();
    }

    // Only show in edit mode when something is selected
    if (!editMode || !selectedLayerId) return;

    // Find the selected element
    const selectedElement = document.querySelector(`[data-layer-id="${selectedLayerId}"]`);
    if (!selectedElement) return;

    // Check if it's a flex-column container
    const classes = selectedElement.className;
    if (!classes.includes('flex') || !classes.includes('flex-col')) return;

    // Get gap value
    const gapValue = extractGapValue(classes);
    if (!gapValue) return;

    // Create overlay container (hidden by default)
    overlayContainer = document.createElement('div');
    overlayContainer.id = 'gap-indicators-overlay';
    overlayContainer.style.position = 'fixed';
    overlayContainer.style.top = '0';
    overlayContainer.style.left = '0';
    overlayContainer.style.width = '100%';
    overlayContainer.style.height = '100%';
    overlayContainer.style.pointerEvents = 'none';
    overlayContainer.style.zIndex = '9999';
    overlayContainer.style.opacity = '0';
    document.body.appendChild(overlayContainer);

    // Track hover state and dragging state
    let isHoveringElement = false;
    let isHoveringIndicator = false;
    let isDraggingAny = false;

    function updateIndicatorVisibility() {
      if (overlayContainer) {
        // Use global isCurrentlyDragging instead of local isDraggingAny to avoid scope issues
        const newOpacity = (isHoveringElement || isHoveringIndicator || isCurrentlyDragging) ? '1' : '0';
        overlayContainer.style.opacity = newOpacity;
      }
    }

    // Show/hide indicators based on hover state of selected element
    selectedElement.addEventListener('mouseenter', function showIndicators() {
      // Don't update hover state during drag
      if (!isDraggingAny) {
        isHoveringElement = true;
        updateIndicatorVisibility();
      }
    });

    selectedElement.addEventListener('mouseleave', function hideIndicators() {
      // Don't update hover state during drag
      if (!isDraggingAny) {
        isHoveringElement = false;
        // Delay slightly to allow moving to indicator
        setTimeout(() => {
          if (!isDraggingAny) {
            updateIndicatorVisibility();
          }
        }, 50);
      }
    });

    // Get all direct children of the flex container (excluding gap indicators)
    const children = Array.from(selectedElement.children).filter(
      child => !child.hasAttribute('data-gap-divider') && !child.hasAttribute('data-collection-item-id')
    );

    // For collection items, get the wrapper divs
    const collectionWrappers = Array.from(selectedElement.children).filter(
      child => child.hasAttribute('data-collection-item-id')
    );

    const allChildren = collectionWrappers.length > 0 ? collectionWrappers : children;

    // Create gap overlays between children
    for (let i = 0; i < allChildren.length - 1; i++) {
      const currentChild = allChildren[i];
      const nextChild = allChildren[i + 1];

      const currentRect = currentChild.getBoundingClientRect();
      const nextRect = nextChild.getBoundingClientRect();

      // Calculate gap position (between bottom of current and top of next)
      const gapTop = currentRect.bottom;
      const gapHeight = nextRect.top - currentRect.bottom;
      const gapLeft = currentRect.left;
      const gapWidth = currentRect.width;

      // Create gap indicator overlay (full size but invisible for hover target)
      const gapIndicator = document.createElement('div');
      gapIndicator.style.position = 'fixed';
      gapIndicator.style.top = gapTop + 'px';
      gapIndicator.style.left = gapLeft + 'px';
      gapIndicator.style.width = gapWidth + 'px';
      gapIndicator.style.height = gapHeight + 'px';
      gapIndicator.style.pointerEvents = 'auto';
      gapIndicator.style.cursor = 'ns-resize';
      gapIndicator.style.display = 'flex';
      gapIndicator.style.alignItems = 'center';
      gapIndicator.style.justifyContent = 'center';
      gapIndicator.style.overflow = 'visible'; // Allow label to extend outside

      // Create small indicator marker (20px x 2px)
      const marker = document.createElement('div');
      marker.style.width = '20px';
      marker.style.height = '2px';
      marker.style.backgroundColor = '#ec4899'; // pink-500
      marker.style.borderRadius = '20px';
      marker.style.pointerEvents = 'none';

      // Create full-size background overlay (hidden by default)
      const background = document.createElement('div');
      background.style.position = 'absolute';
      background.style.top = '0';
      background.style.left = '0';
      background.style.width = '100%';
      background.style.height = '100%';
      background.style.backgroundColor = 'rgba(236, 72, 153, 0)';
      background.style.pointerEvents = 'none';

      gapIndicator.appendChild(background);
      gapIndicator.appendChild(marker);

      // Hover interactions - show full gap with 5% opacity
      gapIndicator.addEventListener('mouseenter', function() {
        background.style.backgroundColor = 'rgba(236, 72, 153, 0.05)';
        // Don't update hover state during drag to prevent blinking
        if (!isDraggingAny) {
          isHoveringIndicator = true;
          updateIndicatorVisibility();
        }
      });

      gapIndicator.addEventListener('mouseleave', function() {
        background.style.backgroundColor = 'rgba(236, 72, 153, 0)';
        // Don't update hover state during drag to prevent blinking
        if (!isDraggingAny) {
          isHoveringIndicator = false;
          updateIndicatorVisibility();
        }
      });

      // Drag functionality to adjust gap (no visual changes)
      (function setupDrag() {
        let isDragging = false;
        let startY = 0;
        let startGapValue = 0;
        let lastUpdateTime = 0;
        const updateThrottle = 16; // ~60fps

        const handleMouseDown = function(e) {
          e.preventDefault();
          e.stopPropagation();
          
          isDragging = true;
          isDraggingAny = true;
          isCurrentlyDragging = true; // Prevent re-rendering during drag
          updateIndicatorVisibility();
          
          startY = e.clientY;
          lastUpdateTime = 0;
          
          // Parse current gap value to pixels
          startGapValue = parseGapValueToPixels(gapValue);
          
          // Change cursor to indicate dragging
          document.body.style.cursor = 'ns-resize';
          document.body.style.userSelect = 'none';
          
          // Add document listeners for move and up
          document.addEventListener('mousemove', handleMouseMove);
          document.addEventListener('mouseup', handleMouseUp);
        };

        const handleMouseMove = function(e) {
          if (!isDragging) return;
          
          const deltaY = e.clientY - startY;
          const newGapValue = Math.max(0, startGapValue + deltaY);
          
          // Throttle updates to parent (send at most every 16ms)
          const now = Date.now();
          if (now - lastUpdateTime >= updateThrottle) {
            lastUpdateTime = now;
            const newGapString = Math.round(newGapValue) + 'px';
            
            // Send real-time update to parent
            sendToParent('UPDATE_GAP', {
              layerId: selectedLayerId,
              gapValue: newGapString
            });
          }
        };

        const handleMouseUp = function(e) {
          if (!isDragging) return;
          
          const deltaY = e.clientY - startY;
          const newGapValue = Math.max(0, startGapValue + deltaY);
          
          // Convert to appropriate unit and send final update
          const newGapString = Math.round(newGapValue) + 'px';
          
          // Send final update to parent
          sendToParent('UPDATE_GAP', {
            layerId: selectedLayerId,
            gapValue: newGapString
          });
          
          // Reset cursor and dragging state
          isDragging = false;
          isDraggingAny = false;
          updateIndicatorVisibility();
          
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
          
          // Remove document listeners
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
          
          // Re-render gap indicators after drag completes
          // Delay allowing re-renders until after the update settles
          setTimeout(() => {
            isCurrentlyDragging = false;
            renderGapIndicators();
          }, 100);
        };

        // Make the entire gap indicator draggable
        gapIndicator.addEventListener('mousedown', handleMouseDown);
      })();

      overlayContainer.appendChild(gapIndicator);
    }
  }

  /**
   * Create pagination wrapper with Previous/Next buttons for canvas preview
   */
  function createPaginationWrapper(layerId, meta) {
    const { currentPage, totalPages } = meta;
    const isFirstPage = currentPage <= 1;
    const isLastPage = currentPage >= totalPages;

    const wrapper = document.createElement('div');
    wrapper.className = 'flex items-center justify-center gap-4 mt-4';
    wrapper.setAttribute('data-pagination-wrapper', 'true');
    wrapper.setAttribute('data-collection-layer-id', layerId);

    // Previous button
    const prevButton = document.createElement('button');
    prevButton.className = `px-4 py-2 rounded transition-colors ${isFirstPage ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300 cursor-pointer'}`;
    prevButton.textContent = 'Previous';
    prevButton.setAttribute('data-pagination-action', 'prev');
    prevButton.setAttribute('data-collection-layer-id', layerId);
    if (isFirstPage) prevButton.disabled = true;
    
    prevButton.addEventListener('click', function(e) {
      e.stopPropagation();
      if (!isFirstPage) {
        handlePaginationClick(layerId, currentPage - 1);
      }
    });

    // Page info
    const pageInfo = document.createElement('span');
    pageInfo.className = 'text-sm text-gray-600';
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;

    // Next button
    const nextButton = document.createElement('button');
    nextButton.className = `px-4 py-2 rounded transition-colors ${isLastPage ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300 cursor-pointer'}`;
    nextButton.textContent = 'Next';
    nextButton.setAttribute('data-pagination-action', 'next');
    nextButton.setAttribute('data-collection-layer-id', layerId);
    if (isLastPage) nextButton.disabled = true;
    
    nextButton.addEventListener('click', function(e) {
      e.stopPropagation();
      if (!isLastPage) {
        handlePaginationClick(layerId, currentPage + 1);
      }
    });

    wrapper.appendChild(prevButton);
    wrapper.appendChild(pageInfo);
    wrapper.appendChild(nextButton);

    return wrapper;
  }

  /**
   * Handle pagination button clicks - send message to parent
   */
  function handlePaginationClick(layerId, page) {
    // Get current pagination state for this layer
    const state = paginationState[layerId];
    const meta = state?.meta;
    
    // Update local state for immediate feedback
    if (state) {
      state.loading = true;
    }
    
    // Send message to parent with full context for fetching
    sendToParent('PAGINATION_PAGE_CHANGE', { 
      layerId, 
      page,
      // Include context so parent doesn't need pre-existing state
      collectionId: meta?.collectionId,
      itemsPerPage: meta?.itemsPerPage || 10,
    });
    
    // Re-render to show loading state
    render();
  }

  /**
   * Render layer tree
   */
  function render() {
    root.innerHTML = '';

    if (layers.length === 0) {
      root.innerHTML = '<div style="padding: 40px; text-align: center; color: #9ca3af;">No layers to display</div>';
      // Report height even for empty state
      reportContentHeight();
      return;
    }

    // Compute page collection counts for visibility evaluation
    const pageCollectionCounts = computePageCollectionCounts(layers);

    layers.forEach(layer => {
      const element = renderLayer(layer, undefined, undefined, pageCollectionCounts);
      if (element) {
        root.appendChild(element);
      }
    });

    // Report content height after render
    reportContentHeight();

    // Render gap indicators as overlays
    requestAnimationFrame(() => {
      renderGapIndicators();
    });
  }

  /**
   * Render a single layer and its children
   */
  function renderLayer(layer, collectionItemData, parentCollectionId, pageCollectionCounts) {
    // Skip hidden layers
    if (layer.settings && layer.settings.hidden) {
      return null;
    }

    // Evaluate conditional visibility
    const conditionalVisibility = layer.variables?.conditionalVisibility;
    if (conditionalVisibility) {
      const inheritedItemData = collectionItemData || (pageCollectionItem ? pageCollectionItem.values : undefined);
      const isVisible = evaluateVisibility(conditionalVisibility, {
        collectionItemData: inheritedItemData,
        pageCollectionCounts: pageCollectionCounts || {},
      });
      if (!isVisible) {
        return null;
      }
    }

    // Check if this layer has a collection binding (not based on name or type)
    const collectionVariable = layer.variables?.collection || layer.collection || null;
    const isCollectionLayer = !!collectionVariable;
    const collectionId = collectionVariable?.id;

    // Use parent collection ID if not a collection layer itself
    const activeCollectionId = collectionId || parentCollectionId;

    // Debug logging for collection layers
    if (isCollectionLayer) {
      console.log('[Canvas] Collection Layer Detected', {
        layerId: layer.id,
        collectionId,
        collectionVariable,
        hasChildren: !!(layer.children && layer.children.length > 0)
      });
    }

    const tag = getLayerHtmlTag(layer);
    const inheritedCollectionItemData = collectionItemData || (pageCollectionItem ? pageCollectionItem.values : undefined);
    const element = document.createElement(tag);

    // Set ID
    element.setAttribute('data-layer-id', layer.id);
    element.setAttribute('data-layer-type', tag);

    // Apply classes
    const classes = getClassesString(layer);
    if (classes) {
      element.className = classes;
    }

    // Add editor class in edit mode
    if (editMode) {
      element.classList.add('ycode-layer');
    }

    // Body layer should fill the iframe (better UX)
    if (layer.id === 'body') {
      element.style.minHeight = '100%';
    }

    // Apply custom ID from settings
    if (layer.settings && layer.settings.id) {
      element.id = layer.settings.id;
    }

    // Apply custom attributes
    if (layer.settings && layer.settings.customAttributes) {
      Object.entries(layer.settings.customAttributes).forEach(([name, value]) => {
        element.setAttribute(name, value);
      });
    }

    // Handle special elements
    if (tag === 'img') {
      element.src = layer.url || '';
      element.alt = layer.alt || 'Image';
    } else if (tag === 'a' && layer.settings && layer.settings.linkSettings) {
      element.href = layer.settings.linkSettings.href || '#';
      if (layer.settings.linkSettings.target) {
        element.target = layer.settings.linkSettings.target;
      }
      if (layer.settings.linkSettings.rel) {
        element.rel = layer.settings.linkSettings.rel;
      }
    }

    // Add text content
    const textContent = getText(layer, inheritedCollectionItemData, activeCollectionId);
    const hasChildren = layer.children && layer.children.length > 0;

    if (textContent && !hasChildren) {
      element.textContent = textContent;
    }

    // Render children - handle collection layers specially
    if (hasChildren) {
      if (isCollectionLayer && collectionId) {
        // Collection layer: repeat the element itself for each item (not a wrapper)
        let items = collectionLayerData[layer.id] || [];
        
        // Filter items by reference field if source_field_id is set
        const sourceFieldId = collectionVariable?.source_field_id;
        const sourceFieldType = collectionVariable?.source_field_type;
        
        if (sourceFieldId && collectionItemData) {
          const refValue = collectionItemData[sourceFieldId];
          if (refValue) {
            if (sourceFieldType === 'reference') {
              // Single reference: filter to just the one referenced item
              items = items.filter(item => item.id === refValue);
            } else {
              // Multi-reference: parse JSON array and filter
              try {
                const allowedIds = JSON.parse(refValue);
                if (Array.isArray(allowedIds)) {
                  items = items.filter(item => allowedIds.includes(item.id));
                }
              } catch {
                items = [];
              }
            }
          } else {
            // No value in parent item for this field - show no items
            items = [];
          }
        }

        // Apply collection filters (evaluate against each item's own values)
        const collectionFilters = collectionVariable?.filters;
        if (collectionFilters?.groups?.length) {
          items = items.filter(item => 
            evaluateVisibility(collectionFilters, {
              collectionItemData: item.values,
              pageCollectionCounts: {},
            })
          );
        }

        // Check for pagination settings
        const paginationConfig = collectionVariable?.pagination;
        const isPaginated = paginationConfig?.enabled && paginationConfig?.mode === 'pages';
        let paginationMeta = null;
        
        if (isPaginated) {
          // Check if we have cached pagination data from parent
          const cachedState = paginationState[layer.id];
          const cachedItems = paginationDataCache[layer.id];
          
          if (cachedItems) {
            items = cachedItems;
            paginationMeta = cachedState?.meta;
          } else {
            // Apply local pagination for preview
            const itemsPerPage = paginationConfig.items_per_page || 10;
            const currentPage = cachedState?.page || 1;
            const offset = (currentPage - 1) * itemsPerPage;
            const totalItems = items.length;
            const totalPages = Math.ceil(totalItems / itemsPerPage);
            
            // Slice items for current page
            items = items.slice(offset, offset + itemsPerPage);
            
            paginationMeta = {
              currentPage,
              totalPages,
              totalItems,
              itemsPerPage,
              layerId: layer.id,
              collectionId
            };
            
            // Initialize pagination state if not exists
            if (!paginationState[layer.id]) {
              paginationState[layer.id] = { page: 1, loading: false, meta: paginationMeta };
            }
          }
        }

        console.log('[Canvas] Rendering collection layer', {
          layerId: layer.id,
          isPaginated,
          paginationMeta,
          collectionId,
          itemsCount: items.length,
          hasLayerData: !!collectionLayerData[layer.id],
          sourceFieldId,
          sourceFieldType,
          hasParentData: !!collectionItemData
        });

        if (items.length > 0) {
          // Create a fragment to hold multiple repeated elements
          const fragment = document.createDocumentFragment();

          items.forEach((item, index) => {
            // Clone the element for each item (element already has all styles/classes)
            const itemElement = element.cloneNode(false); // Shallow clone (no children)
            itemElement.setAttribute('data-collection-item-id', item.id);

            // Render children inside each item element
            layer.children.forEach(child => {
              const childElement = renderLayer(child, item.values, activeCollectionId, pageCollectionCounts);
              if (childElement) {
                itemElement.appendChild(childElement);
              }
            });

            // Add event listeners and selection state to each item
            if (editMode) {
              addEventListeners(itemElement, layer);

              if (selectedLayerId === layer.id) {
                const selectionClass = editingComponentId ? 'ycode-selected-purple' : 'ycode-selected';
                itemElement.classList.add(selectionClass);
              }
            }

            fragment.appendChild(itemElement);
          });

          // Add pagination wrapper if pagination is enabled and there are multiple pages
          if (isPaginated && paginationMeta && paginationMeta.totalPages > 1) {
            const paginationWrapper = createPaginationWrapper(layer.id, paginationMeta);
            fragment.appendChild(paginationWrapper);
          }

          // Return the fragment instead of single element
          // Mark this as a collection render so caller knows to append fragment
          return fragment;
        } else if (editMode) {
          // Show skeleton placeholder in edit mode when no data yet
          const skeleton = document.createElement('div');
          skeleton.className = 'p-4';
          skeleton.innerHTML = `
            <div style="width: 100%; height: 60px; background: linear-gradient(90deg, #f4f4f5 0%, #e4e4e7 50%, #f4f4f5 100%); background-size: 200% 100%; animation: shimmer 2s infinite; border-radius: 0.5rem; margin-bottom: 1rem;"></div>
            <div style="width: 100%; height: 60px; background: linear-gradient(90deg, #f4f4f5 0%, #e4e4e7 50%, #f4f4f5 100%); background-size: 200% 100%; animation: shimmer 2s infinite; border-radius: 0.5rem; margin-bottom: 1rem;"></div>
            <div style="width: 100%; height: 60px; background: linear-gradient(90deg, #f4f4f5 0%, #e4e4e7 50%, #f4f4f5 100%); background-size: 200% 100%; animation: shimmer 2s infinite; border-radius: 0.5rem;"></div>
            <style>
              @keyframes shimmer {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
              }
            </style>
          `;
          element.appendChild(skeleton);
        }
      } else {
        // Regular rendering: just render children normally
        layer.children.forEach(child => {
          const childElement = renderLayer(child, inheritedCollectionItemData, activeCollectionId, pageCollectionCounts);
          if (childElement) {
            element.appendChild(childElement);
          }
        });
      }
    }

    // Add event listeners in edit mode
    if (editMode) {
      addEventListeners(element, layer);
    }

    // Apply selection state
    if (selectedLayerId === layer.id) {
      const selectionClass = editingComponentId ? 'ycode-selected-purple' : 'ycode-selected';
      element.classList.add(selectionClass);
      // addSelectionBadge(element, tag, !!editingComponentId);
    }

    return element;
  }

  /**
   * Add event listeners to layer element
   */
  function addEventListeners(element, layer) {
    // Click to select
    element.addEventListener('click', function(e) {
      e.stopPropagation();

      // Ensure iframe can receive keyboard events by focusing the body
      if (document.body && document.body !== document.activeElement) {
        document.body.focus();
      }

      // If this layer is part of a component (and we're NOT editing it), select the component root instead
      const componentRootId = componentMap[layer.id];
      const isPartOfComponent = !!componentRootId;
      const isEditingThisComponent = editingComponentId && componentRootId === editingComponentId;

      let targetLayerId = layer.id;
      if (isPartOfComponent && !isEditingThisComponent) {
        targetLayerId = componentRootId;
      }

      sendToParent('LAYER_CLICK', {
        layerId: targetLayerId,
        metaKey: e.metaKey || e.ctrlKey,
        shiftKey: e.shiftKey
      });
    });

    // Double-click to edit text
    if (isTextEditable(layer)) {
      console.log('[addEventListeners] Attaching double-click handler to layer:', layer.id, layer.name);
      element.addEventListener('dblclick', function(e) {
        e.stopPropagation();

        // Get collection item data for this specific element
        const itemWrapper = element.closest('[data-collection-item-id]');
        const collectionItemId = itemWrapper?.getAttribute('data-collection-item-id');
        let itemData = null;
        let collectionId = null;

        if (collectionItemId) {
          const parentCollectionLayer = findParentCollectionLayerInTree(layer.id);
          collectionId = parentCollectionLayer?.variables?.collection?.id;

          if (collectionId && collectionLayerData[parentCollectionLayer.id]) {
            itemData = collectionLayerData[parentCollectionLayer.id].find(
              item => item.id === collectionItemId
            );
          }
        }

        startTextEditing(layer.id, layer, element, itemData, collectionId);
      });
    } else {
      console.log('[addEventListeners] Layer not text-editable:', layer.id, 'formattable:', layer.formattable);
    }

    // Right-click for context menu
    element.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      e.stopPropagation();
      sendToParent('CONTEXT_MENU', {
        layerId: layer.id,
        x: e.clientX,
        y: e.clientY
      });
    });

    // Hover effects (skip for Body layer - it fills entire iframe)
    element.addEventListener('mouseenter', function(e) {
      if (editingLayerId !== layer.id && layer.id !== 'body') {
        // Check if this layer is part of a component (and we're NOT editing that component)
        const componentRootId = componentMap[layer.id];
        const isPartOfComponent = !!componentRootId;
        const isEditingThisComponent = editingComponentId && componentRootId === editingComponentId;

        if (isPartOfComponent && !isEditingThisComponent) {
          // Find the root component element and apply pink hover to it
          const rootElement = document.querySelector('[data-layer-id="' + componentRootId + '"]');
          if (rootElement) {
            rootElement.classList.add('ycode-component-hover');
          }
        } else {
          // Normal hover - use purple in component edit mode, blue otherwise
          const hoverClass = editingComponentId ? 'ycode-hover-purple' : 'ycode-hover';
          element.classList.add(hoverClass);
        }

        hoveredLayerId = layer.id;
      }
    });

    element.addEventListener('mouseleave', function(e) {
      // Remove both types of hover classes
      element.classList.remove('ycode-hover');
      element.classList.remove('ycode-hover-purple');

      // Remove component hover from root if applicable
      const componentRootId = componentMap[layer.id];
      if (componentRootId) {
        const rootElement = document.querySelector('[data-layer-id="' + componentRootId + '"]');
        if (rootElement) {
          rootElement.classList.remove('ycode-component-hover');
        }
      }

      hoveredLayerId = null;
    });
  }

  /**
   * Check if layer has single inline variable
   */
  function hasSingleInlineVariable(layer) {
    const text = layer.variables?.text;

    if (!text || typeof text !== 'string') {
      return false;
    }

    const regex = /<ycode-inline-variable>[\s\S]*?<\/ycode-inline-variable>/g;
    const matches = text.match(regex);

    if (!matches || matches.length !== 1) {
      return false;
    }

    const withoutVariable = text.replace(regex, '').trim();

    const result = withoutVariable === '';

    return result;
  }

  /**
   * Find parent collection layer by traversing up the tree
   */
  function findParentCollectionLayerInTree(layerId) {
    // Traverse layers tree to find parent collection layer
    function traverse(layerList, targetId) {
      for (const layer of layerList) {
        // Check if this layer is a collection layer containing the target
        if (layer.variables?.collection?.id) {
          if (containsLayerId(layer.children, targetId)) {
            return layer;
          }
        }

        // Recursively check children
        if (layer.children) {
          const found = traverse(layer.children, targetId);
          if (found) return found;
        }
      }
      return null;
    }

    function containsLayerId(layerList, targetId) {
      if (!layerList) return false;
      for (const layer of layerList) {
        if (layer.id === targetId) return true;
        if (layer.children && containsLayerId(layer.children, targetId)) {
          return true;
        }
      }
      return false;
    }

    return traverse(layers, layerId);
  }

  /**
   * Start text editing mode
   */
  function startTextEditing(layerId, layer, element, collectionItemData = null, activeCollectionId = null) {
    if (editingLayerId) return;

    // If layer has variables.text (inline variables), don't allow inline editing
    // This content should only be edited via the Content panel or collection sheet
    if (layer.variables?.text) {
      // Exception: if it's a single variable, open the collection item sheet
      const hasSingle = hasSingleInlineVariable(layer);

      if (hasSingle) {
        // Find the collection item ID from parent wrapper
        const itemWrapper = element.closest('[data-collection-item-id]');
        const collectionItemId = itemWrapper?.getAttribute('data-collection-item-id');

        if (collectionItemId) {
          // Inside a collection layer - use collection layer context
          const parentCollectionLayer = findParentCollectionLayerInTree(layerId);
          const collectionId = parentCollectionLayer?.variables?.collection?.id;

          if (collectionId) {
            // Notify parent to open collection item sheet
            sendToParent('OPEN_COLLECTION_ITEM_SHEET', {
              collectionId,
              itemId: collectionItemId,
            });
            return; // Don't start inline editing
          }
        }

        // Not in collection layer - check if on dynamic page
        if (pageCollectionItem && pageCollectionFields && pageCollectionFields.length > 0) {
          const pageCollectionId = pageCollectionItem.collection_id;
          const pageItemId = pageCollectionItem.id;

          if (pageCollectionId && pageItemId) {
            // Notify parent to open collection item sheet for page item
            sendToParent('OPEN_COLLECTION_ITEM_SHEET', {
              collectionId: pageCollectionId,
              itemId: pageItemId,
            });
            return; // Don't start inline editing
          }
        }
      }

      // For non-single variables or if no collection context, don't allow inline editing
      return;
    }

    editingLayerId = layerId;

    // Remove selection badge if present
    const badge = element.querySelector('.ycode-selection-badge');
    if (badge) {
      badge.remove();
    }

    // Get current text from layer data, not from DOM (to avoid badge text)
    // Pass actual collection data to resolve variables correctly
    const currentText = getText(layer, collectionItemData, activeCollectionId);

    // Create input element
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'ycode-text-editor';
    input.value = currentText;

    // Replace element content with input
    element.textContent = '';
    element.appendChild(input);
    element.classList.add('ycode-editing');

    // Focus and select
    input.focus();
    input.select();

    // Notify parent
    sendToParent('TEXT_CHANGE_START', { layerId });

    // Handle finish editing
    const finishEditing = () => {
      const newText = input.value;
      editingLayerId = null;

      // Notify parent of change
      sendToParent('TEXT_CHANGE_END', {
        layerId,
        text: newText
      });
    };

    input.addEventListener('blur', finishEditing);
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        finishEditing();
      } else if (e.key === 'Escape') {
        editingLayerId = null;
        render();
      }
    });
  }

  /**
   * Update selection state without full re-render
   */
  function updateSelection() {
    // Remove previous selection from ALL layers (both blue and purple)
    document.querySelectorAll('.ycode-layer').forEach(el => {
      el.classList.remove('ycode-selected');
      el.classList.remove('ycode-selected-purple');
      // Remove badge (both types)
      const badge = el.querySelector('.ycode-selection-badge, .ycode-selection-badge-purple');
      if (badge) badge.remove();
    });

    // Add new selection
    if (selectedLayerId) {
      const element = document.querySelector(`[data-layer-id="${selectedLayerId}"]`);
      if (element) {
        const selectionClass = editingComponentId ? 'ycode-selected-purple' : 'ycode-selected';
        element.classList.add(selectionClass);
        const tag = element.getAttribute('data-layer-type');
        // addSelectionBadge(element, tag, !!editingComponentId);
      }
    }

    // Update gap indicators
    requestAnimationFrame(() => {
      renderGapIndicators();
    });
  }

  /**
   * Add selection badge to element
   */
  function addSelectionBadge(element, tag, isPurple) {
    // Remove existing badge (both types)
    const existingBadge = element.querySelector('.ycode-selection-badge, .ycode-selection-badge-purple');
    if (existingBadge) existingBadge.remove();

    const badge = document.createElement('span');
    badge.className = isPurple ? 'ycode-selection-badge-purple' : 'ycode-selection-badge';
    badge.textContent = tag.charAt(0).toUpperCase() + tag.slice(1) + ' Selected';

    // Position badge
    element.style.position = element.style.position || 'relative';
    element.appendChild(badge);
  }

  /**
   * Update viewport based on breakpoint
   */
  /**
   * Update UI state - forces visual state for preview
   */
  function updateUIState() {
    // Re-render to apply state classes
    render();
  }

  function updateBreakpoint() {
    // Breakpoint is handled by parent (iframe width)
    // Could add visual indicators here if needed
  }

  /**
   * Highlight drop zone
   */
  function highlightDropZone(layerId) {
    // Remove previous highlights
    document.querySelectorAll('.ycode-drop-target').forEach(el => {
      el.classList.remove('ycode-drop-target');
    });

    // Add new highlight
    if (layerId) {
      const element = document.querySelector(`[data-layer-id="${layerId}"]`);
      if (element) {
        element.classList.add('ycode-drop-target');
      }
    }
  }

  /**
   * Update hover state without full re-render
   */
  function updateHover() {
    // Remove previous hover classes (both types)
    document.querySelectorAll('.ycode-hover, .ycode-hover-purple, .ycode-component-hover').forEach(el => {
      el.classList.remove('ycode-hover');
      el.classList.remove('ycode-hover-purple');
      el.classList.remove('ycode-component-hover');
    });

    // Add new hover
    if (hoveredLayerId && editingLayerId !== hoveredLayerId) {
      const element = document.querySelector(`[data-layer-id="${hoveredLayerId}"]`);
      if (element) {
        // Check if this layer is part of a component (and we're NOT editing that component)
        const componentRootId = componentMap[hoveredLayerId];
        const isPartOfComponent = !!componentRootId;
        const isEditingThisComponent = editingComponentId && componentRootId === editingComponentId;

        if (isPartOfComponent && !isEditingThisComponent) {
          // Find the root component element and apply pink hover to it
          const rootElement = document.querySelector('[data-layer-id="' + componentRootId + '"]');
          if (rootElement) {
            rootElement.classList.add('ycode-component-hover');
          }
        } else {
          // Normal hover - use purple in component edit mode, blue otherwise
          const hoverClass = editingComponentId ? 'ycode-hover-purple' : 'ycode-hover';
          element.classList.add(hoverClass);
        }
      }
    }
  }

  /**
   * Find layer by ID in tree
   */
  function findLayer(layers, id) {
    for (const layer of layers) {
      if (layer.id === id) return layer;
      if (layer.children) {
        const found = findLayer(layer.children, id);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * Setup zoom gesture listeners
   * Captures Ctrl/Cmd + wheel and trackpad pinch gestures and forwards to parent
   */
  function setupZoomListeners() {
    // Keyboard shortcuts for zoom - capture and forward to parent
    document.addEventListener('keydown', function(e) {
      // Delete/Backspace - delete selected layer
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Check if user is typing in an input/textarea
        const target = e.target;
        const isInputFocused = target.tagName === 'INPUT' ||
                               target.tagName === 'TEXTAREA' ||
                               target.isContentEditable;

        // Only delete if not typing and there's a selected layer
        if (!isInputFocused && selectedLayerId) {
          e.preventDefault();
          sendToParent('DELETE_LAYER', null);
          return;
        }
      }

      // Check if Ctrl (Windows/Linux) or Cmd (Mac) is pressed
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;

      if (!isCmdOrCtrl) return;

      // Check for zoom shortcuts
      const isZoomShortcut =
        e.key === '+' ||
        e.key === '=' ||
        e.key === '-' ||
        e.key === '_' ||
        e.key === '0' ||
        e.key === '1' ||
        e.key === '2';

      if (!isZoomShortcut) return;

      // ALWAYS prevent default to stop browser zoom
      e.preventDefault();
      e.stopPropagation();

      // Send zoom command to parent based on key
      let delta = 0;
      switch (e.key) {
        case '+':
        case '=':
          delta = 100; // Zoom in
          break;
        case '-':
        case '_':
          delta = -100; // Zoom out
          break;
        case '0':
          delta = 0; // This will be handled specially
          sendToParent('ZOOM_GESTURE', { delta: 0, reset: true });
          return;
        case '1':
          sendToParent('ZOOM_GESTURE', { delta: 0, zoomToFit: true });
          return;
        case '2':
          sendToParent('ZOOM_GESTURE', { delta: 0, autofit: true });
          return;
      }

      if (delta !== 0) {
        sendToParent('ZOOM_GESTURE', { delta: delta });
      }
    }, true); // Use capture phase to intercept before other handlers

    // Wheel event for Ctrl/Cmd + wheel zoom (includes trackpad pinch)
    // MUST prevent native browser zoom
    document.addEventListener('wheel', function(e) {
      // Check if Ctrl (Windows/Linux) or Cmd (Mac) is pressed
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        // Send zoom delta to parent
        // Positive deltaY means zoom out, negative means zoom in
        // We'll send a normalized delta that the parent can interpret
        const delta = -e.deltaY; // Invert so positive = zoom in
        sendToParent('ZOOM_GESTURE', { delta });

        return false; // Extra prevention
      }
    }, { passive: false, capture: true }); // passive: false allows preventDefault, capture: true for early interception

    // Safari gesture events - prevent native zoom
    document.addEventListener('gesturestart', function(e) {
      e.preventDefault();
      e.stopPropagation();
    }, { passive: false, capture: true });

    document.addEventListener('gesturechange', function(e) {
      e.preventDefault();
      e.stopPropagation();
    }, { passive: false, capture: true });

    // Track pinch gesture state
    let lastTouchDistance = null;

    // Touch start - track initial distance
    document.addEventListener('touchstart', function(e) {
      if (e.touches.length === 2) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        lastTouchDistance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );
      }
    }, { passive: true });

    // Touch move - detect pinch
    document.addEventListener('touchmove', function(e) {
      if (e.touches.length === 2 && lastTouchDistance !== null) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const currentDistance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );

        // Calculate delta
        const delta = (currentDistance - lastTouchDistance) * 2; // Scale for responsiveness

        // Send to parent
        sendToParent('ZOOM_GESTURE', { delta });

        // Update for next frame
        lastTouchDistance = currentDistance;
      }
    }, { passive: true });

    // Touch end - reset
    document.addEventListener('touchend', function(e) {
      if (e.touches.length < 2) {
        lastTouchDistance = null;
      }
    }, { passive: true });
  }

  // Initialize - notify parent that iframe is ready
  sendToParent('READY', null);

  // Make body focusable to receive keyboard events
  if (document.body) {
    document.body.setAttribute('tabindex', '-1');
    // Focus the body initially so keyboard events work immediately
    document.body.focus();
  }

  // Setup zoom listeners
  setupZoomListeners();

})();
