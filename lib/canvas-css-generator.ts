import type { Layer } from '@/types';

/**
 * Generates CSS for arbitrary value Tailwind classes found in layers
 * Example: w-[347px] -> .w-\[347px\] { width: 347px; }
 * Also generates standard Tailwind classes that might not be in the build
 * Supports pseudo-class variants like hover:, focus:, etc.
 */
export function generateCanvasCSS(layers: Layer[]): string {
  const arbitraryClasses = extractArbitraryClasses(layers);
  const standardClasses = extractStandardClasses(layers);
  const pseudoClasses = extractPseudoClasses(layers);
  const cssRules: string[] = [];
  
  // Generate CSS for arbitrary value classes
  for (const className of arbitraryClasses) {
    const cssRule = parseArbitraryClass(className);
    if (cssRule) {
      cssRules.push(cssRule);
    }
  }
  
  // Generate CSS for standard classes (like font-weight, etc.)
  for (const className of standardClasses) {
    const cssRule = parseStandardClass(className);
    if (cssRule) {
      cssRules.push(cssRule);
    }
  }
  
  // Generate CSS for pseudo-class variants (hover:, focus:, etc.)
  for (const className of pseudoClasses) {
    const cssRule = parsePseudoClass(className);
    if (cssRule) {
      cssRules.push(cssRule);
    }
  }
  
  return cssRules.join('\n');
}

/**
 * Recursively extracts all arbitrary value classes from layer tree
 */
function extractArbitraryClasses(layers: Layer[]): Set<string> {
  const classes = new Set<string>();
  
  function traverse(layer: Layer) {
    const layerClasses = Array.isArray(layer.classes) 
      ? layer.classes 
      : (layer.classes || '').split(' ').filter(Boolean);
    
    layerClasses.forEach(cls => {
      // Match arbitrary values: w-[347px], bg-[#ff0000], etc.
      if (/[\w-]+\[.+?\]/.test(cls)) {
        classes.add(cls);
      }
    });
    
    if (layer.children) {
      layer.children.forEach(traverse);
    }
  }
  
  layers.forEach(traverse);
  return classes;
}

/**
 * Recursively extracts standard Tailwind classes that need explicit CSS generation
 */
function extractStandardClasses(layers: Layer[]): Set<string> {
  const classes = new Set<string>();
  
  function traverse(layer: Layer) {
    const layerClasses = Array.isArray(layer.classes) 
      ? layer.classes 
      : (layer.classes || '').split(' ').filter(Boolean);
    
    layerClasses.forEach(cls => {
      // Typography classes
      if (/^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/.test(cls)) {
        classes.add(cls);
      }
      if (/^font-(sans|serif|mono)$/.test(cls)) {
        classes.add(cls);
      }
      if (/^text-(left|center|right|justify|start|end)$/.test(cls)) {
        classes.add(cls);
      }
      if (/^(uppercase|lowercase|capitalize|normal-case)$/.test(cls)) {
        classes.add(cls);
      }
      if (/^(underline|overline|line-through|no-underline)$/.test(cls)) {
        classes.add(cls);
      }
      if (/^(italic|not-italic)$/.test(cls)) {
        classes.add(cls);
      }
      
      // Layout classes
      if (/^(block|inline-block|inline|flex|inline-flex|grid|inline-grid|hidden)$/.test(cls)) {
        classes.add(cls);
      }
      if (/^flex-(row|row-reverse|col|col-reverse)$/.test(cls)) {
        classes.add(cls);
      }
      if (/^flex-(wrap|wrap-reverse|nowrap)$/.test(cls)) {
        classes.add(cls);
      }
      if (/^(justify|items|content)-(start|end|center|between|around|evenly|stretch|baseline)$/.test(cls)) {
        classes.add(cls);
      }
      
      // Position classes
      if (/^(static|relative|absolute|fixed|sticky)$/.test(cls)) {
        classes.add(cls);
      }
      
      // Border style classes
      if (/^border-(solid|dashed|dotted|double|hidden|none)$/.test(cls)) {
        classes.add(cls);
      }
      
      // Background size classes
      if (/^bg-(auto|cover|contain)$/.test(cls)) {
        classes.add(cls);
      }
      if (/^bg-(center|top|bottom|left|right|left-top|left-bottom|right-top|right-bottom)$/.test(cls)) {
        classes.add(cls);
      }
      if (/^bg-(no-repeat|repeat|repeat-x|repeat-y|repeat-round|repeat-space)$/.test(cls)) {
        classes.add(cls);
      }
      
      // Shadow preset classes
      if (/^shadow-(none|sm|md|lg|xl|2xl|inner)$/.test(cls)) {
        classes.add(cls);
      }
    });
    
    if (layer.children) {
      layer.children.forEach(traverse);
    }
  }
  
  layers.forEach(traverse);
  return classes;
}

