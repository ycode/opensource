# HTML Embed Implementation - Framer-Style Isolation

## Overview

YCode now uses **iframe-based isolation** for HTML embed layers, following Framer's approach. This provides complete isolation for custom HTML, CSS, and JavaScript code, preventing style pollution and script conflicts with the main page.

## Key Changes

### 1. Client-Side Rendering (`LayerRenderer.tsx`)

**Before:**
- Used `dangerouslySetInnerHTML` to inject HTML directly into the page DOM
- Manually extracted and executed `<script>` tags
- Scripts ran in global scope, causing potential conflicts
- Styles (like Tailwind CDN) would affect the entire page

**After:**
- Uses `<iframe>` with `sandbox` attribute for isolation
- HTML code is written into iframe using `document.write()`
- Auto-resizing iframe to match content height
- Complete isolation: styles, scripts, and DOM are scoped to iframe

```typescript
// New implementation
if (layer.name === 'htmlEmbed') {
  const htmlCode = layer.settings?.htmlEmbed?.code || '<div>Add your custom code here</div>';
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    const iframeDoc = iframe?.contentDocument;
    
    // Write complete HTML document into iframe
    iframeDoc?.open();
    iframeDoc?.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { margin: 0; padding: 0; overflow: hidden; }
        </style>
      </head>
      <body>
        ${htmlCode}
      </body>
      </html>
    `);
    iframeDoc?.close();
    
    // Auto-resize to content height
    // ...
  }, [htmlCode]);

  return (
    <iframe
      ref={iframeRef}
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
      style={{ width: '100%', border: 'none', display: 'block' }}
    />
  );
}
```

### 2. Server-Side Rendering (`page-fetcher.ts`)

**Before:**
- Injected HTML code directly into the tag
- No isolation during SSR

**After:**
- Uses iframe with `srcdoc` attribute for SSR
- Same isolation behavior as client-side
- Properly escaped HTML for srcdoc attribute

```typescript
if (layer.name === 'htmlEmbed') {
  const htmlEmbedCode = layer.settings?.htmlEmbed?.code || '<div>Add your custom code here</div>';
  
  const iframeContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; overflow: hidden; }
  </style>
</head>
<body>
  ${htmlEmbedCode}
</body>
</html>`;
  
  const escapedIframeContent = iframeContent
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;');
  
  attrs.push(`srcdoc="${escapedIframeContent}"`);
  attrs.push('sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"');
  
  return `<iframe${attrsStr}></iframe>`;
}
```

### 3. Improved Default Template (`templates/utilities.ts`)

**Before:**
```html
<div>Add your custom code here</div>
```

**After:**
Includes a complete interactive example with Tailwind CSS:
```html
<!-- Example: Tailwind CSS + JavaScript -->
<script src="https://cdn.tailwindcss.com"></script>

<div class="p-6 rounded-xl border border-gray-200 bg-white shadow-sm max-w-md">
  <h2 class="text-xl font-semibold">Custom Code Embed</h2>
  <p class="text-sm text-gray-500 mt-1">
    Add your HTML, CSS, and JavaScript here
  </p>

  <button id="btn" class="mt-4 px-4 py-2 rounded-lg bg-black text-white text-sm">
    Click me
  </button>

  <div id="output" class="mt-2 text-sm text-gray-600">
    Ready
  </div>
</div>

<script>
  const btn = document.getElementById("btn");
  const output = document.getElementById("output");
  let clicks = 0;

  btn.addEventListener("click", () => {
    clicks++;
    output.textContent = `Clicked ${clicks} times!`;
  });
</script>
```

## Benefits

### ✅ Complete Isolation
- Styles from CDNs (like Tailwind) only affect the embed, not the entire page
- JavaScript runs in iframe context, preventing global scope pollution
- Multiple embed instances don't conflict with each other

### ✅ Security
- Sandbox attribute controls permissions:
  - `allow-scripts` - Enable JavaScript
  - `allow-same-origin` - Allow content to be treated as same-origin
  - `allow-forms` - Allow form submissions
  - `allow-popups` - Allow popups
  - `allow-modals` - Allow modals (alert, confirm, etc.)

### ✅ Auto-Resizing
- Iframe automatically adjusts height to match content
- Uses ResizeObserver for dynamic content changes
- Fallback polling for compatibility

### ✅ Clean Rendering
- No manual script extraction/execution needed
- Browser handles script execution naturally within iframe
- Works identically in edit mode, preview, and published pages

