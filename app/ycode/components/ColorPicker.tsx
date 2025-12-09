'use client';

/**
 * ColorPicker Component
 *
 * A color picker wrapped in a Popover with a visual color button trigger
 * Supports solid colors (with draggable palette, hue, opacity) and gradients
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import debounce from 'lodash.debounce';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import Icon from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';

interface ColorPickerProps {
  value?: string;
  onChange: (value: string) => void;
  defaultValue?: string;
  placeholder?: string;
}

// Helper to convert hex/rgba to RgbaColor object
// Supports formats: #hex, #hex/opacity, #hexhex (8-char with alpha), rgba(...)
function parseColor(colorString: string): { r: number; g: number; b: number; a: number } {
  if (!colorString) return { r: 255, g: 255, b: 255, a: 1 };

  // Hex color with opacity suffix: #hex/opacity
  const hexWithOpacityMatch = colorString.match(/^#([0-9a-fA-F]{6})\/(\d+)$/);
  if (hexWithOpacityMatch) {
    const hex = hexWithOpacityMatch[1];
    const opacity = parseInt(hexWithOpacityMatch[2]) / 100;
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: opacity,
    };
  }

  // Hex color (6 or 8 chars)
  if (colorString.startsWith('#')) {
    const hex = colorString.slice(1);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    // Support old 8-char format for backward compatibility
    const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, a };
  }

  // RGBA string
  const rgbaMatch = colorString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (rgbaMatch) {
    return {
      r: parseInt(rgbaMatch[1]),
      g: parseInt(rgbaMatch[2]),
      b: parseInt(rgbaMatch[3]),
      a: rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1,
    };
  }

  return { r: 255, g: 255, b: 255, a: 1 };
}

// Helper to convert RgbaColor to hex string (always 6 chars, no alpha)
// Opacity is handled separately via Tailwind opacity syntax: bg-[#hex]/opacity
function rgbaToHex(rgba: { r: number; g: number; b: number; a: number }): string {
  const r = Math.round(rgba.r).toString(16).padStart(2, '0');
  const g = Math.round(rgba.g).toString(16).padStart(2, '0');
  const b = Math.round(rgba.b).toString(16).padStart(2, '0');
  const hex = `#${r}${g}${b}`;

  // If opacity is less than 1, append it as /opacity (0-100)
  if (rgba.a < 1) {
    const opacityPercent = Math.round(rgba.a * 100);
    return `${hex}/${opacityPercent}`;
  }

  return hex;
}

// Helper to get just the hex part (6 chars) from a color value
function getHexOnly(colorValue: string): string {
  if (!colorValue) return '#000000';

  // Extract hex from #hex/opacity format
  const hexWithOpacityMatch = colorValue.match(/^(#[0-9a-fA-F]{6})(?:\/\d+)?$/);
  if (hexWithOpacityMatch) {
    return hexWithOpacityMatch[1];
  }

  // Extract hex from 8-char format
  if (colorValue.length === 9 && colorValue.startsWith('#')) {
    return colorValue.slice(0, 7);
  }

  // Extract hex from 6-char format
  if (colorValue.length === 7 && colorValue.startsWith('#')) {
    return colorValue;
  }

  return '#000000';
}

// Helper to convert color string (hex or rgba) to rgba string format
// For gradients, we use rgba format to match Tailwind: rgba(r,g,b,a)
function colorToRgbaString(color: string): string {
  const parsed = parseColor(color);
  // Format: rgba(r,g,b,a) - no spaces, alpha as number (0-1)
  return `rgba(${Math.round(parsed.r)},${Math.round(parsed.g)},${Math.round(parsed.b)},${parsed.a})`;
}

// Helper to generate gradient CSS string
// For visual display in the gradient bar, always use linear-gradient at 90deg for consistency
function generateGradientCSS(stops: ColorStop[], type: 'linear' | 'radial', angle?: number): string {
  const stopsStr = stops.map(s => `${s.color} ${s.position}%`).join(', ');
  // Always display as linear gradient at 90deg in the bar for visual consistency
  // This applies to both linear and radial gradients when shown in the bar
  return `linear-gradient(90deg, ${stopsStr})`;
}

// Helper to generate HUE gradient CSS (0-360 degrees)
function generateHueGradientCSS(): string {
  return 'linear-gradient(90deg, hsl(0,100%,50%), hsl(60,100%,50%), hsl(120,100%,50%), hsl(180,100%,50%), hsl(240,100%,50%), hsl(300,100%,50%), hsl(360,100%,50%))';
}

// Helper to convert HSL to RGB
function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h /= 360;
  s /= 100;
  l /= 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

// Helper to convert RGB to HSL
function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

// SaturationLightnessPicker Component
interface SaturationLightnessPickerProps {
  hue: number; // 0-360
  saturation: number; // 0-100
  lightness: number; // 0-100
  onChange: (saturation: number, lightness: number) => void;
}

function SaturationLightnessPicker({ hue, saturation, lightness, onChange }: SaturationLightnessPickerProps) {
  const pickerRef = React.useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const dragRectRef = React.useRef<DOMRect | null>(null);

  // Background gradient:
  // - Vertical: white (top, lightness 100%) to black (bottom, lightness 0%)
  // - Horizontal: grayscale (left, saturation 0%) to full hue color (right, saturation 100%)
  // The right side should show the hue at varying lightness levels
  const bgColorFull = `hsl(${hue}, 100%, 50%)`; // Full saturation, 50% lightness (brightest)
  const x = saturation; // 0-100
  const y = 100 - lightness; // Invert Y axis (0 at top = 100% lightness)

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (pickerRef.current) {
      // Store the rect at drag start to prevent it from changing during drag
      dragRectRef.current = pickerRef.current.getBoundingClientRect();
    }
    setIsDragging(true);
    updatePosition(e);
  };

  const updatePosition = React.useCallback((e: MouseEvent | React.MouseEvent) => {
    // Use stored rect from drag start, or get current rect if not dragging
    const rect = dragRectRef.current || (pickerRef.current?.getBoundingClientRect() ?? null);
    if (!rect) return;

    // Get mouse position - handle both MouseEvent (from document) and React.MouseEvent
    const clientX = 'clientX' in e ? e.clientX : (e as MouseEvent).clientX;
    const clientY = 'clientY' in e ? e.clientY : (e as MouseEvent).clientY;

    // Calculate position relative to the picker element
    let xPos = clientX - rect.left;
    let yPos = clientY - rect.top;

    // Clamp to exact bounds (0 to width/height) - this ensures edge cases work correctly
    xPos = Math.max(0, Math.min(rect.width, xPos));
    yPos = Math.max(0, Math.min(rect.height, yPos));

    // Calculate saturation: 0% (left) to 100% (right)
    // Use Math.min to ensure we never exceed 100% due to floating point precision
    const newSaturation = rect.width > 0 ? Math.min(100, (xPos / rect.width) * 100) : 0;

    // Calculate lightness: 100% (top) to 0% (bottom) - invert Y axis
    const newLightness = rect.height > 0 ? Math.max(0, 100 - ((yPos / rect.height) * 100)) : 0;

    // Call onChange with clamped values
    onChange(newSaturation, newLightness);
  }, [onChange]);

  const handleMouseMove = React.useCallback((e: MouseEvent) => {
    if (!isDragging || !pickerRef.current) return;
    updatePosition(e);
  }, [isDragging, updatePosition]);

  const handleMouseUp = React.useCallback(() => {
    setIsDragging(false);
    dragRectRef.current = null; // Clear stored rect when drag ends
  }, []);

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Create accurate background gradient using standard color picker approach
  // Standard saturation/lightness picker layout:
  // - X-axis (left to right): saturation 0% (gray) to 100% (full color)
  // - Y-axis (top to bottom): lightness 100% (white) to 0% (black)
  // Using two gradients with multiply blend mode:
  // 1. Vertical: white to black (controls lightness)
  // 2. Horizontal: white to full hue color (controls saturation)
  // Multiply blend combines them correctly
  const backgroundGradient = React.useMemo(() => {
    // Get the full saturation color at 50% lightness for the right edge
    const fullColor = hslToRgb(hue, 100, 50);
    const fullColorStr = `rgb(${fullColor.r}, ${fullColor.g}, ${fullColor.b})`;

    return `
      linear-gradient(to bottom, rgba(255,255,255,1) 0%, rgba(0,0,0,1) 100%),
      linear-gradient(to right, rgba(255,255,255,1) 0%, ${fullColorStr} 100%)
    `;
  }, [hue]);

  return (
    <div
      ref={pickerRef}
      className="relative w-full h-full rounded-md overflow-hidden touch-none outline outline-white/15 outline-offset-[-1px]"
      style={{
        background: backgroundGradient,
        backgroundBlendMode: 'multiply',
      }}
      onMouseDown={handleMouseDown}
    >
      <div
        className={cn(
          'absolute -translate-x-1/2 -translate-y-1/2 select-none z-10 pointer-events-none',
          isDragging && 'z-20'
        )}
        style={{
          left: `${x}%`,
          top: `${y}%`,
        }}
      >
        <div className="size-3 rounded-full border-2 border-white shadow-md" />
      </div>
    </div>
  );
}

// HueBar Component - matches GradientBar design
interface HueBarProps {
  hue: number; // 0-360
  onChange: (hue: number) => void;
}

function HueBar({ hue, onChange }: HueBarProps) {
  const barRef = React.useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  const hueCSS = generateHueGradientCSS();

  // Calculate position accounting for dot's half-width
  // Clamp visual position to ~2.5% and 97.5% to keep the 12px dot (6px half-width) within bounds
  // This works for typical bar widths (200px+): 2.5% of 200px = 5px margin, 97.5% = 195px
  const rawPosition = (hue / 360) * 100;
  const position = Math.max(2.5, Math.min(97.5, rawPosition));

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    updateHue(e);
  };

  const updateHue = (e: MouseEvent | React.MouseEvent) => {
    if (!barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    // Clamp mouse position to account for dot's half-width
    const dotHalfWidth = 6; // size-3 = 12px, half = 6px
    const clampedX = Math.max(dotHalfWidth, Math.min(rect.width - dotHalfWidth, x));
    const newPosition = ((clampedX - dotHalfWidth) / (rect.width - dotHalfWidth * 2)) * 100;
    const newHue = Math.round(Math.max(0, Math.min(360, (newPosition / 100) * 360)));
    onChange(newHue);
  };

  const handleMouseMove = React.useCallback((e: MouseEvent) => {
    if (isDragging) {
      updateHue(e);
    }
  }, [isDragging]);

  const handleMouseUp = React.useCallback(() => {
    setIsDragging(false);
  }, []);

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={barRef}
        className="relative h-3 w-full rounded-full outline outline-white/10 outline-offset-[-1px] cursor-pointer"
        style={{ background: hueCSS }}
        onMouseDown={handleMouseDown}
      >
        <div
          className={cn(
            'absolute top-0 -translate-x-1/2 cursor-pointer select-none z-10',
            isDragging && 'z-20'
          )}
          style={{ left: `${position}%` }}
        >
          <div className="size-3 rounded-full border-[1.5px] border-white flex items-center justify-center shadow-md pointer-events-none shadow-sm">
          </div>
        </div>
      </div>
    </div>
  );
}

// OpacityBar Component - matches HueBar design
interface OpacityBarProps {
  opacity: number; // 0-1
  color: { r: number; g: number; b: number }; // RGB color for the gradient
  onChange: (opacity: number) => void;
}

function OpacityBar({ opacity, color, onChange }: OpacityBarProps) {
  const barRef = React.useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  // Calculate position accounting for dot's half-width
  // Clamp visual position to ~2.5% and 97.5% to keep the 12px dot within bounds
  const rawPosition = opacity * 100;
  const position = Math.max(2.5, Math.min(97.5, rawPosition));

  const colorStr = `rgb(${color.r}, ${color.g}, ${color.b})`;
  const opacityCSS = `linear-gradient(90deg, transparent, ${colorStr})`;

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    updateOpacity(e);
  };

  const updateOpacity = (e: MouseEvent | React.MouseEvent) => {
    if (!barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    // Clamp mouse position to account for dot's half-width
    const dotHalfWidth = 6; // size-3 = 12px, half = 6px
    const clampedX = Math.max(dotHalfWidth, Math.min(rect.width - dotHalfWidth, x));
    const newPosition = ((clampedX - dotHalfWidth) / (rect.width - dotHalfWidth * 2)) * 100;
    const newOpacity = Math.max(0, Math.min(1, newPosition / 100));
    onChange(newOpacity);
  };

  const handleMouseMove = React.useCallback((e: MouseEvent) => {
    if (isDragging) {
      updateOpacity(e);
    }
  }, [isDragging]);

  const handleMouseUp = React.useCallback(() => {
    setIsDragging(false);
  }, []);

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={barRef}
        className="relative h-3 w-full rounded-full outline outline-white/10 outline-offset-[-1px] cursor-pointer"
        onMouseDown={handleMouseDown}
      >
        {/* Checkerboard pattern for transparency */}
        <div
          className="absolute inset-0 opacity-30 rounded-full"
          style={{
            backgroundImage: 'repeating-linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc), repeating-linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc)',
            backgroundPosition: '0 0, 4px 4px',
            backgroundSize: '8px 8px',
          }}
        />
        {/* Opacity gradient */}
        <div
          className="absolute inset-0 rounded-full"
          style={{ background: opacityCSS }}
        />
        <div
          className={cn(
            'absolute top-0 -translate-x-1/2 cursor-pointer select-none z-10',
            'transition-transform hover:scale-110',
            isDragging && 'scale-110 z-20'
          )}
          style={{ left: `${position}%` }}
        >
          <div className="size-3 rounded-full border-[1.5px] border-white flex items-center justify-center shadow-md pointer-events-none shadow-sm">
          </div>
        </div>
      </div>
    </div>
  );
}

