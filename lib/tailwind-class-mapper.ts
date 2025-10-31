/**
 * Tailwind Class Mapper
 * 
 * Bidirectional conversion between design object properties and Tailwind CSS classes
 * with intelligent conflict resolution
 */

import type { Layer } from '@/types';

/**
 * Map of Tailwind class prefixes to their property names
 * Used for conflict detection and removal
 */
const CLASS_PROPERTY_MAP: Record<string, RegExp> = {
  // Display & Layout
  display: /^(block|inline-block|inline|flex|inline-flex|grid|inline-grid|hidden)$/,
  flexDirection: /^flex-(row|row-reverse|col|col-reverse)$/,
  flexWrap: /^flex-(wrap|wrap-reverse|nowrap)$/,
  justifyContent: /^justify-(start|end|center|between|around|evenly|stretch)$/,
  alignItems: /^items-(start|end|center|baseline|stretch)$/,
  alignContent: /^content-(start|end|center|between|around|evenly|stretch)$/,
  gap: /^gap-(\[.+\]|\d+|px|0\.5|1\.5|2\.5|3\.5)$/,
  columnGap: /^gap-x-(\[.+\]|\d+|px|0\.5|1\.5|2\.5|3\.5)$/,
  rowGap: /^gap-y-(\[.+\]|\d+|px|0\.5|1\.5|2\.5|3\.5)$/,
  gridTemplateColumns: /^grid-cols-(\[.+\]|\d+|none|subgrid)$/,
  gridTemplateRows: /^grid-rows-(\[.+\]|\d+|none|subgrid)$/,
  
  // Spacing
  padding: /^p-(\[.+\]|\d+|px|0\.5|1\.5|2\.5|3\.5)$/,
  paddingTop: /^pt-(\[.+\]|\d+|px|0\.5|1\.5|2\.5|3\.5)$/,
  paddingRight: /^pr-(\[.+\]|\d+|px|0\.5|1\.5|2\.5|3\.5)$/,
  paddingBottom: /^pb-(\[.+\]|\d+|px|0\.5|1\.5|2\.5|3\.5)$/,
  paddingLeft: /^pl-(\[.+\]|\d+|px|0\.5|1\.5|2\.5|3\.5)$/,
  margin: /^m-(\[.+\]|\d+|px|auto|0\.5|1\.5|2\.5|3\.5)$/,
  marginTop: /^mt-(\[.+\]|\d+|px|auto|0\.5|1\.5|2\.5|3\.5)$/,
  marginRight: /^mr-(\[.+\]|\d+|px|auto|0\.5|1\.5|2\.5|3\.5)$/,
  marginBottom: /^mb-(\[.+\]|\d+|px|auto|0\.5|1\.5|2\.5|3\.5)$/,
  marginLeft: /^ml-(\[.+\]|\d+|px|auto|0\.5|1\.5|2\.5|3\.5)$/,
  
  // Sizing
  width: /^w-(\[.+\]|\d+\/\d+|\d+|px|auto|full|screen|min|max|fit)$/,
  height: /^h-(\[.+\]|\d+\/\d+|\d+|px|auto|full|screen|min|max|fit)$/,
  minWidth: /^min-w-(\[.+\]|\d+|px|full|min|max|fit)$/,
  minHeight: /^min-h-(\[.+\]|\d+|px|full|screen|min|max|fit)$/,
  maxWidth: /^max-w-(\[.+\]|none|xs|sm|md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|full|min|max|fit|prose|screen-sm|screen-md|screen-lg|screen-xl|screen-2xl)$/,
  maxHeight: /^max-h-(\[.+\]|\d+|px|full|screen|min|max|fit)$/,
  
  // Typography
  fontFamily: /^font-(sans|serif|mono|\[.+\])$/,
  fontSize: /^text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl|\[.+\])$/,
  fontWeight: /^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black|\[.+\])$/,
  lineHeight: /^leading-(none|tight|snug|normal|relaxed|loose|\d+|\[.+\])$/,
  letterSpacing: /^tracking-(tighter|tight|normal|wide|wider|widest|\[.+\])$/,
  textAlign: /^text-(left|center|right|justify|start|end)$/,
  textTransform: /^(uppercase|lowercase|capitalize|normal-case)$/,
  textDecoration: /^(underline|overline|line-through|no-underline)$/,
  color: /^text-((\w+)(-\d+)?|\[.+\])$/,
  
  // Backgrounds
  backgroundColor: /^bg-((\w+)(-\d+)?|\[.+\])$/,
  backgroundSize: /^bg-(auto|cover|contain|\[.+\])$/,
  backgroundPosition: /^bg-(bottom|center|left|left-bottom|left-top|right|right-bottom|right-top|top|\[.+\])$/,
  backgroundRepeat: /^bg-(repeat|no-repeat|repeat-x|repeat-y|repeat-round|repeat-space)$/,
  backgroundImage: /^bg-(none|gradient-to-t|gradient-to-tr|gradient-to-r|gradient-to-br|gradient-to-b|gradient-to-bl|gradient-to-l|gradient-to-tl|\[.+\])$/,
  
  // Borders
  borderWidth: /^border(-\d+)?(\[.+\])?$/,
  borderTopWidth: /^border-t(-\d+)?(\[.+\])?$/,
  borderRightWidth: /^border-r(-\d+)?(\[.+\])?$/,
  borderBottomWidth: /^border-b(-\d+)?(\[.+\])?$/,
  borderLeftWidth: /^border-l(-\d+)?(\[.+\])?$/,
  borderStyle: /^border-(solid|dashed|dotted|double|hidden|none)$/,
  borderColor: /^border-((\w+)(-\d+)?|\[.+\])$/,
  borderRadius: /^rounded(-none|-sm|-md|-lg|-xl|-2xl|-3xl|-full)?(\[.+\])?$/,
  borderTopLeftRadius: /^rounded-tl(-none|-sm|-md|-lg|-xl|-2xl|-3xl|-full)?(\[.+\])?$/,
  borderTopRightRadius: /^rounded-tr(-none|-sm|-md|-lg|-xl|-2xl|-3xl|-full)?(\[.+\])?$/,
  borderBottomRightRadius: /^rounded-br(-none|-sm|-md|-lg|-xl|-2xl|-3xl|-full)?(\[.+\])?$/,
  borderBottomLeftRadius: /^rounded-bl(-none|-sm|-md|-lg|-xl|-2xl|-3xl|-full)?(\[.+\])?$/,
  
  // Effects
  opacity: /^opacity-(\d+|\[.+\])$/,
  boxShadow: /^shadow(-none|-sm|-md|-lg|-xl|-2xl|-inner)?(\[.+\])?$/,
  
  // Positioning
  position: /^(static|fixed|absolute|relative|sticky)$/,
  top: /^top-(\[.+\]|\d+|px|auto|0\.5|1\.5|2\.5|3\.5)$/,
  right: /^right-(\[.+\]|\d+|px|auto|0\.5|1\.5|2\.5|3\.5)$/,
  bottom: /^bottom-(\[.+\]|\d+|px|auto|0\.5|1\.5|2\.5|3\.5)$/,
  left: /^left-(\[.+\]|\d+|px|auto|0\.5|1\.5|2\.5|3\.5)$/,
  zIndex: /^z-(\[.+\]|\d+|auto)$/,
};

