/**
 * Tailwind Class Suggestions System
 * 
 * Provides intelligent autocomplete suggestions for Tailwind CSS classes
 * including standard classes, arbitrary values, and color previews
 */

/**
 * Comprehensive list of common Tailwind classes organized by category
 */
const TAILWIND_CLASSES = [
  // Layout - Display
  'block',
  'inline-block',
  'inline',
  'flex',
  'inline-flex',
  'grid',
  'inline-grid',
  'hidden',
  
  // Layout - Flex Direction
  'flex-row',
  'flex-row-reverse',
  'flex-col',
  'flex-col-reverse',
  
  // Layout - Flex Wrap
  'flex-wrap',
  'flex-wrap-reverse',
  'flex-nowrap',
  
  // Layout - Justify Content
  'justify-start',
  'justify-end',
  'justify-center',
  'justify-between',
  'justify-around',
  'justify-evenly',
  'justify-stretch',
  
  // Layout - Align Items
  'items-start',
  'items-end',
  'items-center',
  'items-baseline',
  'items-stretch',
  
  // Layout - Align Content
  'content-start',
  'content-end',
  'content-center',
  'content-between',
  'content-around',
  'content-evenly',
  'content-stretch',
  
  // Layout - Gap
  'gap-0',
  'gap-1',
  'gap-2',
  'gap-3',
  'gap-4',
  'gap-5',
  'gap-6',
  'gap-8',
  'gap-10',
  'gap-12',
  'gap-16',
  'gap-20',
  'gap-24',
  
  // Typography - Font Size
  'text-xs',
  'text-sm',
  'text-base',
  'text-lg',
  'text-xl',
  'text-2xl',
  'text-3xl',
  'text-4xl',
  'text-5xl',
  'text-6xl',
  
  // Typography - Font Weight
  'font-thin',
  'font-extralight',
  'font-light',
  'font-normal',
  'font-medium',
  'font-semibold',
  'font-bold',
  'font-extrabold',
  'font-black',
  
  // Typography - Font Family
  'font-sans',
  'font-serif',
  'font-mono',
  
  // Typography - Text Align
  'text-left',
  'text-center',
  'text-right',
  'text-justify',
  
  // Typography - Text Transform
  'uppercase',
  'lowercase',
  'capitalize',
  'normal-case',
  
  // Typography - Text Decoration
  'underline',
  'line-through',
  'no-underline',
  
  // Typography - Line Height
  'leading-none',
  'leading-tight',
  'leading-snug',
  'leading-normal',
  'leading-relaxed',
  'leading-loose',
  
  // Typography - Letter Spacing
  'tracking-tighter',
  'tracking-tight',
  'tracking-normal',
  'tracking-wide',
  'tracking-wider',
  'tracking-widest',
  
  // Spacing - Padding
  'p-0',
  'p-1',
  'p-2',
  'p-3',
  'p-4',
  'p-5',
  'p-6',
  'p-8',
  'p-10',
  'p-12',
  'p-16',
  'p-20',
  'p-24',
  'px-0',
  'px-1',
  'px-2',
  'px-3',
  'px-4',
  'px-6',
  'px-8',
  'px-10',
  'py-0',
  'py-1',
  'py-2',
  'py-3',
  'py-4',
  'py-6',
  'py-8',
  'py-10',
  'pt-0',
  'pt-1',
  'pt-2',
  'pt-4',
  'pt-6',
  'pt-8',
  'pr-0',
  'pr-1',
  'pr-2',
  'pr-4',
  'pr-6',
  'pr-8',
  'pb-0',
  'pb-1',
  'pb-2',
  'pb-4',
  'pb-6',
  'pb-8',
  'pl-0',
  'pl-1',
  'pl-2',
  'pl-4',
  'pl-6',
  'pl-8',
  
  // Spacing - Margin
  'm-0',
  'm-1',
  'm-2',
  'm-3',
  'm-4',
  'm-5',
  'm-6',
  'm-8',
  'm-10',
  'm-auto',
  'mx-0',
  'mx-1',
  'mx-2',
  'mx-4',
  'mx-6',
  'mx-8',
  'mx-auto',
  'my-0',
  'my-1',
  'my-2',
  'my-4',
  'my-6',
  'my-8',
  'my-auto',
  'mt-0',
  'mt-1',
  'mt-2',
  'mt-4',
  'mt-6',
  'mt-8',
  'mt-auto',
  'mr-0',
  'mr-1',
  'mr-2',
  'mr-4',
  'mr-6',
  'mr-8',
  'mr-auto',
  'mb-0',
  'mb-1',
  'mb-2',
  'mb-4',
  'mb-6',
  'mb-8',
  'mb-auto',
  'ml-0',
  'ml-1',
  'ml-2',
  'ml-4',
  'ml-6',
  'ml-8',
  'ml-auto',
  
  // Sizing - Width
  'w-0',
  'w-1',
  'w-2',
  'w-4',
  'w-8',
  'w-12',
  'w-16',
  'w-20',
  'w-24',
  'w-32',
  'w-40',
  'w-48',
  'w-64',
  'w-auto',
  'w-full',
  'w-screen',
  'w-min',
  'w-max',
  'w-fit',
  
  // Sizing - Height
  'h-0',
  'h-1',
  'h-2',
  'h-4',
  'h-8',
  'h-12',
  'h-16',
  'h-20',
  'h-24',
  'h-32',
  'h-40',
  'h-48',
  'h-64',
  'h-auto',
  'h-full',
  'h-screen',
  'h-min',
  'h-max',
  'h-fit',
  
  // Sizing - Min/Max
  'min-w-0',
  'min-w-full',
  'min-w-min',
  'min-w-max',
  'min-w-fit',
  'max-w-xs',
  'max-w-sm',
  'max-w-md',
  'max-w-lg',
  'max-w-xl',
  'max-w-2xl',
  'max-w-full',
  'min-h-0',
  'min-h-full',
  'min-h-screen',
  'max-h-full',
  'max-h-screen',
  
  // Borders - Width
  'border',
  'border-0',
  'border-2',
  'border-4',
  'border-8',
  'border-t',
  'border-t-0',
  'border-t-2',
  'border-r',
  'border-r-0',
  'border-r-2',
  'border-b',
  'border-b-0',
  'border-b-2',
  'border-l',
  'border-l-0',
  'border-l-2',
  
  // Borders - Style
  'border-solid',
  'border-dashed',
  'border-dotted',
  'border-double',
  'border-none',
  
  // Borders - Radius
  'rounded',
  'rounded-none',
  'rounded-sm',
  'rounded-md',
  'rounded-lg',
  'rounded-xl',
  'rounded-2xl',
  'rounded-3xl',
  'rounded-full',
  'rounded-t',
  'rounded-r',
  'rounded-b',
  'rounded-l',
  'rounded-tl',
  'rounded-tr',
  'rounded-br',
  'rounded-bl',
  
  // Effects - Shadow
  'shadow',
  'shadow-sm',
  'shadow-md',
  'shadow-lg',
  'shadow-xl',
  'shadow-2xl',
  'shadow-inner',
  'shadow-none',
  
  // Effects - Opacity
  'opacity-0',
  'opacity-25',
  'opacity-50',
  'opacity-75',
  'opacity-100',
  
  // Positioning - Position
  'static',
  'fixed',
  'absolute',
  'relative',
  'sticky',
  
  // Positioning - Inset
  'inset-0',
  'inset-auto',
  'top-0',
  'top-auto',
  'right-0',
  'right-auto',
  'bottom-0',
  'bottom-auto',
  'left-0',
  'left-auto',
  
  // Positioning - Z-Index
  'z-0',
  'z-10',
  'z-20',
  'z-30',
  'z-40',
  'z-50',
  'z-auto',
];