/**
 * Recursively extracts pseudo-class variants (hover:, focus:, etc.)
 */
function extractPseudoClasses(layers: Layer[]): Set<string> {
  const classes = new Set<string>();
  
  function traverse(layer: Layer) {
    const layerClasses = Array.isArray(layer.classes) 
      ? layer.classes 
      : (layer.classes || '').split(' ').filter(Boolean);
    
    layerClasses.forEach(cls => {
      // Match pseudo-class variants: hover:bg-[#ff0000], focus:text-[#333], etc.
      if (/^(hover|focus|active|disabled|visited|checked|group-hover|peer-hover):/.test(cls)) {
        classes.add(cls);
      }
    });
    
    if (layer.children) {
      layer.children.forEach(traverse);
    }
  }
  
  layers.forEach(traverse);
  return classes;
}

/**
 * Parses an arbitrary class into a CSS rule
 * Example: w-[347px] -> .w-\[347px\] { width: 347px; }
 */
function parseArbitraryClass(className: string): string | null {
  // Match pattern: prefix-[value]
  const match = className.match(/^([\w-]+)-\[(.+?)\]$/);
  if (!match) return null;
  
  const [, prefix, value] = match;
  
  // Escape class name for CSS selector
  const escapedClass = escapeClassName(className);
  
  // Handle special multi-property cases
  if (prefix === 'px') {
    return `.${escapedClass} { padding-left: ${value}; padding-right: ${value}; }`;
  }
  if (prefix === 'py') {
    return `.${escapedClass} { padding-top: ${value}; padding-bottom: ${value}; }`;
  }
  if (prefix === 'mx') {
    return `.${escapedClass} { margin-left: ${value}; margin-right: ${value}; }`;
  }
  if (prefix === 'my') {
    return `.${escapedClass} { margin-top: ${value}; margin-bottom: ${value}; }`;
  }
  
  // Handle standard single-property cases
  const cssProperty = prefixToCSSProperty(prefix);
  if (!cssProperty) {
    console.warn(`Unknown arbitrary value prefix: ${prefix}`);
    return null;
  }
  
  return `.${escapedClass} { ${cssProperty}: ${value}; }`;
}

/**
 * Escapes class name for use in CSS selector
 */
function escapeClassName(className: string): string {
  return className
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\./g, '\\.')
    .replace(/\//g, '\\/')
    .replace(/:/g, '\\:')
    .replace(/#/g, '\\#')
    .replace(/,/g, '\\,')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/%/g, '\\%');
}

/**
 * Parses standard Tailwind classes into CSS rules
 */