/**
 * Get the conflicting class pattern for a given property
 */
export function getConflictingClassPattern(property: string): RegExp | null {
  return CLASS_PROPERTY_MAP[property] || null;
}

/**
 * Remove conflicting classes based on property name
 */
export function removeConflictingClasses(
  classes: string[],
  property: string
): string[] {
  const pattern = getConflictingClassPattern(property);
  if (!pattern) return classes;
  
  return classes.filter(cls => !pattern.test(cls));
}

/**
 * Replace a conflicting class with a new one
 */
export function replaceConflictingClasses(
  existingClasses: string[],
  property: string,
  newClass: string | null
): string[] {
  const filtered = removeConflictingClasses(existingClasses, property);
  
  if (newClass) {
    return [...filtered, newClass];
  }
  
  return filtered;
}

/**
 * Convert a design property value to a Tailwind class
 */
export function propertyToClass(
  category: keyof NonNullable<Layer['design']>,
  property: string,
  value: string
): string | null {
  if (!value) return null;
  
  // Layout conversions
  if (category === 'layout') {
    switch (property) {
      case 'display':
        return value; // Already a valid class: 'flex', 'grid', 'block', etc.
      case 'flexDirection':
        if (value === 'row') return 'flex-row';
        if (value === 'column') return 'flex-col';
        if (value === 'row-reverse') return 'flex-row-reverse';
        if (value === 'column-reverse') return 'flex-col-reverse';
        return `flex-${value}`;
      case 'flexWrap':
        if (value === 'wrap') return 'flex-wrap';
        if (value === 'nowrap') return 'flex-nowrap';
        if (value === 'wrap-reverse') return 'flex-wrap-reverse';
        return null;
      case 'justifyContent':
        return `justify-${value}`;
      case 'alignItems':
        return `items-${value}`;
      case 'alignContent':
        return `content-${value}`;
      case 'gap':
        return value.match(/^\d/) ? `gap-[${value}]` : `gap-${value}`;
      case 'columnGap':
        return value.match(/^\d/) ? `gap-x-[${value}]` : `gap-x-${value}`;
      case 'rowGap':
        return value.match(/^\d/) ? `gap-y-[${value}]` : `gap-y-${value}`;
      case 'gridTemplateColumns':
        return `grid-cols-[${value}]`;
      case 'gridTemplateRows':
        return `grid-rows-[${value}]`;
    }
  }
  
  // Typography conversions
  if (category === 'typography') {
    switch (property) {
      case 'fontSize':
        return value.match(/^\d/) ? `text-[${value}]` : `text-${value}`;
      case 'fontWeight':
        return `font-${value}`;
      case 'fontFamily':
        return `font-${value}`;
      case 'lineHeight':
        return value.match(/^\d/) ? `leading-[${value}]` : `leading-${value}`;
      case 'letterSpacing':
        return value.match(/^\d/) ? `tracking-[${value}]` : `tracking-${value}`;
      case 'textAlign':
        return `text-${value}`;
      case 'textTransform':
        if (value === 'none') return 'normal-case';
        return value; // uppercase, lowercase, capitalize
      case 'textDecoration':
        if (value === 'none') return 'no-underline';
        return value; // underline, line-through, overline
      case 'color':
        return value.match(/^#|^rgb/) ? `text-[${value}]` : `text-${value}`;
    }
  }
  
  // Spacing conversions
  if (category === 'spacing') {
    const prefixMap: Record<string, string> = {
      padding: 'p',
      paddingTop: 'pt',
      paddingRight: 'pr',
      paddingBottom: 'pb',
      paddingLeft: 'pl',
      margin: 'm',
      marginTop: 'mt',
      marginRight: 'mr',
      marginBottom: 'mb',
      marginLeft: 'ml',
    };
    
    const prefix = prefixMap[property];
    if (prefix) {
      if (value === 'auto') return `${prefix}-auto`;
      return value.match(/^\d/) ? `${prefix}-[${value}]` : `${prefix}-${value}`;
    }
  }
  
  // Sizing conversions
  if (category === 'sizing') {
    const prefixMap: Record<string, string> = {
      width: 'w',
      height: 'h',
      minWidth: 'min-w',
      minHeight: 'min-h',
      maxWidth: 'max-w',
      maxHeight: 'max-h',
    };
    
    const prefix = prefixMap[property];
    if (prefix) {
      if (['auto', 'full', 'screen', 'min', 'max', 'fit'].includes(value)) {
        return `${prefix}-${value}`;
      }
      if (value === '100%') return `${prefix}-full`;
      return value.match(/^\d/) ? `${prefix}-[${value}]` : `${prefix}-${value}`;
    }
  }
  
  // Borders conversions
  if (category === 'borders') {
    switch (property) {
      case 'borderWidth':
        return value === '1px' ? 'border' : `border-[${value}]`;
      case 'borderTopWidth':
        return value === '1px' ? 'border-t' : `border-t-[${value}]`;
      case 'borderRightWidth':
        return value === '1px' ? 'border-r' : `border-r-[${value}]`;
      case 'borderBottomWidth':
        return value === '1px' ? 'border-b' : `border-b-[${value}]`;
      case 'borderLeftWidth':
        return value === '1px' ? 'border-l' : `border-l-[${value}]`;
      case 'borderStyle':
        return `border-${value}`;
      case 'borderColor':
        return value.match(/^#|^rgb/) ? `border-[${value}]` : `border-${value}`;
      case 'borderRadius':
        return value.match(/^\d/) ? `rounded-[${value}]` : `rounded${value !== 'none' ? '-' + value : ''}`;
      case 'borderTopLeftRadius':
        return value.match(/^\d/) ? `rounded-tl-[${value}]` : `rounded-tl${value !== 'none' ? '-' + value : ''}`;
      case 'borderTopRightRadius':
        return value.match(/^\d/) ? `rounded-tr-[${value}]` : `rounded-tr${value !== 'none' ? '-' + value : ''}`;
      case 'borderBottomRightRadius':
        return value.match(/^\d/) ? `rounded-br-[${value}]` : `rounded-br${value !== 'none' ? '-' + value : ''}`;
      case 'borderBottomLeftRadius':
        return value.match(/^\d/) ? `rounded-bl-[${value}]` : `rounded-bl${value !== 'none' ? '-' + value : ''}`;
    }
  }
  
  // Backgrounds conversions
  if (category === 'backgrounds') {
    switch (property) {
      case 'backgroundColor':
        return value.match(/^#|^rgb/) ? `bg-[${value}]` : `bg-${value}`;
      case 'backgroundImage':
        if (value.startsWith('url(')) return `bg-[${value}]`;
        return `bg-${value}`;
      case 'backgroundSize':
        return `bg-${value}`;
      case 'backgroundPosition':
        return `bg-${value}`;
      case 'backgroundRepeat':
        if (value === 'no-repeat') return 'bg-no-repeat';
        return `bg-${value}`;
    }
  }
  
  // Effects conversions
  if (category === 'effects') {
    switch (property) {
      case 'opacity':
        // Convert 0-100 to 0-100 or decimal to percentage
        const opacityValue = value.includes('.') 
          ? Math.round(parseFloat(value) * 100).toString()
          : value;
        return `opacity-[${opacityValue}%]`;
      case 'boxShadow':
        if (value === 'none') return 'shadow-none';
        if (['sm', 'md', 'lg', 'xl', '2xl', 'inner'].includes(value)) {
          return `shadow-${value}`;
        }
        return `shadow-[${value}]`;
    }
  }
  
  // Positioning conversions
  if (category === 'positioning') {
    switch (property) {
      case 'position':
        return value; // static, relative, absolute, fixed, sticky
      case 'top':
      case 'right':
      case 'bottom':
      case 'left':
        if (value === 'auto') return `${property}-auto`;
        return value.match(/^\d/) ? `${property}-[${value}]` : `${property}-${value}`;
      case 'zIndex':
        if (value === 'auto') return 'z-auto';
        return value.match(/^\d/) ? `z-[${value}]` : `z-${value}`;
    }
  }
  
  return null;
}

/**
 * Convert design object to Tailwind classes array
 */
export function designToClasses(design?: Layer['design']): string[] {
  if (!design) return [];
  
  const classes: string[] = [];
  
  // Process each category
  Object.entries(design).forEach(([category, properties]) => {
    if (!properties || typeof properties !== 'object') return;
    
    Object.entries(properties).forEach(([property, value]) => {
      if (property === 'isActive' || !value) return;
      
      const cls = propertyToClass(
        category as keyof NonNullable<Layer['design']>,
        property,
        value as string
      );
      
      if (cls) {
        classes.push(cls);
      }
    });
  });
  
  return classes;
}

/**
 * Detect which design properties a class affects
 * Returns an array of property names that should have conflicts removed
 */
export function getAffectedProperties(className: string): string[] {
  const properties: string[] = [];
  
  // Check each property pattern to see if this class matches
  for (const [property, pattern] of Object.entries(CLASS_PROPERTY_MAP)) {
    if (pattern.test(className)) {
      properties.push(property);
    }
  }
  
  return properties;
}

/**
 * Remove all classes that conflict with the new class being added
 */
export function removeConflictsForClass(
  existingClasses: string[],
  newClass: string
): string[] {
  const affectedProperties = getAffectedProperties(newClass);
  
  // Start with existing classes
  let result = existingClasses;
  
  // Remove conflicts for each affected property
  affectedProperties.forEach(property => {
    result = removeConflictingClasses(result, property);
  });
  
  return result;
}

/**
 * Helper: Extract arbitrary value from class
 * Example: 'text-[10em]' → '10em'
 */
function extractArbitraryValue(className: string): string | null {
  const match = className.match(/\[(.+)\]/);
  return match ? match[1] : null;
}

/**
 * Helper: Merge two design objects
 */
export function mergeDesign(existing: Layer['design'] | undefined, parsed: Layer['design'] | undefined): Layer['design'] {
  if (!parsed) return existing || {};
  
  const result: Layer['design'] = {
    layout: { ...(existing?.layout || {}), ...(parsed.layout || {}) },
    typography: { ...(existing?.typography || {}), ...(parsed.typography || {}) },
    spacing: { ...(existing?.spacing || {}), ...(parsed.spacing || {}) },
    sizing: { ...(existing?.sizing || {}), ...(parsed.sizing || {}) },
    borders: { ...(existing?.borders || {}), ...(parsed.borders || {}) },
    backgrounds: { ...(existing?.backgrounds || {}), ...(parsed.backgrounds || {}) },
    effects: { ...(existing?.effects || {}), ...(parsed.effects || {}) },
    positioning: { ...(existing?.positioning || {}), ...(parsed.positioning || {}) },
  };
  return result;
}

/**
 * Parse Tailwind classes back to design object
 * Comprehensive parser for all design properties
 */
export function classesToDesign(classes: string | string[]): Layer['design'] {
  const classList = Array.isArray(classes) ? classes : classes.split(' ').filter(Boolean);
  
  const design: Layer['design'] = {
    layout: {},
    typography: {},
    spacing: {},
    sizing: {},
    borders: {},
    backgrounds: {},
    effects: {},
    positioning: {},
  };
  
  classList.forEach(cls => {
    // ===== LAYOUT =====
    // Display
    if (cls === 'block') design.layout!.display = 'block';
    if (cls === 'inline-block') design.layout!.display = 'inline-block';
    if (cls === 'inline') design.layout!.display = 'inline';
    if (cls === 'flex') design.layout!.display = 'flex';
    if (cls === 'inline-flex') design.layout!.display = 'inline-flex';
    if (cls === 'grid') design.layout!.display = 'grid';
    if (cls === 'inline-grid') design.layout!.display = 'inline-grid';
    if (cls === 'hidden') design.layout!.display = 'hidden';
    
    // Flex Direction
    if (cls === 'flex-row') design.layout!.flexDirection = 'row';
    if (cls === 'flex-row-reverse') design.layout!.flexDirection = 'row-reverse';
    if (cls === 'flex-col') design.layout!.flexDirection = 'column';
    if (cls === 'flex-col-reverse') design.layout!.flexDirection = 'column-reverse';
    
    // Justify Content
    if (cls.startsWith('justify-')) {
      const value = cls.replace('justify-', '');
      if (['start', 'end', 'center', 'between', 'around', 'evenly', 'stretch'].includes(value)) {
        design.layout!.justifyContent = value;
      }
    }
    
    // Align Items
    if (cls.startsWith('items-')) {
      const value = cls.replace('items-', '');
      if (['start', 'end', 'center', 'baseline', 'stretch'].includes(value)) {
        design.layout!.alignItems = value;
      }
    }
    
    // Gap
    if (cls.startsWith('gap-[')) {
      const value = extractArbitraryValue(cls);
      if (value) design.layout!.gap = value;
    }
    
    // Grid
    if (cls.startsWith('grid-cols-[')) {
      const value = extractArbitraryValue(cls);
      if (value) design.layout!.gridTemplateColumns = value;
    }
    if (cls.startsWith('grid-rows-[')) {
      const value = extractArbitraryValue(cls);
      if (value) design.layout!.gridTemplateRows = value;
    }
    
    // ===== TYPOGRAPHY =====
    // Font Size
    if (cls.startsWith('text-[') && !cls.includes('#') && !cls.includes('rgb')) {
      const value = extractArbitraryValue(cls);
      if (value) design.typography!.fontSize = value;
    }
    
    // Font Weight
    if (cls === 'font-thin') design.typography!.fontWeight = '100';
    if (cls === 'font-extralight') design.typography!.fontWeight = '200';
    if (cls === 'font-light') design.typography!.fontWeight = '300';
    if (cls === 'font-normal') design.typography!.fontWeight = '400';
    if (cls === 'font-medium') design.typography!.fontWeight = '500';
    if (cls === 'font-semibold') design.typography!.fontWeight = '600';
    if (cls === 'font-bold') design.typography!.fontWeight = '700';
    if (cls === 'font-extrabold') design.typography!.fontWeight = '800';
    if (cls === 'font-black') design.typography!.fontWeight = '900';
    
    // Font Family
    if (cls === 'font-sans') design.typography!.fontFamily = 'sans-serif';
    if (cls === 'font-serif') design.typography!.fontFamily = 'serif';
    if (cls === 'font-mono') design.typography!.fontFamily = 'monospace';
    
    // Text Align
    if (cls === 'text-left') design.typography!.textAlign = 'left';
    if (cls === 'text-center') design.typography!.textAlign = 'center';
    if (cls === 'text-right') design.typography!.textAlign = 'right';
    if (cls === 'text-justify') design.typography!.textAlign = 'justify';
    
    // Text Transform
    if (cls === 'uppercase') design.typography!.textTransform = 'uppercase';
    if (cls === 'lowercase') design.typography!.textTransform = 'lowercase';
    if (cls === 'capitalize') design.typography!.textTransform = 'capitalize';
    if (cls === 'normal-case') design.typography!.textTransform = 'none';
    
    // Text Decoration
    if (cls === 'underline') design.typography!.textDecoration = 'underline';
    if (cls === 'line-through') design.typography!.textDecoration = 'line-through';
    if (cls === 'no-underline') design.typography!.textDecoration = 'none';
    
    // Line Height
    if (cls.startsWith('leading-[')) {
      const value = extractArbitraryValue(cls);
      if (value) design.typography!.lineHeight = value;
    }
    
    // Letter Spacing
    if (cls.startsWith('tracking-[')) {
      const value = extractArbitraryValue(cls);
      if (value) design.typography!.letterSpacing = value;
    }
    
    // Text Color
    if (cls.startsWith('text-[#') || cls.startsWith('text-[rgb')) {
      const value = extractArbitraryValue(cls);
      if (value) design.typography!.color = value;
    }
    
    // ===== SPACING =====
    // Padding
    if (cls.startsWith('p-[')) {
      const value = extractArbitraryValue(cls);
      if (value) design.spacing!.padding = value;
    } else if (cls.startsWith('pt-[')) {
      const value = extractArbitraryValue(cls);
      if (value) design.spacing!.paddingTop = value;
    } else if (cls.startsWith('pr-[')) {
      const value = extractArbitraryValue(cls);
      if (value) design.spacing!.paddingRight = value;
    } else if (cls.startsWith('pb-[')) {
      const value = extractArbitraryValue(cls);
      if (value) design.spacing!.paddingBottom = value;
    } else if (cls.startsWith('pl-[')) {
      const value = extractArbitraryValue(cls);
      if (value) design.spacing!.paddingLeft = value;
    }
    
    // Margin
    if (cls.startsWith('m-[')) {
      const value = extractArbitraryValue(cls);
      if (value) design.spacing!.margin = value;
    } else if (cls.startsWith('mt-[')) {
      const value = extractArbitraryValue(cls);
      if (value) design.spacing!.marginTop = value;
    } else if (cls.startsWith('mr-[')) {
      const value = extractArbitraryValue(cls);
      if (value) design.spacing!.marginRight = value;
    } else if (cls.startsWith('mb-[')) {
      const value = extractArbitraryValue(cls);
      if (value) design.spacing!.marginBottom = value;
    } else if (cls.startsWith('ml-[')) {
      const value = extractArbitraryValue(cls);
      if (value) design.spacing!.marginLeft = value;
    }
    
    // ===== SIZING =====
    // Width
    if (cls.startsWith('w-[')) {
      const value = extractArbitraryValue(cls);
      if (value) design.sizing!.width = value;
    }
    
    // Height
    if (cls.startsWith('h-[')) {
      const value = extractArbitraryValue(cls);
      if (value) design.sizing!.height = value;
    }
    
    // Min Width
    if (cls.startsWith('min-w-[')) {
      const value = extractArbitraryValue(cls);
      if (value) design.sizing!.minWidth = value;
    }
    
    // Min Height
    if (cls.startsWith('min-h-[')) {
      const value = extractArbitraryValue(cls);
      if (value) design.sizing!.minHeight = value;
    }
    
    // Max Width
    if (cls.startsWith('max-w-[')) {
      const value = extractArbitraryValue(cls);
      if (value) design.sizing!.maxWidth = value;
    }
    
    // Max Height
    if (cls.startsWith('max-h-[')) {
      const value = extractArbitraryValue(cls);
      if (value) design.sizing!.maxHeight = value;
    }
    
    // ===== BORDERS =====
    // Border Radius (all)
    if (cls.startsWith('rounded-[')) {
      const value = extractArbitraryValue(cls);
      if (value) design.borders!.borderRadius = value;
    }
    // Border Radius (individual corners)
    else if (cls.startsWith('rounded-tl-[')) {
      const value = extractArbitraryValue(cls);
      if (value) design.borders!.borderTopLeftRadius = value;
    } else if (cls.startsWith('rounded-tr-[')) {
      const value = extractArbitraryValue(cls);
      if (value) design.borders!.borderTopRightRadius = value;
    } else if (cls.startsWith('rounded-br-[')) {
      const value = extractArbitraryValue(cls);
      if (value) design.borders!.borderBottomRightRadius = value;
    } else if (cls.startsWith('rounded-bl-[')) {
      const value = extractArbitraryValue(cls);
      if (value) design.borders!.borderBottomLeftRadius = value;
    }
    
    // Border Width (all)
    if (cls.startsWith('border-[') && !cls.includes('#') && !cls.includes('rgb')) {
      const value = extractArbitraryValue(cls);
      if (value) design.borders!.borderWidth = value;
    }
    
    // Border Style
    if (cls === 'border-solid') design.borders!.borderStyle = 'solid';
    if (cls === 'border-dashed') design.borders!.borderStyle = 'dashed';
    if (cls === 'border-dotted') design.borders!.borderStyle = 'dotted';
    if (cls === 'border-double') design.borders!.borderStyle = 'double';
    if (cls === 'border-none') design.borders!.borderStyle = 'none';
    
    // Border Color
    if (cls.startsWith('border-[#') || cls.startsWith('border-[rgb')) {
      const value = extractArbitraryValue(cls);
      if (value) design.borders!.borderColor = value;
    }
    
    // ===== BACKGROUNDS =====
    // Background Color
    if (cls.startsWith('bg-[#') || cls.startsWith('bg-[rgb')) {
      const value = extractArbitraryValue(cls);
      if (value) design.backgrounds!.backgroundColor = value;
    }
    
    // ===== EFFECTS =====
    // Opacity
    if (cls.startsWith('opacity-[')) {
      const value = extractArbitraryValue(cls);
      if (value) design.effects!.opacity = value;
    }
    
    // Box Shadow
    if (cls.startsWith('shadow-[')) {
      const value = extractArbitraryValue(cls);
      if (value) design.effects!.boxShadow = value;
    }
    
    // ===== POSITIONING =====
    // Position
    if (cls === 'static') design.positioning!.position = 'static';
    if (cls === 'relative') design.positioning!.position = 'relative';
    if (cls === 'absolute') design.positioning!.position = 'absolute';
    if (cls === 'fixed') design.positioning!.position = 'fixed';
    if (cls === 'sticky') design.positioning!.position = 'sticky';
    
    // Top/Right/Bottom/Left
    if (cls.startsWith('top-[')) {
      const value = extractArbitraryValue(cls);
      if (value) design.positioning!.top = value;
    }
    if (cls.startsWith('right-[')) {
      const value = extractArbitraryValue(cls);
      if (value) design.positioning!.right = value;
    }
    if (cls.startsWith('bottom-[')) {
      const value = extractArbitraryValue(cls);
      if (value) design.positioning!.bottom = value;
    }
    if (cls.startsWith('left-[')) {
      const value = extractArbitraryValue(cls);
      if (value) design.positioning!.left = value;
    }
    
    // Z-Index
    if (cls.startsWith('z-[')) {
      const value = extractArbitraryValue(cls);
      if (value) design.positioning!.zIndex = value;
    }
  });
  
  return design;
}


