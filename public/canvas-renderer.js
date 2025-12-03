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
        const value = collectionItemData[fieldId];
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
                  // Collection item data has values in a nested object
                  const value = collectionItemData.values?.[fieldId] ?? collectionItemData[fieldId];
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

    layers.forEach(layer => {
      const element = renderLayer(layer);
      if (element) {
        root.appendChild(element);
      }
    });
    
    // Report content height after render
    reportContentHeight();
  }

  /**
   * Render a single layer and its children
   */
  function renderLayer(layer, collectionItemData, parentCollectionId) {
    // Skip hidden layers
    if (layer.settings && layer.settings.hidden) {
      return null;
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
        // Collection layer: use layer-specific data instead of global collection items
        const items = collectionLayerData[layer.id] || [];

        console.log('[Canvas] Rendering collection layer', {
          layerId: layer.id,
          collectionId,
          itemsCount: items.length,
          hasLayerData: !!collectionLayerData[layer.id]
        });

        if (items.length > 0) {
          items.forEach((item) => {
            const itemWrapper = document.createElement('div');
            itemWrapper.setAttribute('data-collection-item-id', item.id);

            layer.children.forEach(child => {
              const childElement = renderLayer(child, item.values, activeCollectionId);
              if (childElement) {
                itemWrapper.appendChild(childElement);
              }
            });

            element.appendChild(itemWrapper);
          });
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
          const childElement = renderLayer(child, inheritedCollectionItemData, activeCollectionId);
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
  
  // Setup zoom listeners
  setupZoomListeners();

})();
