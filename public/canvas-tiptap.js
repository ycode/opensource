/**
 * YCode Canvas Tiptap Editor Module
 * Handles rich text editing with Tiptap
 * Separated from canvas-renderer.js for better code organization
 */

export function createTiptapModule(dependencies) {
  const {
    sendToParent,
    getConstants,
    findLayer,
    resolveReferenceFieldValue,
    getCollectionFields,
    getPageCollectionFields,
    getEditingLayerId,
    setEditingLayerId,
    getSelectedLayerId,
    setSelectedLayerId,
    updateSelection,
    render,
    collectionLayerData,
    findParentCollectionLayerInTree,
    pageCollectionItem,
  } = dependencies;

  // Tiptap modules (loaded dynamically)
  let TiptapEditor = null;
  let TiptapStarterKit = null;
  let TiptapTextStyle = null;
  let TiptapColor = null;
  let TiptapPlaceholder = null;
  let TiptapParagraph = null;
  let DynamicVariableExtension = null;
  let tiptapLoaded = false;
  let tiptapLoadingPromise = null;

  // State
  let activeRichTextEditor = null;
  let editingLayerId = null;

  /**
   * Load Tiptap modules dynamically (only when needed)
   */
  async function loadTiptap() {
    if (tiptapLoaded) return true;
    if (tiptapLoadingPromise) return tiptapLoadingPromise;

    tiptapLoadingPromise = (async () => {
      try {
        const [
          coreModule,
          starterKitModule,
          textStyleModule,
          colorModule,
          placeholderModule
        ] = await Promise.all([
          import('@tiptap/core'),
          import('@tiptap/starter-kit'),
          import('@tiptap/extension-text-style'),
          import('@tiptap/extension-color'),
          import('@tiptap/extension-placeholder')
        ]);

        TiptapEditor = coreModule.Editor;
        TiptapStarterKit = starterKitModule.default || starterKitModule.StarterKit;
        TiptapTextStyle = textStyleModule.default || textStyleModule.TextStyle;
        TiptapColor = colorModule.default || colorModule.Color;
        TiptapPlaceholder = placeholderModule.default || placeholderModule.Placeholder;

        // Create custom paragraph extension that renders as <span class="block">
        TiptapParagraph = coreModule.Node.create({
          name: 'paragraph',
          priority: 1000,
          group: 'block',
          content: 'inline*',

          parseHTML() {
            return [
              { tag: 'p' },
              { tag: 'span.block' }
            ];
          },

          renderHTML({ HTMLAttributes }) {
            return ['span', { class: 'block', ...HTMLAttributes }, 0];
          },

          addCommands() {
            return {
              setParagraph: () => ({ commands }) => {
                return commands.setNode(this.name);
              },
            };
          },

          addKeyboardShortcuts() {
            return {
              'Mod-Alt-0': () => this.editor.commands.setParagraph(),
            };
          },
        });

        // Custom mark extensions that render using Tailwind classes
        const CustomBold = coreModule.Mark.create({
          name: 'bold',
          parseHTML() {
            return [
              { tag: 'strong' },
              { tag: 'b', getAttrs: node => node.style.fontWeight !== 'normal' && null },
              { style: 'font-weight', getAttrs: value => /^(bold(er)?|[5-9]\d{2,})$/.test(value) && null },
              { tag: 'span.font-bold' }
            ];
          },
          renderHTML({ HTMLAttributes }) {
            return ['span', { class: 'font-bold', ...HTMLAttributes }, 0];
          },
          addCommands() {
            return {
              setBold: () => ({ commands }) => commands.setMark(this.name),
              toggleBold: () => ({ commands }) => commands.toggleMark(this.name),
              unsetBold: () => ({ commands }) => commands.unsetMark(this.name),
            };
          },
          addKeyboardShortcuts() {
            return {
              'Mod-b': () => this.editor.commands.toggleBold(),
              'Mod-B': () => this.editor.commands.toggleBold(),
            };
          },
        });

        const CustomItalic = coreModule.Mark.create({
          name: 'italic',
          parseHTML() {
            return [
              { tag: 'em' },
              { tag: 'i' },
              { style: 'font-style=italic' },
              { tag: 'span.italic' }
            ];
          },
          renderHTML({ HTMLAttributes }) {
            return ['span', { class: 'italic', ...HTMLAttributes }, 0];
          },
          addCommands() {
            return {
              setItalic: () => ({ commands }) => commands.setMark(this.name),
              toggleItalic: () => ({ commands }) => commands.toggleMark(this.name),
              unsetItalic: () => ({ commands }) => commands.unsetMark(this.name),
            };
          },
          addKeyboardShortcuts() {
            return {
              'Mod-i': () => this.editor.commands.toggleItalic(),
              'Mod-I': () => this.editor.commands.toggleItalic(),
            };
          },
        });

        const CustomUnderline = coreModule.Mark.create({
          name: 'underline',
          parseHTML() {
            return [
              { tag: 'u' },
              { style: 'text-decoration=underline' },
              { tag: 'span.underline' }
            ];
          },
          renderHTML({ HTMLAttributes }) {
            return ['span', { class: 'underline', ...HTMLAttributes }, 0];
          },
          addCommands() {
            return {
              setUnderline: () => ({ commands }) => commands.setMark(this.name),
              toggleUnderline: () => ({ commands }) => commands.toggleMark(this.name),
              unsetUnderline: () => ({ commands }) => commands.unsetMark(this.name),
            };
          },
          addKeyboardShortcuts() {
            return {
              'Mod-u': () => this.editor.commands.toggleUnderline(),
              'Mod-U': () => this.editor.commands.toggleUnderline(),
            };
          },
        });

        const CustomStrike = coreModule.Mark.create({
          name: 'strike',
          parseHTML() {
            return [
              { tag: 's' },
              { tag: 'del' },
              { tag: 'strike' },
              { style: 'text-decoration=line-through' },
              { tag: 'span.line-through' }
            ];
          },
          renderHTML({ HTMLAttributes }) {
            return ['span', { class: 'line-through', ...HTMLAttributes }, 0];
          },
          addCommands() {
            return {
              setStrike: () => ({ commands }) => commands.setMark(this.name),
              toggleStrike: () => ({ commands }) => commands.toggleMark(this.name),
              unsetStrike: () => ({ commands }) => commands.unsetMark(this.name),
            };
          },
          addKeyboardShortcuts() {
            return {
              'Mod-Shift-x': () => this.editor.commands.toggleStrike(),
            };
          },
        });

        const CustomCode = coreModule.Mark.create({
          name: 'code',
          parseHTML() {
            return [
              { tag: 'code' },
              { tag: 'span.font-mono' }
            ];
          },
          renderHTML({ HTMLAttributes }) {
            return ['span', { class: 'font-mono bg-muted px-1 py-0.5 rounded text-sm', ...HTMLAttributes }, 0];
          },
          addCommands() {
            return {
              setCode: () => ({ commands }) => commands.setMark(this.name),
              toggleCode: () => ({ commands }) => commands.toggleMark(this.name),
              unsetCode: () => ({ commands }) => commands.unsetMark(this.name),
            };
          },
          addKeyboardShortcuts() {
            return {
              'Mod-e': () => this.editor.commands.toggleCode(),
            };
          },
        });

        // Custom list extensions
        const CustomBulletList = coreModule.Node.create({
          name: 'bulletList',
          group: 'block',
          content: 'listItem+',
          parseHTML() {
            return [{ tag: 'ul' }];
          },
          renderHTML({ HTMLAttributes }) {
            return ['ul', { class: 'my-2 pl-6 list-disc', ...HTMLAttributes }, 0];
          },
          addCommands() {
            return {
              toggleBulletList: () => ({ commands }) => {
                return commands.toggleList(this.name, 'listItem');
              },
            };
          },
          addKeyboardShortcuts() {
            return {
              'Mod-Shift-8': () => this.editor.commands.toggleBulletList(),
            };
          },
        });

        const CustomOrderedList = coreModule.Node.create({
          name: 'orderedList',
          group: 'block',
          content: 'listItem+',
          parseHTML() {
            return [{ tag: 'ol' }];
          },
          renderHTML({ HTMLAttributes }) {
            return ['ol', { class: 'my-2 pl-6 list-decimal', ...HTMLAttributes }, 0];
          },
          addCommands() {
            return {
              toggleOrderedList: () => ({ commands }) => {
                return commands.toggleList(this.name, 'listItem');
              },
            };
          },
          addKeyboardShortcuts() {
            return {
              'Mod-Shift-7': () => this.editor.commands.toggleOrderedList(),
            };
          },
        });

        const CustomListItem = coreModule.Node.create({
          name: 'listItem',
          content: 'paragraph block*',
          defining: true,
          parseHTML() {
            return [{ tag: 'li' }];
          },
          renderHTML({ HTMLAttributes }) {
            return ['li', { class: 'my-1 pl-1', ...HTMLAttributes }, 0];
          },
          addKeyboardShortcuts() {
            return {
              Enter: () => this.editor.commands.splitListItem(this.name),
              Tab: () => this.editor.commands.sinkListItem(this.name),
              'Shift-Tab': () => this.editor.commands.liftListItem(this.name),
            };
          },
        });

        // Store custom extensions globally for reference
        window.CustomBold = CustomBold;
        window.CustomItalic = CustomItalic;
        window.CustomUnderline = CustomUnderline;
        window.CustomStrike = CustomStrike;
        window.CustomCode = CustomCode;
        window.CustomBulletList = CustomBulletList;
        window.CustomOrderedList = CustomOrderedList;
        window.CustomListItem = CustomListItem;

        // Custom extension for inline variables
        DynamicVariableExtension = coreModule.Node.create({
          name: 'dynamicVariable',
          group: 'inline',
          inline: true,
          atom: true,

          addAttributes() {
            return {
              variable: { default: null },
              label: { default: 'variable' }
            };
          },

          parseHTML() {
            return [{ tag: 'span.ycode-inline-var' }];
          },

          renderHTML({ node }) {
            const label = node.attrs.label || 'variable';
            return ['span', {
              class: 'ycode-inline-var',
              'data-variable': JSON.stringify(node.attrs.variable),
              contenteditable: 'false'
            }, label];
          }
        });

        tiptapLoaded = true;
        console.log('[Canvas] Tiptap loaded successfully');
        return true;
      } catch (error) {
        console.error('[Canvas] Tiptap loaded:', error);
        return false;
      }
    })();

    return tiptapLoadingPromise;
  }

  /**
   * Convert Tiptap JSON to plain text with inline variable tags
   */
  function tiptapJsonToPlainText(json) {
    if (!json || !json.content) return '';

    let result = '';
    function processNode(node) {
      if (node.type === 'text') {
        result += node.text || '';
      } else if (node.type === 'dynamicVariable') {
        if (node.attrs && node.attrs.variable) {
          result += '<ycode-inline-variable>' + JSON.stringify(node.attrs.variable) + '</ycode-inline-variable>';
        }
      } else if (node.content) {
        node.content.forEach(processNode);
      }
    }

    if (json.content) {
      json.content.forEach(processNode);
    }
    return result;
  }

  /**
   * Render Tiptap JSON to HTML with formatting
   */
  function renderTiptapJsonToHtml(json, collectionItemData, collectionId, textStyles) {
    if (!json || !json.content) return '';

    const constants = getConstants();
    const DEFAULT_TEXT_STYLES = constants?.textStyles || {};
    const mergedTextStyles = Object.assign({}, DEFAULT_TEXT_STYLES, textStyles || {});

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function processNode(node) {
      if (node.type === 'paragraph') {
        const pContent = node.content ? node.content.map(processNode).join('') : '';
        return '<span class="block">' + (pContent || '<br>') + '</span>';
      } else if (node.type === 'text') {
        let text = escapeHtml(node.text || '');

        if (node.marks) {
          node.marks.forEach(function(mark) {
            const styleConfig = mergedTextStyles[mark.type];

            if (styleConfig && styleConfig.classes) {
              text = '<span class="' + styleConfig.classes + '">' + text + '</span>';
            } else {
              switch (mark.type) {
                case 'bold':
                  text = '<strong>' + text + '</strong>';
                  break;
                case 'italic':
                  text = '<em>' + text + '</em>';
                  break;
                case 'underline':
                  text = '<u>' + text + '</u>';
                  break;
                case 'strike':
                  text = '<s>' + text + '</s>';
                  break;
                case 'code':
                  text = '<code>' + text + '</code>';
                  break;
              }
            }
          });
        }

        return text;
      } else if (node.type === 'dynamicVariable') {
        const variable = node.attrs && node.attrs.variable;
        if (variable && variable.type === 'field' && variable.data && variable.data.field_id && collectionItemData) {
          const itemValues = collectionItemData.values || collectionItemData;
          const fieldId = variable.data.field_id;
          const relationships = variable.data.relationships || [];

          let value = '';
          if (relationships.length > 0) {
            value = resolveReferenceFieldValue(fieldId, relationships, itemValues, collectionId) || '';
          } else {
            value = itemValues[fieldId] || '';
          }

          return escapeHtml(value);
        }
        const label = (node.attrs && node.attrs.label) || 'variable';
        return '<span class="ycode-inline-var">' + escapeHtml(label) + '</span>';
      } else if (node.type === 'bulletList') {
        const ulContent = node.content ? node.content.map(processNode).join('') : '';
        const listStyle = mergedTextStyles['bulletList'];
        const classes = listStyle && listStyle.classes ? ' class="' + escapeHtml(listStyle.classes) + '"' : '';
        return '<ul' + classes + '>' + ulContent + '</ul>';
      } else if (node.type === 'orderedList') {
        const olContent = node.content ? node.content.map(processNode).join('') : '';
        const listStyle = mergedTextStyles['orderedList'];
        const classes = listStyle && listStyle.classes ? ' class="' + escapeHtml(listStyle.classes) + '"' : '';
        return '<ol' + classes + '>' + olContent + '</ol>';
      } else if (node.type === 'listItem') {
        const liContent = node.content ? node.content.map(processNode).join('') : '';
        const listStyle = mergedTextStyles['listItem'];
        const classes = listStyle && listStyle.classes ? ' class="' + escapeHtml(listStyle.classes) + '"' : '';
        return '<li' + classes + '>' + liContent + '</li>';
      } else if (node.content) {
        return node.content.map(processNode).join('');
      }

      return '';
    }

    let result = '';
    if (json.content) {
      const blocks = [];
      json.content.forEach(function(block) {
        if (block.type === 'paragraph') {
          blocks.push(processNode(block));
        } else if (block.type === 'bulletList' || block.type === 'orderedList') {
          blocks.push(processNode(block));
        } else if (block.content) {
          blocks.push(block.content.map(processNode).join(''));
        }
      });

      result = blocks.join('');
    }
    return result;
  }

  /**
   * Check if content is Tiptap JSON format
   */
  function isTiptapContent(content) {
    return (
      typeof content === 'object' &&
      content !== null &&
      content.type === 'doc' &&
      Array.isArray(content.content)
    );
  }

  /**
   * Check if a layer has a single inline variable only
   */
  function hasSingleInlineVariable(layer) {
    const textVariable = layer.variables?.text;
    if (!textVariable || textVariable.type !== 'dynamic_text') return false;

    const content = textVariable.data.content;
    if (!isTiptapContent(content)) return false;

    if (!content.content || content.content.length !== 1) return false;

    const firstBlock = content.content[0];
    if (firstBlock.type !== 'paragraph') return false;
    if (!firstBlock.content || firstBlock.content.length !== 1) return false;

    const firstInline = firstBlock.content[0];
    return firstInline.type === 'dynamicVariable';
  }

  /**
   * Insert a variable into the active editor
   */
  function insertVariable(variable, label) {
    if (!activeRichTextEditor) return;

    activeRichTextEditor.chain()
      .focus()
      .insertContent({
        type: 'dynamicVariable',
        attrs: { variable, label }
      })
      .insertContent(' ')
      .run();
  }

  /**
   * Parse text with inline variables to Tiptap JSON
   */
  function parseTextToTiptapJson(text, fields) {
    if (!text) {
      return { type: 'doc', content: [{ type: 'paragraph' }] };
    }

    if (typeof text === 'object' && text.type === 'doc') {
      return text;
    }

    const content = [];
    const regex = /<ycode-inline-variable(?:\s+id="([^"]+)")?>([\s\S]*?)<\/ycode-inline-variable>/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        const textBefore = text.slice(lastIndex, match.index);
        if (textBefore) {
          content.push({ type: 'text', text: textBefore });
        }
      }

      const variableContent = match[2].trim();
      try {
        const variable = JSON.parse(variableContent);
        const label = getVariableLabelFromFields(variable, fields);
        content.push({
          type: 'dynamicVariable',
          attrs: { variable, label }
        });
      } catch {
        content.push({ type: 'text', text: match[0] });
      }

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      content.push({ type: 'text', text: text.slice(lastIndex) });
    }

    return {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: content.length > 0 ? content : undefined
      }]
    };
  }

  /**
   * Get variable label from fields
   */
  function getVariableLabelFromFields(variable, fields) {
    if (!variable || variable.type !== 'field' || !variable.data?.field_id) {
      return 'variable';
    }

    const allFieldSources = [
      ...(fields || []),
      ...Object.values(getCollectionFields?.() || {}).flat(),
      ...(getPageCollectionFields?.() || [])
    ];

    const field = allFieldSources.find(f => f.id === variable.data.field_id);
    return field?.name || variable.data.field_id.slice(0, 8);
  }

  /**
   * Create floating toolbar
   */
  function createToolbar() {
    let toolbar = document.getElementById('ycode-richtext-toolbar');
    if (toolbar) return toolbar;

    toolbar = document.createElement('div');
    toolbar.id = 'ycode-richtext-toolbar';
    toolbar.className = 'ycode-toolbar';
    const constants = getConstants();
    const icons = constants?.toolbarIcons || {};
    toolbar.innerHTML = `
      <button type="button" class="ycode-toolbar-btn" data-action="bold" title="Bold (Cmd+B)">${icons.bold || ''}</button>
      <button type="button" class="ycode-toolbar-btn" data-action="italic" title="Italic (Cmd+I)">${icons.italic || ''}</button>
      <button type="button" class="ycode-toolbar-btn" data-action="underline" title="Underline (Cmd+U)">${icons.underline || ''}</button>
      <button type="button" class="ycode-toolbar-btn" data-action="strike" title="Strikethrough">${icons.strike || ''}</button>
      <div class="ycode-toolbar-divider"></div>
      <button type="button" class="ycode-toolbar-btn" data-action="bulletList" title="Bullet List">${icons.bulletList || ''}</button>
      <button type="button" class="ycode-toolbar-btn" data-action="orderedList" title="Numbered List">${icons.orderedList || ''}</button>
      <div class="ycode-toolbar-divider"></div>
      <button type="button" class="ycode-toolbar-btn" data-action="variable" title="Insert Variable">${icons.variable || ''}</button>
    `;

    document.body.appendChild(toolbar);

    toolbar.addEventListener('mousedown', function(e) {
      e.preventDefault();
      const btn = e.target.closest('[data-action]');
      if (!btn || !activeRichTextEditor) return;

      const editor = activeRichTextEditor;
      const action = btn.dataset.action;

      switch (action) {
        case 'bold':
          editor.chain().focus().run();
          editor.commands.toggleMark('bold', {}, { extendEmptyMarkRange: true });
          break;
        case 'italic':
          editor.chain().focus().run();
          editor.commands.toggleMark('italic', {}, { extendEmptyMarkRange: true });
          break;
        case 'underline':
          editor.chain().focus().run();
          editor.commands.toggleMark('underline', {}, { extendEmptyMarkRange: true });
          break;
        case 'strike':
          editor.chain().focus().run();
          editor.commands.toggleMark('strike', {}, { extendEmptyMarkRange: true });
          break;
        case 'bulletList':
          editor.chain().focus().toggleBulletList().run();
          break;
        case 'orderedList':
          editor.chain().focus().toggleOrderedList().run();
          break;
        case 'variable':
          sendToParent('REQUEST_VARIABLE_PICKER', { layerId: editingLayerId });
          break;
      }
      updateToolbarState();
    });

    return toolbar;
  }

  /**
   * Update toolbar button active states
   */
  function updateToolbarState() {
    const toolbar = document.getElementById('ycode-richtext-toolbar');
    if (!toolbar || !activeRichTextEditor) return;

    const markActions = ['bold', 'italic', 'underline', 'strike'];
    markActions.forEach(action => {
      const btn = toolbar.querySelector(`[data-action="${action}"]`);
      if (btn) {
        const isActive = activeRichTextEditor.isActive(action);
        btn.classList.toggle('active', isActive);
      }
    });

    const listBtn = toolbar.querySelector('[data-action="bulletList"]');
    if (listBtn) {
      listBtn.classList.toggle('active', activeRichTextEditor.isActive('bulletList'));
    }
    const orderedListBtn = toolbar.querySelector('[data-action="orderedList"]');
    if (orderedListBtn) {
      orderedListBtn.classList.toggle('active', activeRichTextEditor.isActive('orderedList'));
    }
  }

  /**
   * Position toolbar above selection or element
   */
  function positionToolbar(element) {
    const toolbar = document.getElementById('ycode-richtext-toolbar');
    if (!toolbar) return;

    const rect = element.getBoundingClientRect();
    const toolbarWidth = toolbar.offsetWidth || 200;
    const toolbarHeight = toolbar.offsetHeight || 40;

    let left = rect.left + (rect.width / 2) - (toolbarWidth / 2);
    let top = rect.top - toolbarHeight - 8;

    left = Math.max(8, Math.min(left, window.innerWidth - toolbarWidth - 8));
    if (top < 8) {
      top = rect.bottom + 8;
    }

    toolbar.style.left = left + 'px';
    toolbar.style.top = top + 'px';
    toolbar.classList.add('visible');
  }

  /**
   * Hide the floating toolbar
   */
  function hideToolbar() {
    const toolbar = document.getElementById('ycode-richtext-toolbar');
    if (toolbar) {
      toolbar.classList.remove('visible');
    }
  }

  /**
   * Start text editing mode with Tiptap rich text editor
   */
  async function startTextEditing(layerId, layer, element, collectionItemData = null, activeCollectionId = null) {
    if (editingLayerId) return;

    // If layer has single inline variable only, open collection item sheet instead
    if (layer.variables?.text) {
      const hasSingle = hasSingleInlineVariable(layer);

      if (hasSingle) {
        const itemWrapper = element.closest('[data-collection-item-id]');
        const collectionItemId = itemWrapper?.getAttribute('data-collection-item-id');

        if (collectionItemId) {
          const parentCollectionLayer = findParentCollectionLayerInTree(layerId);
          const collectionId = parentCollectionLayer?.variables?.collection?.id;

          if (collectionId) {
            sendToParent('OPEN_COLLECTION_ITEM_SHEET', {
              collectionId,
              itemId: collectionItemId,
            });
            return;
          }
        }

        if (pageCollectionItem && getPageCollectionFields && getPageCollectionFields().length > 0) {
          const pageCollectionId = pageCollectionItem.collection_id;
          const pageItemId = pageCollectionItem.id;

          if (pageCollectionId && pageItemId) {
            sendToParent('OPEN_COLLECTION_ITEM_SHEET', {
              collectionId: pageCollectionId,
              itemId: pageItemId,
            });
            return;
          }
        }
      }
    }

    // Clean up any existing editor first
    if (activeRichTextEditor) {
      cleanup();
    }

    // Load Tiptap if not loaded
    const loaded = await loadTiptap();
    if (!loaded) {
      console.warn('[Canvas] Tiptap not available');
      return;
    }

    setEditingLayerId(layerId);
    editingLayerId = layerId;

    // Remove selection badge if present
    const badge = element.querySelector('.ycode-selection-badge');
    if (badge) badge.remove();

    // Get current content from layer
    const textVariable = layer.variables?.text;
    let initialContent;

    if (textVariable && textVariable.type === 'dynamic_text') {
      const content = textVariable.data.content;
      if (typeof content === 'object' && content.type === 'doc') {
        initialContent = content;
      } else {
        const fields = getCollectionFields?.()?.[activeCollectionId] || getPageCollectionFields?.() || [];
        initialContent = parseTextToTiptapJson(content, fields);
      }
    } else {
      initialContent = parseTextToTiptapJson('', []);
    }

    // Create editor container
    const editorContainer = document.createElement('div');
    editorContainer.className = 'ycode-richtext-editor';
    editorContainer.setAttribute('data-editing-layer', layerId);

    // Clear element and add editor
    element.innerHTML = '';
    element.appendChild(editorContainer);
    element.classList.add('ycode-editing');

    // Track if we're clicking inside the editor
    let isClickingInsideEditor = false;
    let blurTimeoutId = null;

    editorContainer.addEventListener('click', function(e) {
      e.stopPropagation();
    }, true);

    editorContainer.addEventListener('dblclick', function(e) {
      e.stopPropagation();
    }, true);

    editorContainer.addEventListener('mousedown', function(e) {
      e.stopPropagation();
      isClickingInsideEditor = true;
      if (blurTimeoutId) {
        clearTimeout(blurTimeoutId);
        blurTimeoutId = null;
      }
      setTimeout(() => {
        isClickingInsideEditor = false;
      }, 200);
    }, true);

    const handleProseMirrorClick = function(e) {
      e.stopPropagation();
      isClickingInsideEditor = true;
      if (blurTimeoutId) {
        clearTimeout(blurTimeoutId);
        blurTimeoutId = null;
      }
      setTimeout(() => {
        isClickingInsideEditor = false;
      }, 200);
    };

    setTimeout(() => {
      const proseMirror = editorContainer.querySelector('.ProseMirror');
      if (proseMirror) {
        proseMirror.addEventListener('mousedown', handleProseMirrorClick, true);
        proseMirror.addEventListener('click', function(e) {
          e.stopPropagation();
        }, true);
        proseMirror.addEventListener('dblclick', function(e) {
          e.stopPropagation();
        }, true);
      }
    }, 50);

    // Create toolbar
    createToolbar();

    // Create Tiptap editor
    activeRichTextEditor = new TiptapEditor({
      element: editorContainer,
      extensions: [
        TiptapStarterKit.configure({
          heading: false,
          blockquote: false,
          codeBlock: false,
          horizontalRule: false,
          hardBreak: false,
          paragraph: false,
          bold: false,
          italic: false,
          strike: false,
          code: false,
          bulletList: false,
          orderedList: false,
          listItem: false,
          underline: false,
        }),
        TiptapParagraph,
        window.CustomBulletList,
        window.CustomOrderedList,
        window.CustomListItem,
        window.CustomBold,
        window.CustomItalic,
        window.CustomUnderline,
        window.CustomStrike,
        window.CustomCode,
        TiptapTextStyle,
        TiptapColor,
        DynamicVariableExtension,
      ],
      content: initialContent,
      autofocus: 'end',
      editorProps: {
        attributes: {
          class: 'ProseMirror',
        },
        handleKeyDown: (view, event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey || event.shiftKey)) {
            event.preventDefault();
            finishRichTextEditing();
            return true;
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            cancelRichTextEditing();
            return true;
          }
          return false;
        },
      },
      onSelectionUpdate: () => {
        updateToolbarState();
      },
      onFocus: () => {
        positionToolbar(editorContainer);
      },
      onBlur: ({ event }) => {
        if (isClickingInsideEditor) {
          return;
        }

        const relatedTarget = event?.relatedTarget;

        if (relatedTarget && relatedTarget.closest('#ycode-richtext-toolbar')) {
          return;
        }

        if (relatedTarget && editorContainer.contains(relatedTarget)) {
          return;
        }

        if (blurTimeoutId) {
          clearTimeout(blurTimeoutId);
        }

        const editingLayerIdAtBlur = layerId;

        blurTimeoutId = setTimeout(() => {
          blurTimeoutId = null;

          if (!activeRichTextEditor) return;

          if (isClickingInsideEditor) {
            return;
          }

          if (getSelectedLayerId() !== editingLayerIdAtBlur) {
            finishRichTextEditing();
            return;
          }

          if (activeRichTextEditor.isFocused) {
            return;
          }

          const activeElement = document.activeElement;
          if (activeElement && editorContainer.contains(activeElement)) {
            return;
          }

          if (activeElement && activeElement.closest('#ycode-richtext-toolbar')) {
            return;
          }

          finishRichTextEditing();
        }, 200);
      },
    });

    positionToolbar(editorContainer);
    sendToParent('RICHTEXT_EDIT_START', { layerId });
  }

  /**
   * Finish rich text editing and save changes
   */
  function finishRichTextEditing() {
    if (!activeRichTextEditor || !editingLayerId) return;

    const json = activeRichTextEditor.getJSON();
    const layerId = editingLayerId;

    const layer = findLayer(layerId);

    const htmlContent = renderTiptapJsonToHtml(json, null, null, layer?.textStyles);

    const layerElement = document.querySelector(`[data-layer-id="${layerId}"]`);

    if (layerElement && htmlContent !== '') {
      requestAnimationFrame(() => {
        layerElement.classList.remove('ycode-editing');
        layerElement.innerHTML = htmlContent;
        void layerElement.offsetHeight;
      });
    } else if (layerElement) {
      requestAnimationFrame(() => {
        layerElement.classList.remove('ycode-editing');
        layerElement.innerHTML = '';
        void layerElement.offsetHeight;
      });
    }

    cleanup();

    sendToParent('RICHTEXT_EDIT_END', {
      layerId,
      content: json,
      plainText: tiptapJsonToPlainText(json),
    });
  }

  /**
   * Cancel rich text editing without saving
   */
  function cancelRichTextEditing() {
    cleanup();
    if (render) {
      render();
    }
  }

  /**
   * Get active editor state
   */
  function getEditorState() {
    return {
      isEditing: !!editingLayerId,
      editingLayerId,
      hasActiveEditor: !!activeRichTextEditor,
    };
  }

  /**
   * Check if currently editing
   */
  function isEditing() {
    return !!editingLayerId;
  }

  /**
   * Cleanup editor
   */
  function cleanup() {
    hideToolbar();
    if (activeRichTextEditor) {
      activeRichTextEditor.destroy();
      activeRichTextEditor = null;
    }
    setEditingLayerId(null);
    editingLayerId = null;
  }

  // Return public API
  return {
    loadTiptap,
    tiptapJsonToPlainText,
    renderTiptapJsonToHtml,
    isTiptapContent,
    hasSingleInlineVariable,
    insertVariable,
    insertVariableIntoEditor: insertVariable, // Alias for compatibility
    startTextEditing,
    finishRichTextEditing,
    cancelRichTextEditing,
    isEditing,
    getEditorState,
    cleanup,
    // Expose these for canvas-renderer to manage editor lifecycle
    get activeEditor() { return activeRichTextEditor; },
    set activeEditor(editor) { activeRichTextEditor = editor; },
    get editingLayerId() { return editingLayerId; },
    set editingLayerId(id) { editingLayerId = id; },
    // Expose Tiptap modules after loading
    get TiptapEditor() { return TiptapEditor; },
    get TiptapStarterKit() { return TiptapStarterKit; },
    get TiptapParagraph() { return TiptapParagraph; },
    get DynamicVariableExtension() { return DynamicVariableExtension; },
    get CustomBold() { return window.CustomBold; },
    get CustomItalic() { return window.CustomItalic; },
    get CustomUnderline() { return window.CustomUnderline; },
    get CustomStrike() { return window.CustomStrike; },
    get CustomCode() { return window.CustomCode; },
    get CustomBulletList() { return window.CustomBulletList; },
    get CustomOrderedList() { return window.CustomOrderedList; },
    get CustomListItem() { return window.CustomListItem; },
  };
}