function parseStandardClass(className: string): string | null {
  // Font weight classes
  const fontWeightMap: Record<string, string> = {
    'font-thin': '100',
    'font-extralight': '200',
    'font-light': '300',
    'font-normal': '400',
    'font-medium': '500',
    'font-semibold': '600',
    'font-bold': '700',
    'font-extrabold': '800',
    'font-black': '900',
  };
  
  if (fontWeightMap[className]) {
    return `.${className} { font-weight: ${fontWeightMap[className]}; }`;
  }
  
  // Font family classes
  const fontFamilyMap: Record<string, string> = {
    'font-sans': 'ui-sans-serif, system-ui, sans-serif',
    'font-serif': 'ui-serif, Georgia, serif',
    'font-mono': 'ui-monospace, monospace',
  };
  
  if (fontFamilyMap[className]) {
    return `.${className} { font-family: ${fontFamilyMap[className]}; }`;
  }
  
  // Text align classes
  if (className === 'text-left') return `.${className} { text-align: left; }`;
  if (className === 'text-center') return `.${className} { text-align: center; }`;
  if (className === 'text-right') return `.${className} { text-align: right; }`;
  if (className === 'text-justify') return `.${className} { text-align: justify; }`;
  if (className === 'text-start') return `.${className} { text-align: start; }`;
  if (className === 'text-end') return `.${className} { text-align: end; }`;
  
  // Text transform classes
  if (className === 'uppercase') return `.${className} { text-transform: uppercase; }`;
  if (className === 'lowercase') return `.${className} { text-transform: lowercase; }`;
  if (className === 'capitalize') return `.${className} { text-transform: capitalize; }`;
  if (className === 'normal-case') return `.${className} { text-transform: none; }`;
  
  // Text decoration classes
  if (className === 'underline') return `.${className} { text-decoration-line: underline; }`;
  if (className === 'overline') return `.${className} { text-decoration-line: overline; }`;
  if (className === 'line-through') return `.${className} { text-decoration-line: line-through; }`;
  if (className === 'no-underline') return `.${className} { text-decoration-line: none; }`;
  
  // Font style classes
  if (className === 'italic') return `.${className} { font-style: italic; }`;
  if (className === 'not-italic') return `.${className} { font-style: normal; }`;
  
  // Display classes
  if (className === 'block') return `.${className} { display: block; }`;
  if (className === 'inline-block') return `.${className} { display: inline-block; }`;
  if (className === 'inline') return `.${className} { display: inline; }`;
  if (className === 'flex') return `.${className} { display: flex; }`;
  if (className === 'inline-flex') return `.${className} { display: inline-flex; }`;
  if (className === 'grid') return `.${className} { display: grid; }`;
  if (className === 'inline-grid') return `.${className} { display: inline-grid; }`;
  if (className === 'hidden') return `.${className} { display: none; }`;
  
  // Flex direction classes
  if (className === 'flex-row') return `.${className} { flex-direction: row; }`;
  if (className === 'flex-row-reverse') return `.${className} { flex-direction: row-reverse; }`;
  if (className === 'flex-col') return `.${className} { flex-direction: column; }`;
  if (className === 'flex-col-reverse') return `.${className} { flex-direction: column-reverse; }`;
  
  // Flex wrap classes
  if (className === 'flex-wrap') return `.${className} { flex-wrap: wrap; }`;
  if (className === 'flex-wrap-reverse') return `.${className} { flex-wrap: wrap-reverse; }`;
  if (className === 'flex-nowrap') return `.${className} { flex-wrap: nowrap; }`;
  
  // Justify content classes
  if (className === 'justify-start') return `.${className} { justify-content: flex-start; }`;
  if (className === 'justify-end') return `.${className} { justify-content: flex-end; }`;
  if (className === 'justify-center') return `.${className} { justify-content: center; }`;
  if (className === 'justify-between') return `.${className} { justify-content: space-between; }`;
  if (className === 'justify-around') return `.${className} { justify-content: space-around; }`;
  if (className === 'justify-evenly') return `.${className} { justify-content: space-evenly; }`;
  if (className === 'justify-stretch') return `.${className} { justify-content: stretch; }`;
  
  // Align items classes
  if (className === 'items-start') return `.${className} { align-items: flex-start; }`;
  if (className === 'items-end') return `.${className} { align-items: flex-end; }`;
  if (className === 'items-center') return `.${className} { align-items: center; }`;
  if (className === 'items-baseline') return `.${className} { align-items: baseline; }`;
  if (className === 'items-stretch') return `.${className} { align-items: stretch; }`;
  
  // Align content classes
  if (className === 'content-start') return `.${className} { align-content: flex-start; }`;
  if (className === 'content-end') return `.${className} { align-content: flex-end; }`;
  if (className === 'content-center') return `.${className} { align-content: center; }`;
  if (className === 'content-between') return `.${className} { align-content: space-between; }`;
  if (className === 'content-around') return `.${className} { align-content: space-around; }`;
  if (className === 'content-evenly') return `.${className} { align-content: space-evenly; }`;
  if (className === 'content-stretch') return `.${className} { align-content: stretch; }`;
  
  // Position classes
  if (className === 'static') return `.${className} { position: static; }`;
  if (className === 'relative') return `.${className} { position: relative; }`;
  if (className === 'absolute') return `.${className} { position: absolute; }`;
  if (className === 'fixed') return `.${className} { position: fixed; }`;
  if (className === 'sticky') return `.${className} { position: sticky; }`;
  
  // Border style classes
  if (className === 'border-solid') return `.${className} { border-style: solid; }`;
  if (className === 'border-dashed') return `.${className} { border-style: dashed; }`;
  if (className === 'border-dotted') return `.${className} { border-style: dotted; }`;
  if (className === 'border-double') return `.${className} { border-style: double; }`;
  if (className === 'border-hidden') return `.${className} { border-style: hidden; }`;
  if (className === 'border-none') return `.${className} { border-style: none; }`;
  
  // Background size classes
  if (className === 'bg-auto') return `.${className} { background-size: auto; }`;
  if (className === 'bg-cover') return `.${className} { background-size: cover; }`;
  if (className === 'bg-contain') return `.${className} { background-size: contain; }`;
  
  // Background position classes
  if (className === 'bg-center') return `.${className} { background-position: center; }`;
  if (className === 'bg-top') return `.${className} { background-position: top; }`;
  if (className === 'bg-bottom') return `.${className} { background-position: bottom; }`;
  if (className === 'bg-left') return `.${className} { background-position: left; }`;
  if (className === 'bg-right') return `.${className} { background-position: right; }`;
  if (className === 'bg-left-top') return `.${className} { background-position: left top; }`;
  if (className === 'bg-left-bottom') return `.${className} { background-position: left bottom; }`;
  if (className === 'bg-right-top') return `.${className} { background-position: right top; }`;
  if (className === 'bg-right-bottom') return `.${className} { background-position: right bottom; }`;
  
  // Background repeat classes
  if (className === 'bg-repeat') return `.${className} { background-repeat: repeat; }`;
  if (className === 'bg-no-repeat') return `.${className} { background-repeat: no-repeat; }`;
  if (className === 'bg-repeat-x') return `.${className} { background-repeat: repeat-x; }`;
  if (className === 'bg-repeat-y') return `.${className} { background-repeat: repeat-y; }`;
  if (className === 'bg-repeat-round') return `.${className} { background-repeat: round; }`;
  if (className === 'bg-repeat-space') return `.${className} { background-repeat: space; }`;
  
  // Shadow preset classes
  const shadowMap: Record<string, string> = {
    'shadow-none': 'none',
    'shadow-sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    'shadow-md': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    'shadow-lg': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    'shadow-xl': '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    'shadow-2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    'shadow-inner': 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
  };
  
  if (shadowMap[className]) {
    return `.${className} { box-shadow: ${shadowMap[className]}; }`;
  }
  
  return null;
}