// GradientBar Component
interface GradientBarProps {
  stops: ColorStop[];
  selectedStopId: string | null;
  onStopSelect: (stopId: string | null) => void;
  onStopMove: (stopId: string, position: number) => void;
  onAddStop: (position?: number) => void;
  gradientType: 'linear' | 'radial';
  angle?: number;
}

function GradientBar({
  stops,
  selectedStopId,
  onStopSelect,
  onStopMove,
  onAddStop,
  gradientType,
  angle = 0,
}: GradientBarProps) {
  const barRef = React.useRef<HTMLDivElement>(null);
  const [draggingStopId, setDraggingStopId] = React.useState<string | null>(null);

  // Always show gradient bar at 90deg (vertical) for visual consistency
  const gradientCSS = generateGradientCSS(stops, gradientType, 90);
  const sortedStops = [...stops].sort((a, b) => a.position - b.position);

  const handleMouseDown = (e: React.MouseEvent, stopId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingStopId(stopId);
    onStopSelect(stopId);
  };

  const handleMouseMove = React.useCallback((e: MouseEvent) => {
    if (!draggingStopId || !barRef.current) return;

    const rect = barRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const position = Math.max(0, Math.min(100, (x / rect.width) * 100));
    onStopMove(draggingStopId, position);
  }, [draggingStopId, onStopMove]);

  const handleMouseUp = React.useCallback(() => {
    setDraggingStopId(null);
  }, []);

  React.useEffect(() => {
    if (draggingStopId) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggingStopId, handleMouseMove, handleMouseUp]);

  const handleBarClick = (e: React.MouseEvent) => {
    // Don't handle if dragging or if click was on a handle
    if (draggingStopId || (e.target as HTMLElement).closest('[data-stop-handle]')) {
      return;
    }

    // Only handle clicks directly on the gradient bar background
    if (!barRef.current || e.target !== barRef.current) return;

    const rect = barRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    // Clamp mouse position to account for dot's half-width
    const dotHalfWidth = 6; // size-3 = 12px, half = 6px
    const clampedX = Math.max(dotHalfWidth, Math.min(rect.width - dotHalfWidth, x));
    const position = ((clampedX - dotHalfWidth) / (rect.width - dotHalfWidth * 2)) * 100;

    // Find closest stop
    if (sortedStops.length > 0) {
      const closestStop = sortedStops.reduce((closest, stop) => {
        const dist = Math.abs(stop.position - position);
        const closestDist = Math.abs(closest.position - position);
        return dist < closestDist ? stop : closest;
      }, sortedStops[0]);

      // If clicked very close to a stop (within 5%), select it instead of adding new
      if (Math.abs(closestStop.position - position) < 5) {
        onStopSelect(closestStop.id);
        return;
      }
    }

    // Only add new stop if not close to any existing stop
    onAddStop(position);
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={barRef}
        className="relative h-3 w-full rounded-full outline outline-white/10 outline-offset-[-1px] cursor-pointer"
        style={{ background: gradientCSS }}
        onClick={handleBarClick}
      >
        {sortedStops.map((stop) => {
          const isSelected = selectedStopId === stop.id;
          const isDragging = draggingStopId === stop.id;

          // Calculate clamped position for visual display to keep dot within bounds
          // Use CSS calc with clamp to keep dot within bounds without JavaScript calculations
          // The dot is 12px (size-3), so we need to offset by 6px on each side
          // We'll use CSS calc to clamp between ~3% and 97% (approximate, but works for most bar widths)
          const clampedPosition = Math.max(2.5, Math.min(97.5, stop.position));

          return (
            <div
              key={stop.id}
              data-stop-handle
              className={cn(
                'absolute top-0 -translate-x-1/2 cursor-pointer select-none z-10',
                isDragging && 'z-20'
              )}
              style={{ left: `${clampedPosition}%` }}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleMouseDown(e, stop.id);
              }}
              onClick={(e) => {
                e.stopPropagation();
                onStopSelect(stop.id);
              }}
            >
              <div
                className={cn(
                  'size-3 rounded-full border-[1.5px] flex items-center justify-center shadow-md pointer-events-none shadow-sm',
                  isSelected
                    ? 'border-white'
                    : 'border-white'
                )}
              >
                {isSelected && <div className="size-1 rounded-full bg-white" />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface ColorStop {
  id: string;
  color: string;
  position: number;
}

export default function ColorPicker({
  value,
  onChange,
  defaultValue = '#ffffff',
  placeholder = '#ffffff',
}: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'solid' | 'linear' | 'radial'>('solid');

  const displayValue = value || '';
  const isGradient = displayValue.startsWith('linear') || displayValue.startsWith('radial');

  // Format display value for user-friendly gradient names
  const getDisplayText = (val: string): string => {
    if (val.startsWith('linear-gradient')) {
      return 'Linear gradient';
    }
    if (val.startsWith('radial-gradient')) {
      return 'Radial gradient';
    }
    return val.length > 20 ? val.substring(0, 20) + '...' : val;
  };

  // Solid color state
  const [rgbaColor, setRgbaColor] = useState(() => {
    if (!isGradient && displayValue) {
      return parseColor(displayValue);
    }
    return parseColor(defaultValue);
  });

  // Local state for HEX input to allow free typing
  const [hexInputValue, setHexInputValue] = useState(() => {
    if (!isGradient && displayValue) {
      return getHexOnly(displayValue);
    }
    return getHexOnly(defaultValue);
  });

  // Ref to track if color change came from hex input (to prevent sync loop)
  const isHexInputUpdating = useRef(false);

  // Sync hex input when rgbaColor changes externally (but not from hex input itself)
  useEffect(() => {
    if (!isGradient && activeTab === 'solid' && !isHexInputUpdating.current) {
      setHexInputValue(getHexOnly(rgbaToHex(rgbaColor)));
    }
    // Reset flag after sync
    isHexInputUpdating.current = false;
  }, [rgbaColor.r, rgbaColor.g, rgbaColor.b, isGradient, activeTab]);

  // Gradient state
  const [linearStops, setLinearStops] = useState<ColorStop[]>([
    { id: 'stop-0', color: '#000000', position: 0 },
    { id: 'stop-1', color: '#ffffff', position: 100 },
  ]);
  const [radialStops, setRadialStops] = useState<ColorStop[]>([
    { id: 'stop-0', color: '#000000', position: 0 },
    { id: 'stop-1', color: '#ffffff', position: 100 },
  ]);
  const [linearAngle, setLinearAngle] = useState(0);

  // Track open state for each stop's color picker
  const [openColorPickerId, setOpenColorPickerId] = useState<string | null>(null);

  // Track selected stop for gradient editing
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);

  // Track dragging state for gradient bar handles
  const [draggingStopId, setDraggingStopId] = useState<string | null>(null);

  // Sync rgba color when value changes externally (for solid colors)
  useEffect(() => {
    if (!isGradient && displayValue) {
      setRgbaColor(parseColor(displayValue));
    }
  }, [displayValue, isGradient]);

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  const hasValue = !!displayValue;

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    // When opening and there's no value, set it to default
    if (newOpen && !hasValue) {
      onChange(defaultValue);
      setRgbaColor(parseColor(defaultValue));
    }
  };

  // Solid color handlers
  const handleRgbaChange = (color: { r: number; g: number; b: number; a: number }) => {
    setRgbaColor(color);
    // Use immediate onChange for solid colors to avoid delays
    immediateOnChange(rgbaToHex(color));
  };

  const handleHexInputChange = (value: string) => {
    // Update local input state immediately for smooth typing
    setHexInputValue(value);

    // Normalize input: remove spaces, ensure # prefix
    let normalized = value.trim().replace(/\s/g, '');

    // If user typed without #, add it
    if (normalized && !normalized.startsWith('#')) {
      normalized = '#' + normalized;
      setHexInputValue(normalized);
    }

    // If it's just # or empty, allow it (user is still typing)
    if (!normalized || normalized === '#') {
      return;
    }

    // Parse the hex input (supports #hex, #hex/opacity, or partial #hexhex)
    // Allow partial values like #ff or #ff00 (user might be typing)
    if (normalized.startsWith('#') && normalized.length > 1) {
      // Extract hex part (up to 6 chars after #)
      const hexMatch = normalized.match(/^#([0-9a-fA-F]{0,6})(?:\/(\d+))?$/);
      if (hexMatch) {
        const hexDigits = hexMatch[1];
        const opacityStr = hexMatch[2];

        // Only update color when we have exactly 6 hex digits (complete hex value)
        // Don't prefill or update with partial values - let user type freely
        if (hexDigits.length === 6 && /^[0-9a-fA-F]+$/.test(hexDigits)) {
          // Mark that we're updating from hex input to prevent sync loop
          isHexInputUpdating.current = true;

          const parsed = parseColor(normalized);
          // Preserve current opacity if user only typed hex without opacity
          const finalRgba = opacityStr ? parsed : { ...parsed, a: rgbaColor.a };
          setRgbaColor(finalRgba);
          immediateOnChange(rgbaToHex(finalRgba));
        }
      }
    }
  };

  const handleHexInputBlur = () => {
    // Mark that we're updating from hex input to prevent sync loop
    isHexInputUpdating.current = true;

    // On blur, normalize the value - ensure it's a valid 6-digit hex
    const current = hexInputValue.trim();
    let normalized = current;

    // Add # if missing
    if (normalized && !normalized.startsWith('#')) {
      normalized = '#' + normalized;
    }

    // Extract hex digits
    const hexMatch = normalized.match(/^#([0-9a-fA-F]*)$/);
    if (hexMatch) {
      const hexDigits = hexMatch[1];

      if (hexDigits.length === 0) {
        // Empty - reset to current color
        setHexInputValue(getHexOnly(rgbaToHex(rgbaColor)));
      } else if (hexDigits.length < 6) {
        // Partial - don't auto-fill, just reset to current color
        // User can type the full hex value if they want
        setHexInputValue(getHexOnly(rgbaToHex(rgbaColor)));
      } else if (hexDigits.length === 6) {
        // Valid 6-digit hex
        const parsed = parseColor(normalized);
        const finalRgba = { ...parsed, a: rgbaColor.a };
        setRgbaColor(finalRgba);
        setHexInputValue(normalized);
        immediateOnChange(rgbaToHex(finalRgba));
      } else {
        // Too long - truncate to 6 digits
        const truncated = '#' + hexDigits.slice(0, 6);
        const parsed = parseColor(truncated);
        const finalRgba = { ...parsed, a: rgbaColor.a };
        setRgbaColor(finalRgba);
        setHexInputValue(truncated);
        immediateOnChange(rgbaToHex(finalRgba));
      }
    } else {
      // Invalid format - reset to current color
      setHexInputValue(getHexOnly(rgbaToHex(rgbaColor)));
    }
  };

  // Debounced onChange ref to keep it stable across renders
  const debouncedOnChangeRef = useRef(
    debounce((value: string) => {
      onChange(value);
    }, 150)
  );

  // Update the debounced function when onChange changes
  useEffect(() => {
    debouncedOnChangeRef.current = debounce((value: string) => {
      onChange(value);
    }, 150);

    return () => {
      debouncedOnChangeRef.current.cancel();
    };
  }, [onChange]);

  // Immediate onChange for solid colors (no debounce needed for simple color changes)
  const immediateOnChange = (value: string) => {
    debouncedOnChangeRef.current.cancel(); // Cancel any pending debounced calls
    onChange(value);
  };

  // Gradient handlers
  // Format: linear-gradient(180deg,rgba(0,0,0,1)0%,rgba(140,0,0,1)43.31%...)
  // No spaces after commas, no space between color and position
  // Convert colors to rgba format for Tailwind compatibility
  const handleLinearGradientChange = (angle: number, stops: ColorStop[]) => {
    const stopsStr = stops.map(s => `${colorToRgbaString(s.color)}${s.position}%`).join(',');
    const gradientValue = `linear-gradient(${angle}deg,${stopsStr})`;
    debouncedOnChangeRef.current(gradientValue);
  };

  const handleRadialGradientChange = (stops: ColorStop[]) => {
    const stopsStr = stops.map(s => `${colorToRgbaString(s.color)}${s.position}%`).join(',');
    const gradientValue = `radial-gradient(circle,${stopsStr})`;
    debouncedOnChangeRef.current(gradientValue);
  };

  const addColorStop = (type: 'linear' | 'radial', position?: number) => {
    const targetPosition = position ?? 50;
    const currentStops = type === 'linear' ? linearStops : radialStops;

    // Check if a stop already exists at this position (within 2% tolerance)
    const existingStop = currentStops.find(stop => Math.abs(stop.position - targetPosition) < 2);
    if (existingStop) {
      // Select the existing stop instead of adding a duplicate
      setSelectedStopId(existingStop.id);
      return;
    }

    const newStop: ColorStop = {
      id: `stop-${Date.now()}`,
      color: '#808080',
      position: targetPosition,
    };
    if (type === 'linear') {
      const newStops = [...linearStops, newStop].sort((a, b) => a.position - b.position);
      setLinearStops(newStops);
      setSelectedStopId(newStop.id);
      handleLinearGradientChange(linearAngle, newStops);
    } else {
      const newStops = [...radialStops, newStop].sort((a, b) => a.position - b.position);
      setRadialStops(newStops);
      setSelectedStopId(newStop.id);
      handleRadialGradientChange(newStops);
    }
  };

  const removeColorStop = (type: 'linear' | 'radial', id: string) => {
    if (type === 'linear') {
      if (linearStops.length <= 2) return;
      const newStops = linearStops.filter(s => s.id !== id);
      setLinearStops(newStops);

      // If the deleted stop was selected, select another one
      if (selectedStopId === id) {
        // Prefer selecting the next stop, or the first one if it was the last
        const deletedIndex = linearStops.findIndex(s => s.id === id);
        const nextStop = newStops[deletedIndex] || newStops[deletedIndex - 1] || newStops[0];
        setSelectedStopId(nextStop.id);
      }

      handleLinearGradientChange(linearAngle, newStops);
    } else {
      if (radialStops.length <= 2) return;
      const newStops = radialStops.filter(s => s.id !== id);
      setRadialStops(newStops);

      // If the deleted stop was selected, select another one
      if (selectedStopId === id) {
        const deletedIndex = radialStops.findIndex(s => s.id === id);
        const nextStop = newStops[deletedIndex] || newStops[deletedIndex - 1] || newStops[0];
        setSelectedStopId(nextStop.id);
      }

      handleRadialGradientChange(newStops);
    }
  };

  const updateColorStop = (type: 'linear' | 'radial', id: string, updates: Partial<ColorStop>) => {
    if (type === 'linear') {
      const newStops = linearStops.map(s => s.id === id ? { ...s, ...updates } : s).sort((a, b) => a.position - b.position);
      setLinearStops(newStops);
      handleLinearGradientChange(linearAngle, newStops);
    } else {
      const newStops = radialStops.map(s => s.id === id ? { ...s, ...updates } : s).sort((a, b) => a.position - b.position);
      setRadialStops(newStops);
      handleRadialGradientChange(newStops);
    }
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value as 'solid' | 'linear' | 'radial');
    setSelectedStopId(null); // Reset selected stop when switching tabs
    if (value === 'linear' && !displayValue.startsWith('linear')) {
      handleLinearGradientChange(0, linearStops);
      // Always ensure at least one stop is selected
      if (linearStops.length > 0) {
        setSelectedStopId(linearStops[0].id);
      }
    } else if (value === 'radial' && !displayValue.startsWith('radial')) {
      handleRadialGradientChange(radialStops);
      // Always ensure at least one stop is selected
      if (radialStops.length > 0) {
        setSelectedStopId(radialStops[0].id);
      }
    } else if (value === 'solid' && isGradient) {
      onChange(rgbaToHex(rgbaColor));
    } else if (value === 'linear' && linearStops.length > 0) {
      // Always ensure at least one stop is selected
      setSelectedStopId(selectedStopId && linearStops.some(s => s.id === selectedStopId)
        ? selectedStopId
        : linearStops[0].id);
    } else if (value === 'radial' && radialStops.length > 0) {
      // Always ensure at least one stop is selected
      setSelectedStopId(selectedStopId && radialStops.some(s => s.id === selectedStopId)
        ? selectedStopId
        : radialStops[0].id);
    }
  };

  // Handle keyboard events for delete key in gradient mode
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Only handle Delete/Backspace when in gradient mode and a stop is selected
    if ((e.key === 'Delete' || e.key === 'Backspace') && (activeTab === 'linear' || activeTab === 'radial')) {
      if (selectedStopId) {
        // Check if we're in an input field (don't delete stop if user is typing)
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return; // Let the input handle the delete
        }

        e.preventDefault();
        e.stopPropagation(); // Prevent it from reaching LayersTree

        // Remove the selected stop (if there are more than 2)
        if (activeTab === 'linear') {
          removeColorStop('linear', selectedStopId);
        } else {
          removeColorStop('radial', selectedStopId);
        }
      }
    }
  };

  // Parse gradient on mount/change
  // Format: linear-gradient(180deg,rgba(0,0,0,1)0%,rgba(140,0,0,1)43.31%...)
  // No spaces after commas, no space between color and position
  useEffect(() => {
    if (displayValue.startsWith('linear-gradient')) {
      // Match: linear-gradient(angle deg,color1position1%,color2position2%,...)
      // Allow optional spaces for compatibility but prefer no spaces
      const match = displayValue.match(/linear-gradient\((\d+)deg\s*,\s*(.+)\)/);
      if (match) {
        setActiveTab('linear');
        const angle = parseInt(match[1]);
        const stopsStr = match[2];
        // Parse stops: rgba(...)position% or #hexposition% or namedposition%
        // Match color followed immediately by number%
        const stopPattern = /(rgba?\([^)]+\)|#[0-9a-fA-F]+|\w+)([\d.]+)%/g;
        const stops: ColorStop[] = [];
        let matchResult;
        let idx = 0;
        while ((matchResult = stopPattern.exec(stopsStr)) !== null) {
          stops.push({
            id: `linear-stop-${idx}`,
            color: matchResult[1],
            position: parseFloat(matchResult[2]),
          });
          idx++;
        }
        if (stops.length > 0) {
          setLinearAngle(angle);
          setLinearStops(stops);
          // Always ensure at least one stop is selected
          const validSelectedId = stops.some(s => s.id === selectedStopId) ? selectedStopId : stops[0].id;
          setSelectedStopId(validSelectedId);
        }
      }
    } else if (displayValue.startsWith('radial-gradient')) {
      // Match: radial-gradient(circle,color1position1%,color2position2%,...)
      const match = displayValue.match(/radial-gradient\(circle\s*,\s*(.+)\)/);
      if (match) {
        setActiveTab('radial');
        const stopsStr = match[1];
        const stopPattern = /(rgba?\([^)]+\)|#[0-9a-fA-F]+|\w+)([\d.]+)%/g;
        const stops: ColorStop[] = [];
        let matchResult;
        let idx = 0;
        while ((matchResult = stopPattern.exec(stopsStr)) !== null) {
          stops.push({
            id: `radial-stop-${idx}`,
            color: matchResult[1],
            position: parseFloat(matchResult[2]),
          });
          idx++;
        }
        if (stops.length > 0) {
          setRadialStops(stops);
          // Always ensure at least one stop is selected
          const validSelectedId = stops.some(s => s.id === selectedStopId) ? selectedStopId : stops[0].id;
          setSelectedStopId(validSelectedId);
        }
      }
    }
  }, [displayValue, selectedStopId]);

  // Ensure at least one stop is always selected when in gradient mode
  useEffect(() => {
    if (activeTab === 'linear' && linearStops.length > 0) {
      // If no stop is selected or selected stop doesn't exist, select the first one
      if (!selectedStopId || !linearStops.some(s => s.id === selectedStopId)) {
        setSelectedStopId(linearStops[0].id);
      }
    } else if (activeTab === 'radial' && radialStops.length > 0) {
      // If no stop is selected or selected stop doesn't exist, select the first one
      if (!selectedStopId || !radialStops.some(s => s.id === selectedStopId)) {
        setSelectedStopId(radialStops[0].id);
      }
    }
  }, [activeTab, linearStops, radialStops, selectedStopId]);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
      {hasValue ? (
        <div className="flex items-center justify-start h-8 rounded-lg bg-input hover:bg-input/60 px-2.5 flex items-center gap-2 cursor-pointer">
          <div
            className="size-4 rounded shrink-0"
            style={{
              background: isGradient ? displayValue : displayValue,
            }}
          />
          <Label variant="muted" className="truncate max-w-[120px]">
            {getDisplayText(displayValue)}
          </Label>
          <div className="ml-auto -mr-1.5">
              <Button
                variant="ghost"
                size="xs"
                onClick={handleClear}
              >
                <Icon name="x" />
              </Button>
          </div>
        </div>
      ) : (
          <Button variant="input" size="sm">
            <Icon name="plus" />
            Add
          </Button>
      )}
      </PopoverTrigger>
      <PopoverContent
        className="w-56 p-2" align="end"
        onKeyDown={handleKeyDown}
      >
        <Tabs
          value={activeTab} onValueChange={handleTabChange}
          className="!gap-3"
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="solid">
              <Icon name="color" />
            </TabsTrigger>
            <TabsTrigger value="linear">
              <Icon name="linear" />
            </TabsTrigger>
            <TabsTrigger value="radial">
              <Icon name="radial" />
            </TabsTrigger>
          </TabsList>

          <TabsContent value="solid" className="gap-3">
            <div className="flex flex-col gap-3">
              {/* Saturation/Lightness Picker */}
              <div className="w-full relative aspect-[4/3]">
                <SaturationLightnessPicker
                  hue={rgbToHsl(rgbaColor.r, rgbaColor.g, rgbaColor.b).h}
                  saturation={rgbToHsl(rgbaColor.r, rgbaColor.g, rgbaColor.b).s}
                  lightness={rgbToHsl(rgbaColor.r, rgbaColor.g, rgbaColor.b).l}
                  onChange={(s, l) => {
                    const hsl = rgbToHsl(rgbaColor.r, rgbaColor.g, rgbaColor.b);
                    const rgb = hslToRgb(hsl.h, s, l);
                    handleRgbaChange({ ...rgb, a: rgbaColor.a });
                  }}
                />
              </div>

              {/* HUE Bar */}
              <HueBar
                hue={rgbToHsl(rgbaColor.r, rgbaColor.g, rgbaColor.b).h}
                onChange={(hue) => {
                  const hsl = rgbToHsl(rgbaColor.r, rgbaColor.g, rgbaColor.b);
                  const rgb = hslToRgb(hue, hsl.s, hsl.l);
                  handleRgbaChange({ ...rgb, a: rgbaColor.a });
                }}
              />

              {/* Opacity Bar */}
              <OpacityBar
                opacity={rgbaColor.a}
                color={{ r: rgbaColor.r, g: rgbaColor.g, b: rgbaColor.b }}
                onChange={(a) => {
                  handleRgbaChange({ ...rgbaColor, a });
                }}
              />

              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  value={hexInputValue}
                  onChange={(e) => handleHexInputChange(e.target.value)}
                  onBlur={handleHexInputBlur}
                  onKeyDown={(e) => {
                    // On Enter, blur to normalize the value
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                    }
                  }}
                  placeholder={placeholder}
                  className="flex-1 font-mono"
                />
                <InputGroup className="w-16">
                  <InputGroupInput
                    value={Math.round(rgbaColor.a * 100)}
                    onChange={(e) => {
                      const a = Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) / 100;
                      handleRgbaChange({ ...rgbaColor, a });
                    }}
                    className="w-16 text-xs"
                    min={0}
                    max={100}
                  />
                  <InputGroupAddon align="inline-end">
                    <Label variant="muted" className="text-xs">%</Label>
                  </InputGroupAddon>
                </InputGroup>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="linear" className="gap-3">
            <div className="flex flex-col gap-3">
              {/* Gradient Bar with Draggable Handles */}
              <div className="flex items-center gap-2 -my-1.5">
                <div className="flex-1">
                  <GradientBar
                    stops={linearStops}
                    selectedStopId={selectedStopId}
                    onStopSelect={setSelectedStopId}
                    onStopMove={(stopId, position) => {
                      updateColorStop('linear', stopId, { position });
                    }}
                    onAddStop={(position) => addColorStop('linear', position)}
                    gradientType="linear"
                    angle={linearAngle}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    const newAngle = (linearAngle + 90) % 360;
                    setLinearAngle(newAngle);
                    handleLinearGradientChange(newAngle, linearStops);
                  }}
                  title={`Rotate angle (${linearAngle}°)`}
                >
                  <Icon name="refresh" />
                </Button>
              </div>

              {/* Color Picker for Selected Stop */}
              {selectedStopId && (() => {
                const selectedStop = linearStops.find(s => s.id === selectedStopId);
                if (!selectedStop) return null;
                const stopRgba = parseColor(selectedStop.color);
                const hsl = rgbToHsl(stopRgba.r, stopRgba.g, stopRgba.b);
                return (
                  <div className="flex flex-col gap-3">
                    {/* Saturation/Lightness Picker */}
                    <div className="w-full relative aspect-[4/3]">
                      <SaturationLightnessPicker
                        hue={hsl.h}
                        saturation={hsl.s}
                        lightness={hsl.l}
                        onChange={(s, l) => {
                          const rgb = hslToRgb(hsl.h, s, l);
                          updateColorStop('linear', selectedStopId, { color: rgbaToHex({ ...rgb, a: stopRgba.a }) });
                        }}
                      />
                    </div>

                    {/* HUE Bar */}
                    <HueBar
                      hue={hsl.h}
                      onChange={(hue) => {
                        const rgb = hslToRgb(hue, hsl.s, hsl.l);
                        updateColorStop('linear', selectedStopId, { color: rgbaToHex({ ...rgb, a: stopRgba.a }) });
                      }}
                    />

                    {/* Opacity Bar */}
                    <OpacityBar
                      opacity={stopRgba.a}
                      color={{ r: stopRgba.r, g: stopRgba.g, b: stopRgba.b }}
                      onChange={(a) => {
                        updateColorStop('linear', selectedStopId, { color: rgbaToHex({ ...stopRgba, a }) });
                      }}
                    />

                    <div className="flex items-center gap-2">
                      <Input
                        type="text"
                        value={getHexOnly(rgbaToHex(stopRgba))}
                        onChange={(e) => {
                          const parsed = parseColor(e.target.value);
                          // Preserve current opacity if user only typed hex without opacity
                          const finalRgba = e.target.value.includes('/') ? parsed : { ...parsed, a: stopRgba.a };
                          updateColorStop('linear', selectedStopId, { color: rgbaToHex(finalRgba) });
                        }}
                        placeholder="#000000"
                        className="font-mono flex-1"
                      />
                      <InputGroup className="w-16">
                        <InputGroupInput
                          value={Math.round(stopRgba.a * 100)}
                          onChange={(e) => {
                            const a = Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) / 100;
                            const newRgba = { ...stopRgba, a };
                            updateColorStop('linear', selectedStopId, { color: rgbaToHex(newRgba) });
                          }}
                          min={0}
                          max={100}
                        />
                        <InputGroupAddon align="inline-end">
                          <Label variant="muted" className="text-xs">%</Label>
                        </InputGroupAddon>
                      </InputGroup>
                    </div>
                  </div>
                );
              })()}
            </div>
          </TabsContent>

          <TabsContent value="radial" className="gap-3">
            <div className="flex flex-col gap-3">
              {/* Gradient Bar with Draggable Handles */}
              <GradientBar
                stops={radialStops}
                selectedStopId={selectedStopId}
                onStopSelect={setSelectedStopId}
                onStopMove={(stopId, position) => {
                  updateColorStop('radial', stopId, { position });
                }}
                onAddStop={(position) => addColorStop('radial', position)}
                gradientType="radial"
              />

              {/* Color Picker for Selected Stop */}
              {selectedStopId && (() => {
                const selectedStop = radialStops.find(s => s.id === selectedStopId);
                if (!selectedStop) return null;
                const stopRgba = parseColor(selectedStop.color);
                const hsl = rgbToHsl(stopRgba.r, stopRgba.g, stopRgba.b);
                return (
                  <div className="flex flex-col gap-3">
                    {/* Saturation/Lightness Picker */}
                    <div className="w-full relative aspect-[4/3]">
                      <SaturationLightnessPicker
                        hue={hsl.h}
                        saturation={hsl.s}
                        lightness={hsl.l}
                        onChange={(s, l) => {
                          const rgb = hslToRgb(hsl.h, s, l);
                          updateColorStop('radial', selectedStopId, { color: rgbaToHex({ ...rgb, a: stopRgba.a }) });
                        }}
                      />
                    </div>

                    {/* HUE Bar */}
                    <HueBar
                      hue={hsl.h}
                      onChange={(hue) => {
                        const rgb = hslToRgb(hue, hsl.s, hsl.l);
                        updateColorStop('radial', selectedStopId, { color: rgbaToHex({ ...rgb, a: stopRgba.a }) });
                      }}
                    />

                    {/* Opacity Bar */}
                    <OpacityBar
                      opacity={stopRgba.a}
                      color={{ r: stopRgba.r, g: stopRgba.g, b: stopRgba.b }}
                      onChange={(a) => {
                        updateColorStop('radial', selectedStopId, { color: rgbaToHex({ ...stopRgba, a }) });
                      }}
                    />

                    <div className="flex items-center gap-2">
                      <Input
                        type="text"
                        value={getHexOnly(rgbaToHex(stopRgba))}
                        onChange={(e) => {
                          const parsed = parseColor(e.target.value);
                          // Preserve current opacity if user only typed hex without opacity
                          const finalRgba = e.target.value.includes('/') ? parsed : { ...parsed, a: stopRgba.a };
                          updateColorStop('radial', selectedStopId, { color: rgbaToHex(finalRgba) });
                        }}
                        placeholder="#000000"
                        className="font-mono flex-1"
                      />
                      <InputGroup className="w-16">
                        <InputGroupInput
                          value={Math.round(stopRgba.a * 100)}
                          onChange={(e) => {
                            const a = Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) / 100;
                            const newRgba = { ...stopRgba, a };
                            updateColorStop('radial', selectedStopId, { color: rgbaToHex(newRgba) });
                          }}
                          className="w-16 text-xs"
                          min={0}
                          max={100}
                        />
                        <InputGroupAddon align="inline-end">
                          <Label variant="muted" className="text-xs">%</Label>
                        </InputGroupAddon>
                      </InputGroup>
                    </div>
                  </div>
                );
              })()}
            </div>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