## How It Works

### Client-Side Hydration Flow

1. **Component mounts** → iframe ref is created
2. **useEffect runs** → Access iframe's contentDocument
3. **Write HTML** → Use `document.write()` to inject complete HTML document
4. **Scripts execute** → Browser automatically runs scripts in iframe context
5. **Resize observer** → Monitor content height and update iframe height
6. **Cleanup** → Remove observers on unmount

### SSR Flow

1. **Layer rendered** → Generate iframe with `srcdoc` attribute
2. **HTML escaped** → Properly escape HTML for attribute value
3. **Sandbox applied** → Security restrictions in place
4. **Client hydration** → React takes over and applies auto-resizing

## Example Use Cases

### 1. External Widgets
```html
<!-- Embed third-party widgets -->
<script src="https://example.com/widget.js"></script>
<div id="widget"></div>
```

### 2. Custom Styling with Tailwind
```html
<script src="https://cdn.tailwindcss.com"></script>
<div class="p-4 bg-blue-500 text-white rounded-lg">
  Custom styled content
</div>
```

### 3. Interactive Components
```html
<div id="app">
  <button id="btn">Click me</button>
  <p id="output">0 clicks</p>
</div>

<script>
  let count = 0;
  document.getElementById('btn').onclick = () => {
    count++;
    document.getElementById('output').textContent = count + ' clicks';
  };
</script>
```

### 4. Forms
```html
<form id="myForm">
  <input type="text" name="name" placeholder="Your name">
  <button type="submit">Submit</button>
</form>

<script>
  document.getElementById('myForm').onsubmit = (e) => {
    e.preventDefault();
    alert('Form submitted!');
  };
</script>
```

## Migration Notes

### Breaking Changes
None - existing HTML embeds will automatically use the new iframe approach.

### Considerations

1. **Parent-child communication**: If you need communication between the embed and parent page, you'll need to use `postMessage` API.

2. **Height calculation**: The iframe auto-resizes, but if content changes dynamically after initial load, there's a 100ms polling interval that will catch it.

3. **Styling context**: Remember that global styles from your YCode page don't apply inside the iframe. Include all necessary styles within the embed code.

4. **External resources**: CDN scripts and stylesheets work perfectly within the iframe context.

## Technical Details

### Sandbox Permissions

| Permission | Purpose | Risk Level |
|------------|---------|------------|
| `allow-scripts` | Enable JavaScript execution | Medium |
| `allow-same-origin` | Treat content as same-origin | High (when combined with allow-scripts) |
| `allow-forms` | Allow form submissions | Low |
| `allow-popups` | Allow window.open() | Low |
| `allow-modals` | Allow alert(), confirm() | Low |

**Note**: `allow-same-origin` + `allow-scripts` allows the iframe to access parent page via JavaScript. Only use with trusted content.

### Performance

- **Initial render**: Fast - iframe creation is lightweight
- **Content loading**: Dependent on external resources (CDN scripts, etc.)
- **Memory**: Each iframe has its own JavaScript context and DOM
- **Auto-resize**: Minimal overhead - uses ResizeObserver (efficient) + fallback polling

## Comparison with Framer

| Feature | YCode (New) | Framer |
|---------|-------------|--------|
| Isolation Method | iframe | iframe |
| Sandbox Attributes | ✅ | ✅ |
| Auto-resizing | ✅ | ✅ |
| CDN Support | ✅ | ✅ |
| Custom Code Positions | Via embed layer | Global + embed component |
| SSR Support | ✅ | ✅ |

## Future Enhancements

Potential improvements:
- [ ] Option to customize sandbox permissions per embed
- [ ] Built-in postMessage communication helpers
- [ ] Preset templates for common use cases
- [ ] Visual height override (disable auto-resize)
- [ ] Loading states for external resources
- [ ] Error boundary for iframe content

## Testing Recommendations

Test your HTML embeds with:
1. ✅ CDN scripts (Tailwind, jQuery, etc.)
2. ✅ JavaScript event listeners
3. ✅ Dynamic content changes
4. ✅ Forms and user input
5. ✅ External API calls
6. ✅ Multiple embeds on same page
7. ✅ Edit mode vs preview vs published
8. ✅ Different viewport sizes

## Support

For issues or questions about HTML embeds:
1. Check that your HTML is valid
2. Verify external scripts are loading (check Network tab)
3. Test in isolation first before embedding
4. Check console for errors (both page and iframe contexts)