/**
 * Parses pseudo-class variants into CSS rules
 * Example: hover:bg-[#ff0000] -> .hover\:bg-\[#ff0000\]:hover { background-color: #ff0000; }
 */
function parsePseudoClass(className: string): string | null {
  // Match pattern: pseudo:class-name or pseudo:prefix-[value]
  const match = className.match(/^(hover|focus|active|disabled|visited|checked|group-hover|peer-hover):(.+)$/);
  if (!match) return null;
  
  const [, pseudo, baseClass] = match;
  
  // Escape the full className for CSS selector
  const escapedClass = escapeClassName(className);
  
  // Determine the pseudo-class selector
  let pseudoSelector = ':hover';
  if (pseudo === 'focus') pseudoSelector = ':focus';
  if (pseudo === 'active') pseudoSelector = ':active';
  if (pseudo === 'disabled') pseudoSelector = ':disabled';
  if (pseudo === 'visited') pseudoSelector = ':visited';
  if (pseudo === 'checked') pseudoSelector = ':checked';
  if (pseudo === 'group-hover') return null; // Skip group variants for now
  if (pseudo === 'peer-hover') return null; // Skip peer variants for now
  
  // Check if base class is arbitrary value
  if (/[\w-]+\[.+?\]/.test(baseClass)) {
    const cssRule = parseArbitraryClass(baseClass);
    if (cssRule) {
      // Extract property and value from the parsed CSS rule
      const propMatch = cssRule.match(/\{ (.+): (.+); \}/);
      if (propMatch) {
        const [, property, value] = propMatch;
        return `.${escapedClass}${pseudoSelector} { ${property}: ${value}; }`;
      }
    }
  }
  
  // Check if base class is a standard class
  const standardRule = parseStandardClass(baseClass);
  if (standardRule) {
    // Extract property and value from the parsed CSS rule
    const propMatch = standardRule.match(/\{ (.+): (.+); \}/);
    if (propMatch) {
      const [, property, value] = propMatch;
      return `.${escapedClass}${pseudoSelector} { ${property}: ${value}; }`;
    }
  }
  
  return null;
}

