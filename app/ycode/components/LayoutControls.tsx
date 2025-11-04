'use client';

import { useState, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Icon from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDesignSync } from '@/hooks/use-design-sync';
import { useControlledInputs } from '@/hooks/use-controlled-input';
import { useModeToggle } from '@/hooks/use-mode-toggle';
import { useEditorStore } from '@/stores/useEditorStore';
import type { Layer } from '@/types';

interface LayoutControlsProps {
  layer: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
}

export default function LayoutControls({ layer, onLayerUpdate }: LayoutControlsProps) {
  const { activeBreakpoint, activeUIState } = useEditorStore();
  const { updateDesignProperty, updateDesignProperties, getDesignProperty } = useDesignSync({
    layer,
    onLayerUpdate,
    activeBreakpoint,
    activeUIState,
  });
  
  const [gapUnit, setGapUnit] = useState<'px' | 'rem' | 'em'>('px');
  const [paddingUnit, setPaddingUnit] = useState<'px' | 'rem' | 'em'>('px');
  
  // Extract numeric value from design property
  const extractValue = (prop: string): string => {
    if (!prop) return '';
    return prop.replace(/[a-z%]+$/i, '');
  };
  
  // Get current values from layer (with inheritance)
  const display = getDesignProperty('layout', 'display') || '';
  const flexDirection = getDesignProperty('layout', 'flexDirection') || 'row';
  const alignItems = getDesignProperty('layout', 'alignItems') || '';
  const justifyContent = getDesignProperty('layout', 'justifyContent') || 'start';
  const flexWrap = getDesignProperty('layout', 'flexWrap') || 'nowrap';
  const gap = getDesignProperty('layout', 'gap') || '';
  const columnGap = getDesignProperty('layout', 'columnGap') || '';
  const rowGap = getDesignProperty('layout', 'rowGap') || '';
  const gridCols = getDesignProperty('layout', 'gridTemplateColumns') || '';
  const gridRows = getDesignProperty('layout', 'gridTemplateRows') || '';
  const padding = getDesignProperty('spacing', 'padding') || '';
  const paddingTop = getDesignProperty('spacing', 'paddingTop') || '';
  const paddingRight = getDesignProperty('spacing', 'paddingRight') || '';
  const paddingBottom = getDesignProperty('spacing', 'paddingBottom') || '';
  const paddingLeft = getDesignProperty('spacing', 'paddingLeft') || '';
  
  // Local controlled inputs (prevents repopulation bug)
  const inputs = useControlledInputs({
    gap,
    columnGap,
    rowGap,
    padding,
    paddingTop,
    paddingRight,
    paddingBottom,
    paddingLeft,
  }, extractValue);

  const [gapInput, setGapInput] = inputs.gap;
  const [columnGapInput, setColumnGapInput] = inputs.columnGap;
  const [rowGapInput, setRowGapInput] = inputs.rowGap;
  const [paddingInput, setPaddingInput] = inputs.padding;
  const [paddingTopInput, setPaddingTopInput] = inputs.paddingTop;
  const [paddingRightInput, setPaddingRightInput] = inputs.paddingRight;
  const [paddingBottomInput, setPaddingBottomInput] = inputs.paddingBottom;
  const [paddingLeftInput, setPaddingLeftInput] = inputs.paddingLeft;
  
  // Use mode toggle hooks for gap and padding
  const gapModeToggle = useModeToggle({
    category: 'layout',
    unifiedProperty: 'gap',
    individualProperties: ['columnGap', 'rowGap'],
    updateDesignProperty,
    updateDesignProperties,
    // Don't wrap in useCallback - let it recreate on every render to avoid stale closures
    getCurrentValue: (prop: string) => getDesignProperty('layout', prop) || '',
  });
  
  const paddingModeToggle = useModeToggle({
    category: 'spacing',
    unifiedProperty: 'padding',
    individualProperties: ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'],
    updateDesignProperty,
    updateDesignProperties,
    // Don't wrap in useCallback - let it recreate on every render to avoid stale closures
    getCurrentValue: (prop: string) => getDesignProperty('spacing', prop) || '',
  });
  
  // Determine layout type from current values
  const layoutType = 
      display === 'grid' ? 'grid' : 
        flexDirection === 'column' || flexDirection === 'column-reverse' ? 'rows' : 
          'columns';
  
  const wrapMode = flexWrap === 'wrap' ? 'yes' : 'no';
  
  // Handle layout type change
  const handleLayoutTypeChange = (type: 'columns' | 'rows' | 'grid') => {
    const updates = [];
    
    if (type === 'grid') {
      updates.push(
        { category: 'layout' as const, property: 'display', value: 'grid' },
        { category: 'layout' as const, property: 'flexDirection', value: null }
      );
    } else {
      updates.push(
        { category: 'layout' as const, property: 'display', value: 'flex' }
      );
      
      if (type === 'columns') {
        updates.push({ category: 'layout' as const, property: 'flexDirection', value: 'row' });
      } else {
        updates.push({ category: 'layout' as const, property: 'flexDirection', value: 'column' });
      }
    }
    
    updateDesignProperties(updates);
  };
  
  // Handle align items change
  const handleAlignChange = (value: string) => {
    updateDesignProperty('layout', 'alignItems', value);
  };
  
  // Handle justify content change
  const handleJustifyChange = (value: string) => {
    updateDesignProperty('layout', 'justifyContent', value);
  };
  
  // Handle wrap mode change
  const handleWrapChange = (value: 'yes' | 'no') => {
    updateDesignProperty('layout', 'flexWrap', value === 'yes' ? 'wrap' : 'nowrap');
  };
  
  // Handle gap changes
  const handleGapChange = (value: string) => {
    setGapInput(value);
    if (gapModeToggle.mode === 'all-borders') {
      updateDesignProperty('layout', 'gap', value ? `${value}${gapUnit}` : null);
    }
  };
  
  const handleColumnGapChange = (value: string) => {
    setColumnGapInput(value);
    updateDesignProperty('layout', 'columnGap', value ? `${value}${gapUnit}` : null);
  };
  
  const handleRowGapChange = (value: string) => {
    setRowGapInput(value);
    updateDesignProperty('layout', 'rowGap', value ? `${value}${gapUnit}` : null);
  };
  
  // Handle gap unit change
  const handleGapUnitChange = (newUnit: 'px' | 'rem' | 'em') => {
    setGapUnit(newUnit);
    // Update stored values with new unit
    if (gapModeToggle.mode === 'all-borders' && gap) {
      const numericValue = extractValue(gap);
      if (numericValue) {
        updateDesignProperty('layout', 'gap', `${numericValue}${newUnit}`);
      }
    } else {
      const updates: { category: 'layout'; property: string; value: string | null }[] = [];
      if (columnGap) {
        const numericValue = extractValue(columnGap);
        if (numericValue) {
          updates.push({ category: 'layout', property: 'columnGap', value: `${numericValue}${newUnit}` });
        }
      }
      if (rowGap) {
        const numericValue = extractValue(rowGap);
        if (numericValue) {
          updates.push({ category: 'layout', property: 'rowGap', value: `${numericValue}${newUnit}` });
        }
      }
      if (updates.length > 0) {
        updateDesignProperties(updates);
      }
    }
  };
  
  // Handle padding changes
  const handlePaddingChange = (value: string) => {
    setPaddingInput(value);
    if (paddingModeToggle.mode === 'all-borders') {
      updateDesignProperty('spacing', 'padding', value ? `${value}${paddingUnit}` : null);
    }
  };
  
  const handlePaddingTopChange = (value: string) => {
    setPaddingTopInput(value);
    updateDesignProperty('spacing', 'paddingTop', value ? `${value}${paddingUnit}` : null);
  };
  
  const handlePaddingRightChange = (value: string) => {
    setPaddingRightInput(value);
    updateDesignProperty('spacing', 'paddingRight', value ? `${value}${paddingUnit}` : null);
  };
  
  const handlePaddingBottomChange = (value: string) => {
    setPaddingBottomInput(value);
    updateDesignProperty('spacing', 'paddingBottom', value ? `${value}${paddingUnit}` : null);
  };
  
  const handlePaddingLeftChange = (value: string) => {
    setPaddingLeftInput(value);
    updateDesignProperty('spacing', 'paddingLeft', value ? `${value}${paddingUnit}` : null);
  };
  
  // Handle padding unit change
  const handlePaddingUnitChange = (newUnit: 'px' | 'rem' | 'em') => {
    setPaddingUnit(newUnit);
    // Update stored values with new unit
    if (paddingModeToggle.mode === 'all-borders' && padding) {
      const numericValue = extractValue(padding);
      if (numericValue) {
        updateDesignProperty('spacing', 'padding', `${numericValue}${newUnit}`);
      }
    } else {
      const updates: { category: 'spacing'; property: string; value: string | null }[] = [];
      if (paddingTop) {
        const numericValue = extractValue(paddingTop);
        if (numericValue) {
          updates.push({ category: 'spacing', property: 'paddingTop', value: `${numericValue}${newUnit}` });
        }
      }
      if (paddingRight) {
        const numericValue = extractValue(paddingRight);
        if (numericValue) {
          updates.push({ category: 'spacing', property: 'paddingRight', value: `${numericValue}${newUnit}` });
        }
      }
      if (paddingBottom) {
        const numericValue = extractValue(paddingBottom);
        if (numericValue) {
          updates.push({ category: 'spacing', property: 'paddingBottom', value: `${numericValue}${newUnit}` });
        }
      }
      if (paddingLeft) {
        const numericValue = extractValue(paddingLeft);
        if (numericValue) {
          updates.push({ category: 'spacing', property: 'paddingLeft', value: `${numericValue}${newUnit}` });
        }
      }
      if (updates.length > 0) {
        updateDesignProperties(updates);
      }
    }
  };
  
  // Handle grid template changes
  const handleGridColsChange = (value: string) => {
    updateDesignProperty('layout', 'gridTemplateColumns', value || null);
  };
  
  const handleGridRowsChange = (value: string) => {
    updateDesignProperty('layout', 'gridTemplateRows', value || null);
  };
  
  // Extract numeric value from design property
  return (
    <div className="py-5">
      <header className="py-4 -mt-4">
        <Label>Layout</Label>
      </header>

      <div className="flex flex-col gap-2">

          <div className="grid grid-cols-3">
              <Label variant="muted">Type</Label>
              <div className="col-span-2">
                  <Tabs
                    value={layoutType}
                    onValueChange={(value) => handleLayoutTypeChange(value as 'columns' | 'rows' | 'grid')}
                    className="w-full"
                  >
                      <TabsList className="w-full">
                          <TabsTrigger value="columns">
                              <Icon name="columns" />
                          </TabsTrigger>
                          <TabsTrigger value="rows">
                              <Icon name="rows" />
                          </TabsTrigger>
                          <TabsTrigger value="grid">
                              <Icon name="grid" />
                          </TabsTrigger>
                      </TabsList>
                  </Tabs>
              </div>
          </div>

          {layoutType !== 'grid' && (
              <>
                  <div className="grid grid-cols-3">
                      <Label variant="muted">Align</Label>
                      <div className="col-span-2">
                          <Tabs
                            value={alignItems || 'start'}
                            onValueChange={handleAlignChange}
                            className="w-full"
                          >
                              <TabsList className="w-full">
                                  <TabsTrigger value="start">
                                      <Icon name="alignStart" className={layoutType === 'rows' ? '-rotate-90' : ''} />
                                  </TabsTrigger>
                                  <TabsTrigger value="center">
                                      <Icon name="alignCenter" className={layoutType === 'rows' ? '-rotate-90' : ''} />
                                  </TabsTrigger>
                                  <TabsTrigger value="end">
                                      <Icon name="alignEnd" className={layoutType === 'rows' ? '-rotate-90' : ''} />
                                  </TabsTrigger>
                                  <TabsTrigger value="stretch">
                                      <Icon name="alignStretch" className={layoutType === 'rows' ? '-rotate-90' : ''} />
                                  </TabsTrigger>
                              </TabsList>
                          </Tabs>
                      </div>
                  </div>

                  <div className="grid grid-cols-3">
                      <Label variant="muted">Justify</Label>
                      <div className="col-span-2 *:w-full">
                          <Select value={justifyContent} onValueChange={handleJustifyChange}>
                              <SelectTrigger>
                                  <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                  <SelectGroup>
                                      <SelectItem value="start">Start</SelectItem>
                                      <SelectItem value="center">Center</SelectItem>
                                      <SelectItem value="end">End</SelectItem>
                                      <SelectItem value="between">Between</SelectItem>
                                      <SelectItem value="around">Around</SelectItem>
                                      <SelectItem value="evenly">Evenly</SelectItem>
                                  </SelectGroup>
                              </SelectContent>
                          </Select>
                      </div>
                  </div>
              </>
          )}

          {layoutType === 'grid' && (
              <div className="grid grid-cols-3">
                  <Label variant="muted">Grid</Label>
                  <div className="col-span-2 grid grid-cols-2 gap-2">
                      <InputGroup>
                          <InputGroupAddon>
                              <div className="flex">
                                  <Tooltip>
                                      <TooltipTrigger>
                                          <Icon name="columns" className="size-3" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                          <p>Columns</p>
                                      </TooltipContent>
                                  </Tooltip>
                              </div>
                          </InputGroupAddon>
                          <InputGroupInput
                            className="!pr-0"
                            value={gridCols}
                            onChange={(e) => handleGridColsChange(e.target.value)}
                            placeholder="repeat(3, 1fr)"
                          />
                      </InputGroup>
                      <InputGroup>
                          <InputGroupAddon>
                              <div className="flex">
                                  <Tooltip>
                                      <TooltipTrigger>
                                          <Icon name="columns" className="size-3 rotate-90" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                          <p>Rows</p>
                                      </TooltipContent>
                                  </Tooltip>
                              </div>
                          </InputGroupAddon>
                          <InputGroupInput
                            className="!pr-0"
                            value={gridRows}
                            onChange={(e) => handleGridRowsChange(e.target.value)}
                            placeholder="auto"
                          />
                      </InputGroup>
                  </div>
              </div>
          )}

          {layoutType === 'columns' && (
              <div className="grid grid-cols-3">
                  <Label variant="muted">Wrap</Label>
                  <div className="col-span-2">
                      <Tabs
                        value={wrapMode}
                        onValueChange={(value) => handleWrapChange(value as 'yes' | 'no')}
                        className="w-full"
                      >
                          <TabsList className="w-full">
                              <TabsTrigger value="yes">Yes</TabsTrigger>
                              <TabsTrigger value="no">No</TabsTrigger>
                          </TabsList>
                      </Tabs>
                  </div>
              </div>
          )}

          <div className="grid grid-cols-3 items-start">
              <Label variant="muted" className="h-8">Gap</Label>
              <div className="col-span-2 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                      <InputGroup className="flex-1">
                          <InputGroupInput
                            disabled={gapModeToggle.mode === 'individual-borders'}
                            value={gapInput}
                            onChange={(e) => handleGapChange(e.target.value)}
                            placeholder="16"
                          />
                          <InputGroupAddon align="inline-end">
                              <Select value={gapUnit} onValueChange={handleGapUnitChange}>
                                  <SelectTrigger size="xs" variant="ghost">
                                      {gapUnit}
                                  </SelectTrigger>
                                  <SelectContent>
                                      <SelectGroup>
                                          <SelectItem value="px">px</SelectItem>
                                          <SelectItem value="rem">rem</SelectItem>
                                          <SelectItem value="em">em</SelectItem>
                                      </SelectGroup>
                                  </SelectContent>
                              </Select>
                          </InputGroupAddon>
                      </InputGroup>
                      <Button
                        variant={gapModeToggle.mode === 'individual-borders' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={gapModeToggle.handleToggle}
                      >
                          <Icon name="link" />
                      </Button>
                  </div>
                  {gapModeToggle.mode === 'individual-borders' && (
                       <div className="col-span-2 grid grid-cols-2 gap-2">
                       <InputGroup>
                           <InputGroupAddon>
                               <div className="flex">
                                   <Tooltip>
                                       <TooltipTrigger>
                                           <Icon name="horizontalGap" className="size-3" />
                                       </TooltipTrigger>
                                       <TooltipContent>
                                           <p>Horizontal gap</p>
                                       </TooltipContent>
                                   </Tooltip>
                               </div>
                           </InputGroupAddon>
                           <InputGroupInput
                             className="!pr-0"
                             value={columnGapInput}
                             onChange={(e) => handleColumnGapChange(e.target.value)}
                             placeholder="16"
                           />
                       </InputGroup>
                       <InputGroup>
                           <InputGroupAddon>
                               <div className="flex">
                                   <Tooltip>
                                       <TooltipTrigger>
                                           <Icon name="verticalGap" className="size-3" />
                                       </TooltipTrigger>
                                       <TooltipContent>
                                           <p>Vertical gap</p>
                                       </TooltipContent>
                                   </Tooltip>
                               </div>
                           </InputGroupAddon>
                           <InputGroupInput
                             className="!pr-0"
                             value={rowGapInput}
                             onChange={(e) => handleRowGapChange(e.target.value)}
                             placeholder="16"
                           />
                       </InputGroup>
                   </div>
                  )}
              </div>
          </div>

          <div className="grid grid-cols-3 items-start">
              <Label variant="muted" className="h-8">Padding</Label>
              <div className="col-span-2 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                      <InputGroup className="flex-1">
                          <InputGroupInput
                            disabled={paddingModeToggle.mode === 'individual-borders'}
                            value={paddingInput}
                            onChange={(e) => handlePaddingChange(e.target.value)}
                            placeholder="16"
                          />
                          <InputGroupAddon align="inline-end">
                              <Select value={paddingUnit} onValueChange={handlePaddingUnitChange}>
                                  <SelectTrigger size="xs" variant="ghost">
                                      {paddingUnit}
                                  </SelectTrigger>
                                  <SelectContent>
                                      <SelectGroup>
                                          <SelectItem value="px">px</SelectItem>
                                          <SelectItem value="rem">rem</SelectItem>
                                          <SelectItem value="em">em</SelectItem>
                                      </SelectGroup>
                                  </SelectContent>
                              </Select>
                          </InputGroupAddon>
                      </InputGroup>
                      <Button
                        variant={paddingModeToggle.mode === 'individual-borders' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={paddingModeToggle.handleToggle}
                      >
                          <Icon name="individualBorders" />
                      </Button>
                  </div>
                  {paddingModeToggle.mode === 'individual-borders' && (
                      <div className="grid grid-cols-2 gap-2">
                          <InputGroup>
                              <InputGroupAddon>
                                  <div className="flex">
                                      <Tooltip>
                                          <TooltipTrigger>
                                              <Icon name="paddingSide" className="size-3" />
                                          </TooltipTrigger>
                                          <TooltipContent>
                                              <p>Left padding</p>
                                          </TooltipContent>
                                      </Tooltip>
                                  </div>
                              </InputGroupAddon>
                              <InputGroupInput
                                className="!pr-0"
                                value={paddingLeftInput}
                                onChange={(e) => handlePaddingLeftChange(e.target.value)}
                                placeholder="16"
                              />
                          </InputGroup>
                          <InputGroup>
                              <InputGroupAddon>
                                  <div className="flex">
                                      <Tooltip>
                                          <TooltipTrigger>
                                              <Icon name="paddingSide" className="size-3 rotate-90" />
                                          </TooltipTrigger>
                                          <TooltipContent>
                                              <p>Top padding</p>
                                          </TooltipContent>
                                      </Tooltip>
                                  </div>
                              </InputGroupAddon>
                              <InputGroupInput
                                className="!pr-0"
                                value={paddingTopInput}
                                onChange={(e) => handlePaddingTopChange(e.target.value)}
                                placeholder="16"
                              />
                          </InputGroup>
                          <InputGroup>
                              <InputGroupAddon>
                                  <div className="flex">
                                      <Tooltip>
                                          <TooltipTrigger>
                                              <Icon name="paddingSide" className="size-3 rotate-180" />
                                          </TooltipTrigger>
                                          <TooltipContent>
                                              <p>Right padding</p>
                                          </TooltipContent>
                                      </Tooltip>
                                  </div>
                              </InputGroupAddon>
                              <InputGroupInput
                                className="!pr-0"
                                value={paddingRightInput}
                                onChange={(e) => handlePaddingRightChange(e.target.value)}
                                placeholder="16"
                              />
                          </InputGroup>
                          <InputGroup>
                              <InputGroupAddon>
                                  <div className="flex">
                                      <Tooltip>
                                          <TooltipTrigger>
                                              <Icon name="paddingSide" className="size-3 rotate-270" />
                                          </TooltipTrigger>
                                          <TooltipContent>
                                              <p>Bottom padding</p>
                                          </TooltipContent>
                                      </Tooltip>
                                  </div>
                              </InputGroupAddon>
                              <InputGroupInput
                                className="!pr-0"
                                value={paddingBottomInput}
                                onChange={(e) => handlePaddingBottomChange(e.target.value)}
                                placeholder="16"
                              />
                          </InputGroup>
                      </div>
                  )}
              </div>
          </div>

      </div>
    </div>
  );
}