/**
 * Tailwind color palette with HEX values
 */
const COLOR_PALETTE: Record<string, string> = {
  // Slate
  'slate-50': '#f8fafc',
  'slate-100': '#f1f5f9',
  'slate-200': '#e2e8f0',
  'slate-300': '#cbd5e1',
  'slate-400': '#94a3b8',
  'slate-500': '#64748b',
  'slate-600': '#475569',
  'slate-700': '#334155',
  'slate-800': '#1e293b',
  'slate-900': '#0f172a',
  
  // Gray
  'gray-50': '#f9fafb',
  'gray-100': '#f3f4f6',
  'gray-200': '#e5e7eb',
  'gray-300': '#d1d5db',
  'gray-400': '#9ca3af',
  'gray-500': '#6b7280',
  'gray-600': '#4b5563',
  'gray-700': '#374151',
  'gray-800': '#1f2937',
  'gray-900': '#111827',
  
  // Zinc
  'zinc-50': '#fafafa',
  'zinc-100': '#f4f4f5',
  'zinc-200': '#e4e4e7',
  'zinc-300': '#d4d4d8',
  'zinc-400': '#a1a1aa',
  'zinc-500': '#71717a',
  'zinc-600': '#52525b',
  'zinc-700': '#3f3f46',
  'zinc-800': '#27272a',
  'zinc-900': '#18181b',
  
  // Red
  'red-50': '#fef2f2',
  'red-100': '#fee2e2',
  'red-200': '#fecaca',
  'red-300': '#fca5a5',
  'red-400': '#f87171',
  'red-500': '#ef4444',
  'red-600': '#dc2626',
  'red-700': '#b91c1c',
  'red-800': '#991b1b',
  'red-900': '#7f1d1d',
  
  // Orange
  'orange-50': '#fff7ed',
  'orange-100': '#ffedd5',
  'orange-200': '#fed7aa',
  'orange-300': '#fdba74',
  'orange-400': '#fb923c',
  'orange-500': '#f97316',
  'orange-600': '#ea580c',
  'orange-700': '#c2410c',
  'orange-800': '#9a3412',
  'orange-900': '#7c2d12',
  
  // Amber
  'amber-50': '#fffbeb',
  'amber-100': '#fef3c7',
  'amber-200': '#fde68a',
  'amber-300': '#fcd34d',
  'amber-400': '#fbbf24',
  'amber-500': '#f59e0b',
  'amber-600': '#d97706',
  'amber-700': '#b45309',
  'amber-800': '#92400e',
  'amber-900': '#78350f',
  
  // Yellow
  'yellow-50': '#fefce8',
  'yellow-100': '#fef9c3',
  'yellow-200': '#fef08a',
  'yellow-300': '#fde047',
  'yellow-400': '#facc15',
  'yellow-500': '#eab308',
  'yellow-600': '#ca8a04',
  'yellow-700': '#a16207',
  'yellow-800': '#854d0e',
  'yellow-900': '#713f12',
  
  // Lime
  'lime-50': '#f7fee7',
  'lime-100': '#ecfccb',
  'lime-200': '#d9f99d',
  'lime-300': '#bef264',
  'lime-400': '#a3e635',
  'lime-500': '#84cc16',
  'lime-600': '#65a30d',
  'lime-700': '#4d7c0f',
  'lime-800': '#3f6212',
  'lime-900': '#365314',
  
  // Green
  'green-50': '#f0fdf4',
  'green-100': '#dcfce7',
  'green-200': '#bbf7d0',
  'green-300': '#86efac',
  'green-400': '#4ade80',
  'green-500': '#22c55e',
  'green-600': '#16a34a',
  'green-700': '#15803d',
  'green-800': '#166534',
  'green-900': '#14532d',
  
  // Emerald
  'emerald-50': '#ecfdf5',
  'emerald-100': '#d1fae5',
  'emerald-200': '#a7f3d0',
  'emerald-300': '#6ee7b7',
  'emerald-400': '#34d399',
  'emerald-500': '#10b981',
  'emerald-600': '#059669',
  'emerald-700': '#047857',
  'emerald-800': '#065f46',
  'emerald-900': '#064e3b',
  
  // Teal
  'teal-50': '#f0fdfa',
  'teal-100': '#ccfbf1',
  'teal-200': '#99f6e4',
  'teal-300': '#5eead4',
  'teal-400': '#2dd4bf',
  'teal-500': '#14b8a6',
  'teal-600': '#0d9488',
  'teal-700': '#0f766e',
  'teal-800': '#115e59',
  'teal-900': '#134e4a',
  
  // Cyan
  'cyan-50': '#ecfeff',
  'cyan-100': '#cffafe',
  'cyan-200': '#a5f3fc',
  'cyan-300': '#67e8f9',
  'cyan-400': '#22d3ee',
  'cyan-500': '#06b6d4',
  'cyan-600': '#0891b2',
  'cyan-700': '#0e7490',
  'cyan-800': '#155e75',
  'cyan-900': '#164e63',
  
  // Sky
  'sky-50': '#f0f9ff',
  'sky-100': '#e0f2fe',
  'sky-200': '#bae6fd',
  'sky-300': '#7dd3fc',
  'sky-400': '#38bdf8',
  'sky-500': '#0ea5e9',
  'sky-600': '#0284c7',
  'sky-700': '#0369a1',
  'sky-800': '#075985',
  'sky-900': '#0c4a6e',
  
  // Blue
  'blue-50': '#eff6ff',
  'blue-100': '#dbeafe',
  'blue-200': '#bfdbfe',
  'blue-300': '#93c5fd',
  'blue-400': '#60a5fa',
  'blue-500': '#3b82f6',
  'blue-600': '#2563eb',
  'blue-700': '#1d4ed8',
  'blue-800': '#1e40af',
  'blue-900': '#1e3a8a',
  
  // Indigo
  'indigo-50': '#eef2ff',
  'indigo-100': '#e0e7ff',
  'indigo-200': '#c7d2fe',
  'indigo-300': '#a5b4fc',
  'indigo-400': '#818cf8',
  'indigo-500': '#6366f1',
  'indigo-600': '#4f46e5',
  'indigo-700': '#4338ca',
  'indigo-800': '#3730a3',
  'indigo-900': '#312e81',
  
  // Violet
  'violet-50': '#f5f3ff',
  'violet-100': '#ede9fe',
  'violet-200': '#ddd6fe',
  'violet-300': '#c4b5fd',
  'violet-400': '#a78bfa',
  'violet-500': '#8b5cf6',
  'violet-600': '#7c3aed',
  'violet-700': '#6d28d9',
  'violet-800': '#5b21b6',
  'violet-900': '#4c1d95',
  
  // Purple
  'purple-50': '#faf5ff',
  'purple-100': '#f3e8ff',
  'purple-200': '#e9d5ff',
  'purple-300': '#d8b4fe',
  'purple-400': '#c084fc',
  'purple-500': '#a855f7',
  'purple-600': '#9333ea',
  'purple-700': '#7e22ce',
  'purple-800': '#6b21a8',
  'purple-900': '#581c87',
  
  // Fuchsia
  'fuchsia-50': '#fdf4ff',
  'fuchsia-100': '#fae8ff',
  'fuchsia-200': '#f5d0fe',
  'fuchsia-300': '#f0abfc',
  'fuchsia-400': '#e879f9',
  'fuchsia-500': '#d946ef',
  'fuchsia-600': '#c026d3',
  'fuchsia-700': '#a21caf',
  'fuchsia-800': '#86198f',
  'fuchsia-900': '#701a75',
  
  // Pink
  'pink-50': '#fdf2f8',
  'pink-100': '#fce7f3',
  'pink-200': '#fbcfe8',
  'pink-300': '#f9a8d4',
  'pink-400': '#f472b6',
  'pink-500': '#ec4899',
  'pink-600': '#db2777',
  'pink-700': '#be185d',
  'pink-800': '#9d174d',
  'pink-900': '#831843',
  
  // Rose
  'rose-50': '#fff1f2',
  'rose-100': '#ffe4e6',
  'rose-200': '#fecdd3',
  'rose-300': '#fda4af',
  'rose-400': '#fb7185',
  'rose-500': '#f43f5e',
  'rose-600': '#e11d48',
  'rose-700': '#be123c',
  'rose-800': '#9f1239',
  'rose-900': '#881337',
};

