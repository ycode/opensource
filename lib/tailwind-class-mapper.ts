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
 * Parse Tailwind classes back to design object
 * This is a simplified version - full parsing would be complex
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
  
  // This is a basic parser - can be expanded as needed
  classList.forEach(cls => {
    // Layout
    if (cls === 'flex') design.layout!.display = 'flex';
    if (cls === 'grid') design.layout!.display = 'grid';
    if (cls === 'block') design.layout!.display = 'block';
    if (cls.startsWith('flex-row')) design.layout!.flexDirection = 'row';
    if (cls.startsWith('flex-col')) design.layout!.flexDirection = 'column';
    if (cls.startsWith('justify-')) design.layout!.justifyContent = cls.replace('justify-', '');
    if (cls.startsWith('items-')) design.layout!.alignItems = cls.replace('items-', '');
    
    // Gap
    if (cls.startsWith('gap-[')) {
      const value = cls.match(/gap-\[(.+)\]/)?.[1];
      if (value) design.layout!.gap = value;
    }
    
    // Typography
    if (cls.startsWith('text-[') && !cls.includes('text-[#') && !cls.includes('text-[rgb')) {
      const value = cls.match(/text-\[(.+)\]/)?.[1];
      if (value) design.typography!.fontSize = value;
    }
    
    // Add more parsing as needed...
  });
  
  return design;
}


