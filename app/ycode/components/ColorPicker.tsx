'use client';

/**
 * ColorPicker Component
 *
 * A color picker wrapped in a Popover with a visual color button trigger
 * Supports solid colors (with draggable palette, hue, opacity) and gradients
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { RgbaColorPicker } from 'react-colorful';
import debounce from 'lodash.debounce';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import Icon from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

interface ColorPickerProps {
  value?: string;
  onChange: (value: string) => void;
  defaultValue?: string;
  placeholder?: string;
}

// Helper to convert hex/rgba to RgbaColor object
function parseColor(colorString: string): { r: number; g: number; b: number; a: number } {
  if (!colorString) return { r: 255, g: 255, b: 255, a: 1 };

  // Hex color
  if (colorString.startsWith('#')) {
    const hex = colorString.slice(1);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
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

// Helper to convert RgbaColor to hex string
function rgbaToHex(rgba: { r: number; g: number; b: number; a: number }): string {
  const r = Math.round(rgba.r).toString(16).padStart(2, '0');
  const g = Math.round(rgba.g).toString(16).padStart(2, '0');
  const b = Math.round(rgba.b).toString(16).padStart(2, '0');
  if (rgba.a < 1) {
    const a = Math.round(rgba.a * 255).toString(16).padStart(2, '0');
    return `#${r}${g}${b}${a}`;
  }
  return `#${r}${g}${b}`;
}

// Helper to convert color string (hex or rgba) to rgba string format
// For gradients, we use rgba format to match Tailwind: rgba(r,g,b,a)
function colorToRgbaString(color: string): string {
  const parsed = parseColor(color);
  // Format: rgba(r,g,b,a) - no spaces, alpha as number (0-1)
  return `rgba(${Math.round(parsed.r)},${Math.round(parsed.g)},${Math.round(parsed.b)},${parsed.a})`;
}

// Helper to generate gradient CSS string
function generateGradientCSS(stops: ColorStop[], type: 'linear' | 'radial', angle?: number): string {
  const stopsStr = stops.map(s => `${s.color} ${s.position}%`).join(', ');
  if (type === 'linear') {
    return `linear-gradient(${angle || 0}deg, ${stopsStr})`;
  }
  return `radial-gradient(circle, ${stopsStr})`;
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
    const position = Math.max(0, Math.min(100, (x / rect.width) * 100));

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
          return (
            <div
              key={stop.id}
              data-stop-handle
              className={cn(
                'absolute top-0 -translate-x-1/2 cursor-pointer select-none z-10',
                'transition-transform hover:scale-110',
                isDragging && 'scale-110 z-20'
              )}
              style={{ left: `${stop.position}%` }}
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
                  'size-3 rounded-full border flex items-center justify-center shadow-md pointer-events-none shadow-sm',
                  isSelected
                    ? 'border-white'
                    : 'border-white'
                )}
              >
                <div className="size-1 rounded-full bg-white" />
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

  // Solid color state
  const [rgbaColor, setRgbaColor] = useState(() => {
    if (!isGradient && displayValue) {
      return parseColor(displayValue);
    }
    return parseColor(defaultValue);
  });

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

  const handleHexInputChange = (hex: string) => {
    if (hex.startsWith('#')) {
      const parsed = parseColor(hex);
      setRgbaColor(parsed);
      immediateOnChange(hex);
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
            className="size-4 rounded border border-border"
            style={{
              background: isGradient ? displayValue : displayValue,
            }}
          />
          <Label variant="muted" className="truncate max-w-[120px]">
            {displayValue.length > 20 ? displayValue.substring(0, 20) + '...' : displayValue}
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
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="solid">Solid</TabsTrigger>
            <TabsTrigger value="linear">Linear</TabsTrigger>
            <TabsTrigger value="radial">Radial</TabsTrigger>
          </TabsList>

          <TabsContent value="solid" className="mt-3">
            <div className="flex flex-col gap-3">
              <div className="w-full" style={{ height: '200px' }}>
                <RgbaColorPicker
                  color={rgbaColor}
                  onChange={handleRgbaChange}
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  value={rgbaToHex(rgbaColor)}
                  onChange={(e) => handleHexInputChange(e.target.value)}
                  placeholder={placeholder}
                  className="font-mono text-sm flex-1"
                />
                <Input
                  type="number"
                  value={Math.round(rgbaColor.a * 100)}
                  onChange={(e) => {
                    const a = Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) / 100;
                    handleRgbaChange({ ...rgbaColor, a });
                  }}
                  className="w-16 text-xs"
                  min={0}
                  max={100}
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="linear" className="mt-3">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Label variant="muted" className="text-xs">Angle</Label>
                <div className="flex items-center gap-2">
                  <Slider
                    value={[linearAngle]}
                    onValueChange={([angle]) => {
                      setLinearAngle(angle);
                      handleLinearGradientChange(angle, linearStops);
                    }}
                    min={0}
                    max={360}
                    step={1}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    value={linearAngle}
                    onChange={(e) => {
                      const angle = parseInt(e.target.value) || 0;
                      setLinearAngle(angle);
                      handleLinearGradientChange(angle, linearStops);
                    }}
                    className="w-16 text-xs"
                    min={0}
                    max={360}
                  />
                </div>
              </div>

              {/* Gradient Bar with Draggable Handles */}
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

              {/* Color Picker for Selected Stop */}
              {selectedStopId && (() => {
                const selectedStop = linearStops.find(s => s.id === selectedStopId);
                if (!selectedStop) return null;
                const stopRgba = parseColor(selectedStop.color);
                return (
                  <div className="flex flex-col gap-3">
                    <div className="w-full" style={{ height: '200px' }}>
                      <RgbaColorPicker
                        color={stopRgba}
                        onChange={(color) => {
                          updateColorStop('linear', selectedStopId, { color: rgbaToHex(color) });
                        }}
                        style={{ width: '100%', height: '100%' }}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="text"
                        value={rgbaToHex(stopRgba)}
                        onChange={(e) => {
                          const parsed = parseColor(e.target.value);
                          updateColorStop('linear', selectedStopId, { color: rgbaToHex(parsed) });
                        }}
                        placeholder="#000000"
                        className="font-mono text-sm flex-1"
                      />
                      <Input
                        type="number"
                        value={Math.round(stopRgba.a * 100)}
                        onChange={(e) => {
                          const a = Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) / 100;
                          const newRgba = { ...stopRgba, a };
                          updateColorStop('linear', selectedStopId, { color: rgbaToHex(newRgba) });
                        }}
                        className="w-16 text-xs"
                        min={0}
                        max={100}
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </TabsContent>

          <TabsContent value="radial" className="mt-3">
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
                return (
                  <div className="flex flex-col gap-3">
                    <div className="w-full" style={{ height: '200px' }}>
                      <RgbaColorPicker
                        color={stopRgba}
                        onChange={(color) => {
                          updateColorStop('radial', selectedStopId, { color: rgbaToHex(color) });
                        }}
                        style={{ width: '100%', height: '100%' }}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="text"
                        value={rgbaToHex(stopRgba)}
                        onChange={(e) => {
                          const parsed = parseColor(e.target.value);
                          updateColorStop('radial', selectedStopId, { color: rgbaToHex(parsed) });
                        }}
                        placeholder="#000000"
                        className="font-mono text-sm flex-1"
                      />
                      <Input
                        type="number"
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
                      <span className="text-xs text-muted-foreground">%</span>
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