// Generate color classes for all prefixes
const COLOR_CLASSES: string[] = [];
['bg', 'text', 'border'].forEach(prefix => {
  Object.keys(COLOR_PALETTE).forEach(color => {
    COLOR_CLASSES.push(`${prefix}-${color}`);
  });
});

// Combine all suggestions
const ALL_SUGGESTIONS = [...TAILWIND_CLASSES, ...COLOR_CLASSES].sort();

/**
 * Get all matching suggestions for the current input
 */
export function getSuggestions(input: string): string[] {
  if (!input) return [];
  
  const matches = ALL_SUGGESTIONS.filter(suggestion => 
    suggestion.startsWith(input) && suggestion !== input
  );
  
  return matches;
}

/**
 * Get the best matching suggestion (shortest/most likely)
 */
export function getBestSuggestion(input: string): string | null {
  if (!input) return null;
  
  // Don't suggest when user is typing arbitrary value
  if (input.endsWith('[')) {
    return null;
  }
  
  const matches = getSuggestions(input);
  
  // Return shortest match (most likely completion)
  if (matches.length > 0) {
    return matches.sort((a, b) => a.length - b.length)[0];
  }
  
  return null;
}

/**
 * Check if input is starting an arbitrary value
 */
export function isArbitraryValuePrefix(input: string): boolean {
  // Check for patterns like: text-[, bg-[, m-[, p-[, w-[, etc.
  return /^[\w-]+\[$/.test(input);
}

/**
 * Get example arbitrary value for a given prefix
 */
export function getArbitraryExample(input: string): string | null {
  if (input.startsWith('text-[')) return 'text-[10em]';
  if (input.startsWith('bg-[')) return 'bg-[#ff0000]';
  if (input.startsWith('border-[') && !input.includes('border-t') && !input.includes('border-r') && !input.includes('border-b') && !input.includes('border-l')) {
    return 'border-[2px]';
  }
  if (input.startsWith('w-[')) return 'w-[500px]';
  if (input.startsWith('h-[')) return 'h-[300px]';
  if (input.startsWith('p-[') || input.startsWith('pt-[') || input.startsWith('pr-[') || input.startsWith('pb-[') || input.startsWith('pl-[')) {
    return `${input.slice(0, -1)}20px]`;
  }
  if (input.startsWith('m-[') || input.startsWith('mt-[') || input.startsWith('mr-[') || input.startsWith('mb-[') || input.startsWith('ml-[')) {
    return `${input.slice(0, -1)}10px]`;
  }
  if (input.startsWith('rounded-[')) return 'rounded-[15px]';
  if (input.startsWith('gap-[')) return 'gap-[16px]';
  if (input.startsWith('opacity-[')) return 'opacity-[0.5]';
  if (input.startsWith('z-[')) return 'z-[100]';
  
  return null;
}

/**
 * Get color preview for a class name
 */
export function getColorPreview(className: string): string | null {
  // Check for arbitrary color values: bg-[#ff0000] or text-[rgb(255,0,0)]
  const arbitraryMatch = className.match(/\[#([0-9a-fA-F]{3,6})\]/);
  if (arbitraryMatch) {
    return `#${arbitraryMatch[1]}`;
  }
  
  const rgbMatch = className.match(/\[rgb\((\d+),\s*(\d+),\s*(\d+)\)\]/);
  if (rgbMatch) {
    return `rgb(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]})`;
  }
  
  // Check standard Tailwind colors
  for (const [colorKey, hexValue] of Object.entries(COLOR_PALETTE)) {
    if (className.includes(colorKey)) {
      return hexValue;
    }
  }
  
  return null;
}
