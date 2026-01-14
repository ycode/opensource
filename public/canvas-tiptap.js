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

  // Global handler for variable delete buttons
  let deleteButtonHandlerInstalled = false;
  // Zoom observer for toolbar scale updates
  let zoomObserver = null;
  // Variable picker close handler reference
  let variablePickerCloseHandler = null;

  /**
   * Setup zoom observer to update toolbar scale when zoom changes
   */
  function setupZoomObserver() {
    if (zoomObserver) return; // Already set up

    zoomObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-zoom') {
          updateToolbarScale();
          closeVariablePicker();
        }
      });
    });

    zoomObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-zoom'],
    });
  }

  /**
   * Install global delete button handler for inline variables
   */
  function setDeleteButtonHandler() {
    if (deleteButtonHandlerInstalled) return;

    document.addEventListener('mousedown', (e) => {
      const deleteBtn = e.target.closest('.ycode-var-delete');
      if (!deleteBtn || !activeRichTextEditor) return;

      e.preventDefault();
      e.stopPropagation();

      // Find the variable container
      const container = deleteBtn.closest('.ycode-inline-var');
      if (!container) return;

      // Get the position from the container's data attribute
      const variableData = container.getAttribute('data-variable');

      // Find the position of this node in the editor
      const editor = activeRichTextEditor;
      const { state } = editor;
      let nodePos = null;

      state.doc.descendants((node, pos) => {
        if (node.type.name === 'dynamicVariable') {
          const nodeVarData = JSON.stringify(node.attrs.variable);
          if (nodeVarData === variableData) {
            nodePos = pos;
            return false; // Stop iteration
          }
        }
      });

      if (nodePos !== null) {
        setTimeout(() => {
          editor.chain().focus().deleteRange({ from: nodePos, to: nodePos + 1 }).run();
        }, 0);
      }
    }, true); // Capture phase

    deleteButtonHandlerInstalled = true;
  }

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

        // Custom list extensions using Node.create
        // Based on Tiptap's official list extensions
        const CustomBulletList = coreModule.Node.create({
          name: 'bulletList',
          group: 'block list',
          content: 'listItem+',
          parseHTML() {
            return [{ tag: 'ul' }];
          },
          renderHTML({ HTMLAttributes }) {
            return ['ul', { class: 'my-2 pl-6 list-disc', ...HTMLAttributes }, 0];
          },
          addCommands() {
            return {
              toggleBulletList: () => ({ commands, chain }) => {
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
          group: 'block list',
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

        // Custom extension for inline variables with interactive UI
        DynamicVariableExtension = coreModule.Node.create({
          name: 'dynamicVariable',
          group: 'inline',
          inline: true,
          atom: true,

          addAttributes() {
            return {
              variable: {
                default: null,
                parseHTML: (element) => {
                  const variableAttr = element.getAttribute('data-variable');
                  if (variableAttr) {
                    try {
                      return JSON.parse(variableAttr);
                    } catch {
                      return null;
                    }
                  }
                  return null;
                },
                renderHTML: (attributes) => {
                  if (!attributes) return {};
                  return {
                    'data-variable': JSON.stringify(attributes),
                  };
                },
              },
              label: {
                default: null,
                parseHTML: (element) => {
                  return element.textContent || null;
                },
              },
            };
          },

          parseHTML() {
            return [
              { tag: 'span[data-variable]' },
              { tag: 'span.ycode-inline-var' }
            ];
          },

          renderHTML({ node, HTMLAttributes }) {
            const label = node.attrs.label ||
              (node.attrs.variable?.data?.field_id) ||
              (node.attrs.variable?.type || 'variable');

            return ['span', {
              class: 'ycode-inline-var',
              'data-variable': node.attrs.variable ? JSON.stringify(node.attrs.variable) : undefined,
              contenteditable: 'false',
              ...HTMLAttributes
            }, ['span', {}, label]];
          },

          addNodeView() {
            return ({ node, editor }) => {
              const container = document.createElement('span');
              container.className = 'ycode-inline-var';
              container.contentEditable = 'false';

              const variable = node.attrs.variable;
              if (variable) {
                container.setAttribute('data-variable', JSON.stringify(variable));
              }

              const label = node.attrs.label ||
                (variable?.data?.field_id) ||
                (variable?.type || 'variable');

              // Create label span
              const labelSpan = document.createElement('span');
              labelSpan.textContent = label;
              container.appendChild(labelSpan);

              // Add delete button if editor is editable (handled by global handler)
              if (editor.isEditable) {
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'ycode-var-delete';
                deleteBtn.setAttribute('type', 'button');
                deleteBtn.setAttribute('title', 'Remove variable');

                // Create X icon SVG
                deleteBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" fill="currentColor"><path d="M9.5,1.79289322 L10.2071068,2.5 L6.70689322,5.99989322 L10.2071068,9.5 L9.5,10.2071068 L5.99989322,6.70689322 L2.5,10.2071068 L1.79289322,9.5 L5.29289322,5.99989322 L1.79289322,2.5 L2.5,1.79289322 L5.99989322,5.29289322 L9.5,1.79289322 Z"></path></svg>';

                container.appendChild(deleteBtn);
              }

              return {
                dom: container,
                contentDOM: null,
              };
            };
          },
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
        // Show variable badge in preview mode
        const label = (node.attrs && node.attrs.label) || 'variable';
        const variableJson = variable ? JSON.stringify(variable) : '';
        return '<span class="ycode-inline-var" data-variable="' + escapeHtml(variableJson) + '">' +
               '<span>' + escapeHtml(label) + '</span>' +
               '</span>';
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
   * Insert a variable into the active editor with smart spacing
   */
  function insertVariable(variable, label) {
    if (!activeRichTextEditor) return;

    const editor = activeRichTextEditor;
    const { from } = editor.state.selection;
    const doc = editor.state.doc;

    // Check what's before the cursor
    let needsSpaceBefore = false;
    if (from > 0) {
      const nodeBefore = doc.nodeAt(from - 1);
      if (nodeBefore) {
        // Check if it's a variable node
        if (nodeBefore.type.name === 'dynamicVariable') {
          needsSpaceBefore = true;
        } else {
          // Check if it's text that's not a space
          const charBefore = doc.textBetween(from - 1, from);
          needsSpaceBefore = !!(charBefore && charBefore !== ' ' && charBefore !== '\n');
        }
      } else {
        // Check character before cursor
        const charBefore = doc.textBetween(from - 1, from);
        needsSpaceBefore = !!(charBefore && charBefore !== ' ' && charBefore !== '\n');
      }
    }

    // Check what's after the cursor
    let needsSpaceAfter = false;
    if (from < doc.content.size) {
      const nodeAfter = doc.nodeAt(from);
      if (nodeAfter) {
        // Check if it's a variable node
        if (nodeAfter.type.name === 'dynamicVariable') {
          needsSpaceAfter = true;
        } else {
          // Check if it's text that's not a space
          const charAfter = doc.textBetween(from, from + 1);
          needsSpaceAfter = !!(charAfter && charAfter !== ' ' && charAfter !== '\n');
        }
      } else {
        // Check character at cursor position
        const charAfter = doc.textBetween(from, from + 1);
        needsSpaceAfter = !!(charAfter && charAfter !== ' ' && charAfter !== '\n');
      }
    }

    // Build content to insert
    const contentToInsert = [];

    // Add space before if needed
    if (needsSpaceBefore) {
      contentToInsert.push({ type: 'text', text: ' ' });
    }

    // Add the variable node
    contentToInsert.push({
      type: 'dynamicVariable',
      attrs: { variable, label },
    });

    // Add space after if needed
    if (needsSpaceAfter) {
      contentToInsert.push({ type: 'text', text: ' ' });
    }

    // Insert content
    editor.chain().focus().insertContent(contentToInsert).run();

    // Calculate final cursor position
    let finalPosition = from;
    if (needsSpaceBefore) finalPosition += 1;
    finalPosition += 1; // variable itself
    if (needsSpaceAfter) finalPosition += 1;

    // Restore focus at the position after the inserted content
    setTimeout(() => {
      editor.commands.focus(finalPosition);
    }, 0);
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
   * Show variable picker dropdown
   */
  function showVariablePicker(triggerButton) {
    // Remove any existing picker
    const existingPicker = document.getElementById('ycode-variable-picker');
    if (existingPicker) {
      existingPicker.remove();
      return; // Toggle off
    }

    // Get available fields
    const allFields = [];
    const collectionFields = getCollectionFields?.() || {};
    const pageFields = getPageCollectionFields?.() || [];

    // Add page collection fields if available
    if (pageFields.length > 0) {
      allFields.push({
        label: 'Page fields',
        fields: pageFields,
      });
    }

    // Add collection fields
    Object.entries(collectionFields).forEach(([collectionId, fields]) => {
      if (fields && fields.length > 0) {
        allFields.push({
          label: 'Collection fields',
          fields: fields,
        });
      }
    });

    if (allFields.length === 0) {
      return; // No fields available
    }

    // Create picker dropdown
    const picker = document.createElement('div');
    picker.id = 'ycode-variable-picker';
    picker.className = 'ycode-variable-picker';

    // Build HTML for fields
    let html = '';
    allFields.forEach(group => {
      if (group.label) {
        html += `<div class="ycode-variable-picker-label">${group.label}</div>`;
      }
      group.fields.forEach(field => {
        html += `
          <button type="button" class="ycode-variable-picker-item" data-field-id="${field.id}" data-field-name="${field.name}">
            <span>${field.name}</span>
          </button>
        `;
      });
    });

    picker.innerHTML = html;
    document.body.appendChild(picker);

    // Create invisible overlay to close picker when clicking outside
    const overlay = document.createElement('div');
    overlay.id = 'ycode-variable-picker-overlay';
    overlay.className = 'ycode-variable-picker-overlay';
    document.body.appendChild(overlay);

    // Close picker function
    const closePicker = function() {
      picker.remove();
      overlay.remove();
      if (variablePickerCloseHandler) {
        document.removeEventListener('mousedown', variablePickerCloseHandler);
        variablePickerCloseHandler = null;
      }
    };

    // Stop all events on overlay to prevent edit mode exit
    const stopOverlayEvents = function(e) {
      e.stopPropagation();
      e.stopImmediatePropagation();
      e.preventDefault();
    };

    // Stop all mouse/pointer events in capture phase
    overlay.addEventListener('mousedown', stopOverlayEvents, true);
    overlay.addEventListener('mouseup', stopOverlayEvents, true);
    overlay.addEventListener('click', function(e) {
      e.stopPropagation();
      e.stopImmediatePropagation();
      e.preventDefault();
      closePicker();
    }, true);
    overlay.addEventListener('pointerdown', stopOverlayEvents, true);
    overlay.addEventListener('pointerup', stopOverlayEvents, true);

    // Apply zoom scaling to keep picker at constant size
    const zoomScale = detectZoom();
    const inverseScale = 1 / zoomScale;
    picker.style.transform = `scale(${inverseScale})`;
    picker.style.transformOrigin = 'top left';

    // Position below the trigger button
    const rect = triggerButton.getBoundingClientRect();
    picker.style.left = rect.left + 'px';
    picker.style.top = (rect.bottom + 4) + 'px';

    // Ensure picker blocks all pointer events
    picker.style.pointerEvents = 'auto';

    // Handle all events inside picker to prevent them from bubbling
    picker.addEventListener('mousedown', function(e) {
      e.stopPropagation();
      e.stopImmediatePropagation();

      const item = e.target.closest('.ycode-variable-picker-item');
      if (item) {
        // Clicking on an item - handle selection
        e.preventDefault();

        const fieldId = item.dataset.fieldId;
        const fieldName = item.dataset.fieldName;

        // Create variable and insert
        const variable = {
          type: 'field',
          data: {
            field_id: fieldId,
            relationships: [],
          },
        };

        // Insert variable immediately
        insertVariable(variable, fieldName);

        // Close picker
        closePicker();

        // Ensure editor stays focused
        if (activeRichTextEditor) {
          setTimeout(() => {
            activeRichTextEditor.commands.focus();
          }, 0);
        }
      } else {
        // Clicking on label or empty area - just stop propagation
        e.preventDefault();
      }
    }, true);

    // Stop other events from bubbling
    picker.addEventListener('mouseup', function(e) {
      e.stopPropagation();
      e.stopImmediatePropagation();
      e.preventDefault();
    }, true);

    picker.addEventListener('click', function(e) {
      e.stopPropagation();
      e.stopImmediatePropagation();
      e.preventDefault();
    }, true);
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
          // Simple toggle like InputWithInlineVariables.tsx
          editor.chain().focus().toggleBulletList().run();
          break;
        case 'orderedList':
          // Simple toggle like InputWithInlineVariables.tsx
          editor.chain().focus().toggleOrderedList().run();
          break;
        case 'variable':
          showVariablePicker(btn);
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
   * Detect current zoom level from parent-set data attribute
   */
  function detectZoom() {
    const zoomAttr = document.body.getAttribute('data-zoom');
    if (zoomAttr) {
      const zoom = parseFloat(zoomAttr);
      if (!isNaN(zoom) && zoom > 0) {
        return zoom / 100; // Convert percentage to scale factor
      }
    }
    return 1; // Default to 100% if not set
  }

  /**
   * Update toolbar scale based on current zoom
   */
  function updateToolbarScale() {
    const toolbar = document.getElementById('ycode-richtext-toolbar');
    if (!toolbar || !toolbar.classList.contains('visible')) return;

    const zoomScale = detectZoom();
    const inverseScale = 1 / zoomScale;

    // Apply inverse scale to keep toolbar at constant size
    toolbar.style.transform = `scale(${inverseScale})`;
    toolbar.style.transformOrigin = 'top left';

    // Reposition toolbar if it's visible
    const editorContainer = document.querySelector('.ycode-richtext-editor');
    if (editorContainer) {
      positionToolbar(editorContainer);
    }
  }

  /**
   * Close variable picker if open
   */
  function closeVariablePicker() {
    const picker = document.getElementById('ycode-variable-picker');
    const overlay = document.getElementById('ycode-variable-picker-overlay');
    if (picker) {
      picker.remove();
    }
    if (overlay) {
      overlay.remove();
    }
    // Clean up event listener
    if (variablePickerCloseHandler) {
      document.removeEventListener('mousedown', variablePickerCloseHandler);
      variablePickerCloseHandler = null;
    }
  }

  /**
   * Position toolbar above selection or element
   */
  function positionToolbar(element) {
    const toolbar = document.getElementById('ycode-richtext-toolbar');
    if (!toolbar) return;

    const rect = element.getBoundingClientRect();
    const zoomScale = detectZoom();
    const inverseScale = 1 / zoomScale;

    // Apply inverse scale to keep toolbar at constant size
    toolbar.style.transform = `scale(${inverseScale})`;
    toolbar.style.transformOrigin = 'top left';

    // Get toolbar dimensions after scale is applied
    const toolbarRect = toolbar.getBoundingClientRect();
    const scaledWidth = toolbarRect.width;
    const scaledHeight = toolbarRect.height;

    // Left-align toolbar with element
    let left = rect.left;
    let top = rect.top - scaledHeight - 8;

    // Ensure toolbar stays within viewport
    left = Math.max(8, Math.min(left, window.innerWidth - scaledWidth - 8));
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

    // Install global delete button handler (only once)
    setDeleteButtonHandler();

    // Setup zoom observer to update toolbar scale (only once)
    setupZoomObserver();

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
