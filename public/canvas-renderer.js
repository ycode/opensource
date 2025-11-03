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
   * Get classes string from layer
   */
  function getClassesString(layer) {
    if (Array.isArray(layer.classes)) {
      return layer.classes.join(' ');
    }
    return layer.classes || '';
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
      element.classList.add('ycode-selected');
      addSelectionBadge(element, tag);
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
      sendToParent('LAYER_CLICK', {
        layerId: layer.id,
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
        element.classList.add('ycode-hover');
        hoveredLayerId = layer.id;
      }
    });
    
    element.addEventListener('mouseleave', function(e) {
      element.classList.remove('ycode-hover');
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
    // Remove previous selection
    document.querySelectorAll('.ycode-selected').forEach(el => {
      el.classList.remove('ycode-selected');
      // Remove badge
      const badge = el.querySelector('.ycode-selection-badge');
      if (badge) badge.remove();
    });
    
    // Add new selection
    if (selectedLayerId) {
      const element = document.querySelector(`[data-layer-id="${selectedLayerId}"]`);
      if (element) {
        element.classList.add('ycode-selected');
        const tag = element.getAttribute('data-layer-type');
        addSelectionBadge(element, tag);
      }
    }
  }
  
  /**
   * Add selection badge to element
   */
  function addSelectionBadge(element, tag) {
    // Remove existing badge
    const existingBadge = element.querySelector('.ycode-selection-badge');
    if (existingBadge) existingBadge.remove();
    
    const badge = document.createElement('span');
    badge.className = 'ycode-selection-badge';
    badge.textContent = tag.charAt(0).toUpperCase() + tag.slice(1) + ' Selected';
    
    // Position badge
    element.style.position = element.style.position || 'relative';
    element.appendChild(badge);
  }
  
  /**
   * Update viewport based on breakpoint
   */
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

