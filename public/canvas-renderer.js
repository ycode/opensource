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
        
      case 'HIGHLIGHT_DROP_ZONE':
        highlightDropZone(message.payload.layerId);
        break;
    }
  });
  
  /**
   * Get HTML tag for layer
   */
  function getHtmlTag(layer) {
    // Check for custom tag in settings
    if (layer.settings && layer.settings.tag) {
      return layer.settings.tag;
    }
    
    // Map layer type to HTML tag
    if (layer.name) {
      return layer.name;
    }
    
    switch (layer.type) {
      case 'heading':
        return 'h2';
      case 'text':
        return 'p';
      case 'image':
        return 'img';
      case 'container':
      default:
        return 'div';
    }
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
   * Get text content from layer
   */
  function getText(layer) {
    return layer.text || layer.content || '';
  }
  
  /**
   * Check if layer can be text-edited
   */
  function isTextEditable(layer) {
    // Check if explicitly marked as formattable
    if (layer.formattable) return true;
    
    // Check layer type (legacy)
    if (layer.type === 'text' || layer.type === 'heading') return true;
    
    // Check HTML tag name (new templates use 'name' property)
    const tag = layer.name || layer.type || '';
    const editableTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'a', 'button', 'label'];
    
    return editableTags.includes(tag);
  }
  
  /**
   * Render layer tree
   */
  function render() {
    root.innerHTML = '';
    
    if (layers.length === 0) {
      root.innerHTML = '<div style="padding: 40px; text-align: center; color: #9ca3af;">No layers to display</div>';
      return;
    }
    
    layers.forEach(layer => {
      const element = renderLayer(layer);
      if (element) {
        root.appendChild(element);
      }
    });
  }
  
  /**
   * Render a single layer and its children
   */
  function renderLayer(layer) {
    // Skip hidden layers
    if (layer.settings && layer.settings.hidden) {
      return null;
    }
    
    const tag = getHtmlTag(layer);
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
    const textContent = getText(layer);
    const hasChildren = layer.children && layer.children.length > 0;
    
    if (textContent && !hasChildren) {
      element.textContent = textContent;
    }
    
    // Render children
    if (hasChildren) {
      layer.children.forEach(child => {
        const childElement = renderLayer(child);
        if (childElement) {
          element.appendChild(childElement);
        }
      });
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
      element.addEventListener('dblclick', function(e) {
        e.stopPropagation();
        startTextEditing(layer.id, layer, element);
      });
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
    
    // Hover effects
    element.addEventListener('mouseenter', function(e) {
      if (editingLayerId !== layer.id) {
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
   * Start text editing mode
   */
  function startTextEditing(layerId, layer, element) {
    if (editingLayerId) return;
    
    editingLayerId = layerId;
    
    // Remove selection badge if present
    const badge = element.querySelector('.ycode-selection-badge');
    if (badge) {
      badge.remove();
    }
    
    // Get current text from layer data, not from DOM (to avoid badge text)
    const currentText = getText(layer);
    
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
    // Remove previous selection (both blue and purple)
    document.querySelectorAll('.ycode-selected, .ycode-selected-purple').forEach(el => {
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
  
  // Initialize - notify parent that iframe is ready
  sendToParent('READY', null);
  
})();