/**
 * Maps Tailwind prefix to CSS property
 */
function prefixToCSSProperty(prefix: string): string | null {
  const propertyMap: Record<string, string> = {
    // Sizing
    'w': 'width',
    'h': 'height',
    'min-w': 'min-width',
    'max-w': 'max-width',
    'min-h': 'min-height',
    'max-h': 'max-height',
    'size': 'width', // Note: size sets both width and height, handled separately
    
    // Spacing - Padding
    'p': 'padding',
    'pt': 'padding-top',
    'pr': 'padding-right',
    'pb': 'padding-bottom',
    'pl': 'padding-left',
    
    // Spacing - Margin
    'm': 'margin',
    'mt': 'margin-top',
    'mr': 'margin-right',
    'mb': 'margin-bottom',
    'ml': 'margin-left',
    
    // Flexbox & Grid
    'gap': 'gap',
    'gap-x': 'column-gap',
    'gap-y': 'row-gap',
    'flex': 'flex',
    'flex-basis': 'flex-basis',
    'grid-cols': 'grid-template-columns',
    'grid-rows': 'grid-template-rows',
    'col-span': 'grid-column',
    'row-span': 'grid-row',
    'col-start': 'grid-column-start',
    'col-end': 'grid-column-end',
    'row-start': 'grid-row-start',
    'row-end': 'grid-row-end',
    
    // Typography
    'text': 'font-size',
    'leading': 'line-height',
    'tracking': 'letter-spacing',
    'indent': 'text-indent',
    
    // Backgrounds
    'bg': 'background-color',
    'from': '--tw-gradient-from',
    'via': '--tw-gradient-via',
    'to': '--tw-gradient-to',
    
    // Borders
    'border': 'border-color',
    'border-t': 'border-top-color',
    'border-r': 'border-right-color',
    'border-b': 'border-bottom-color',
    'border-l': 'border-left-color',
    'border-w': 'border-width',
    'rounded': 'border-radius',
    'rounded-t': 'border-top-left-radius',
    'rounded-r': 'border-top-right-radius',
    'rounded-b': 'border-bottom-right-radius',
    'rounded-l': 'border-bottom-left-radius',
    'rounded-tl': 'border-top-left-radius',
    'rounded-tr': 'border-top-right-radius',
    'rounded-br': 'border-bottom-right-radius',
    'rounded-bl': 'border-bottom-left-radius',
    
    // Effects
    'opacity': 'opacity',
    'shadow': 'box-shadow',
    'blur': 'filter',
    'brightness': 'filter',
    'contrast': 'filter',
    'saturate': 'filter',
    
    // Positioning
    'top': 'top',
    'right': 'right',
    'bottom': 'bottom',
    'left': 'left',
    'inset': 'inset',
    'z': 'z-index',
    
    // Transforms
    'rotate': 'rotate',
    'scale': 'scale',
    'scale-x': 'scale-x',
    'scale-y': 'scale-y',
    'translate-x': 'translate-x',
    'translate-y': 'translate-y',
    'skew-x': 'skew-x',
    'skew-y': 'skew-y',
    
    // Other
    'delay': 'transition-delay',
    'duration': 'transition-duration',
    'stroke': 'stroke-width',
    'fill': 'fill',
  };
  
  return propertyMap[prefix] || null;
}


