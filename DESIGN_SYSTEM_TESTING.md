# Design System Implementation - Testing Guide

## Overview
The design system has been successfully implemented with full Tailwind class manipulation capabilities. All design controls now update both the `layer.design` object and the corresponding Tailwind CSS classes.

## What Has Been Implemented

### Core Utilities

1. **`/lib/tailwind-class-mapper.ts`**
   - Bidirectional conversion between design properties and Tailwind classes
   - Intelligent conflict resolution (removes old classes when new ones are added)
   - Support for arbitrary values: `gap-[23px]`, `w-[347rem]`, etc.
   - Comprehensive property mapping for all design categories

2. **`/hooks/use-design-sync.ts`**
   - Manages sync between `layer.design` object and Tailwind classes
   - Provides `updateDesignProperty()` for single property updates
   - Provides `updateDesignProperties()` for batch updates
   - Provides `getDesignProperty()` for reading current values
   - Provides `resetDesignCategory()` for clearing entire categories

### Updated Control Components

3. **LayoutControls** (Updated)
   - Display type (flex row, flex col, grid)
   - Align items (start, center, end, stretch)
   - Justify content (start, center, end, between, around, evenly)
   - Flex wrap (yes/no)
   - Gap (unified or individual column/row gap)
   - Padding (unified or individual sides)
   - Grid template columns/rows
   - Unit selector (px, rem, em)

4. **TypographyControls** (Updated)
   - Font family (sans, serif, mono)
   - Font weight (thin to black)
   - Font size with unit selector
   - Text align (left, center, right, justify)
   - Letter spacing
   - Line height

5. **BorderControls** (Updated)
   - Border radius (unified or individual corners)
   - Border width (unified or individual sides)
   - Border style (solid, dashed, dotted, double)
   - Border color (color picker)
   - Add/remove border functionality

6. **EffectControls** (Updated)
   - Opacity (0-100% with slider)
   - Box shadow (none, sm, md, lg, xl, 2xl, inner)

### New Control Components

7. **SpacingControls** (New)
   - Margin (unified or individual sides)
   - Support for "auto" value
   - Unit selector (px, rem, em)

8. **SizingControls** (New)
   - Width/Height
   - Min Width/Height
   - Max Width/Height
   - Support for keywords: auto, full, screen, min, max, fit
   - Unit selector (px, rem, em, %)

9. **BackgroundsControls** (New)
   - Background color (color picker)
   - Background image (URL input)
   - Background size (auto, cover, contain)
   - Background position (center, top, bottom, etc.)
   - Background repeat (no-repeat, repeat, repeat-x, repeat-y, etc.)

10. **PositioningControls** (New)
    - Position type (static, relative, absolute, fixed, sticky)
    - Top/Right/Bottom/Left offsets (when positioned)
    - Z-index
    - Unit selector (px, rem, em, %)

### Integration

11. **RightSidebar** (Updated)
    - All control components integrated in Design tab
    - Proper order: Layout → Spacing → Sizing → Typography → Backgrounds → Borders → Effects → Positioning
    - Manual class input still available at the bottom
    - All controls receive `layer` and `onLayerUpdate` props

## How It Works

### Flow
1. User interacts with design control (e.g., changes gap from 16px to 24px)
2. Control calls `updateDesignProperty('layout', 'gap', '24px')`
3. Hook updates `layer.design.layout.gap = '24px'`
4. Hook converts to Tailwind class: `gap-[24px]`
5. Hook removes conflicting classes (e.g., removes `gap-[16px]`)
6. Hook adds new class to layer.classes
7. Hook calls `onLayerUpdate()` with both design object and updated classes
8. Layer re-renders with new styles

### Class Conflict Resolution
- When you change `gap-4` to `gap-8`, the system:
  1. Identifies all classes matching the `gap-*` pattern
  2. Removes them from the classes array
  3. Adds the new class `gap-8`
  4. Updates the layer

### Arbitrary Values
- Numeric inputs automatically create arbitrary values
- Examples:
  - Gap: `23` → `gap-[23px]`
  - Width: `347` + `rem` unit → `w-[347rem]`
  - Font size: `18.5` + `px` → `text-[18.5px]`

## Testing Checklist

### Basic Functionality
- [ ] Select a layer in the canvas
- [ ] Open Design tab in right sidebar
- [ ] Change layout type (columns → rows → grid)
- [ ] Verify classes update (should see `flex flex-row`, `flex flex-col`, `grid`)
- [ ] Change gap value
- [ ] Verify old gap class is removed and new one is added

### Unit Conversion
- [ ] Set gap to `16` with unit `px`
- [ ] Verify class: `gap-[16px]`
- [ ] Change unit to `rem`
- [ ] Set gap to `1`
- [ ] Verify class: `gap-[1rem]`

### Conflict Resolution
- [ ] Manually add class `gap-4` in class input
- [ ] Use gap control to change to `24px`
- [ ] Verify `gap-4` is removed and `gap-[24px]` is added

### Individual vs Unified
- [ ] Set unified gap to `16px`
- [ ] Toggle to individual gap mode
- [ ] Verify unified gap is cleared
- [ ] Set column gap to `8px`, row gap to `16px`
- [ ] Verify classes: `gap-x-[8px] gap-y-[16px]`
- [ ] Toggle back to unified mode
- [ ] Verify individual gaps are cleared

### Border Controls
- [ ] Click "Add" border button
- [ ] Verify border classes added: `border border-solid border-[#000000]`
- [ ] Change border width to `2`
- [ ] Verify: `border` removed, `border-[2px]` added
- [ ] Change border style to `dashed`
- [ ] Verify: `border-dashed` added

### Typography
- [ ] Change font size to `18` with unit `px`
- [ ] Verify class: `text-[18px]`
- [ ] Change text align to `center`
- [ ] Verify class: `text-center`
- [ ] Change font weight to `bold`
- [ ] Verify class: `font-bold`

### Sizing
- [ ] Set width to `300` with unit `px`
- [ ] Verify class: `w-[300px]`
- [ ] Change to `full`
- [ ] Verify class: `w-full`
- [ ] Set max-width to `1200` with unit `px`
- [ ] Verify class: `max-w-[1200px]`

### Backgrounds
- [ ] Pick a background color
- [ ] Verify class: `bg-[#hexcolor]`
- [ ] Enter image URL
- [ ] Verify class includes background image URL
- [ ] Change background size to `cover`
- [ ] Verify class: `bg-cover`

### Positioning
- [ ] Change position to `absolute`
- [ ] Verify class: `absolute`
- [ ] Set top to `10` with unit `px`
- [ ] Verify class: `top-[10px]`
- [ ] Set z-index to `50`
- [ ] Verify class: `z-[50]`

### Manual Class Input
- [ ] Type a class manually: `hover:bg-red-500`
- [ ] Press Enter
- [ ] Verify class is added
- [ ] Use design control to add conflicting class
- [ ] Verify both coexist (no conflict for different pseudo-states)

### Persistence
- [ ] Make several design changes
- [ ] Switch to different layer
- [ ] Switch back to original layer
- [ ] Verify all design properties are retained
- [ ] Refresh page
- [ ] Verify design properties persist (if auto-save is enabled)

## Known Limitations & Future Enhancements

### Current Limitations
1. No responsive breakpoint controls (sm:, md:, lg:, etc.)
2. No pseudo-state controls (hover:, focus:, active:, etc.)
3. Color inputs are basic HTML color pickers (no color palette)
4. No preset/style library yet
5. Background image doesn't support gradient editor
6. No undo/redo for design changes specifically

### Planned Enhancements
- Copy/paste styles between layers
- Global design system / style presets
- Responsive breakpoint controls
- Hover/focus state styling
- Design history/undo/redo
- Color palette manager
- Gradient builder

## Troubleshooting

### Classes Not Updating
- Check browser console for errors
- Verify `onLayerUpdate` is being called
- Check that `selectedLayer` is not null
- Verify layer has `design` and `classes` properties

### Conflicts Not Resolving
- Check `tailwind-class-mapper.ts` for the property pattern
- Verify the regex pattern matches the class format
- Test conflict resolution in isolation

### Values Not Displaying
- Check `getDesignProperty()` is returning correct value
- Verify `extractValue()` is parsing the value correctly
- Check unit state is synced correctly

## Files Modified/Created

### Created
- `/lib/tailwind-class-mapper.ts` (400+ lines)
- `/hooks/use-design-sync.ts` (150+ lines)
- `/app/ycode/components/SpacingControls.tsx` (180+ lines)
- `/app/ycode/components/SizingControls.tsx` (200+ lines)
- `/app/ycode/components/BackgroundsControls.tsx` (120+ lines)
- `/app/ycode/components/PositioningControls.tsx` (150+ lines)

### Modified
- `/app/ycode/components/LayoutControls.tsx` (Complete rewrite with hooks)
- `/app/ycode/components/TypographyControls.tsx` (Complete rewrite with hooks)
- `/app/ycode/components/BorderControls.tsx` (Complete rewrite with hooks)
- `/app/ycode/components/EffectControls.tsx` (Complete rewrite with hooks)
- `/app/ycode/components/RightSidebar.tsx` (Added new components, passed props)
- `/types/index.ts` (Added linkSettings and embedUrl to LayerSettings)
- `/lib/templates/actions.ts` (Fixed property names to match types)

## Summary

The design system is now fully functional with:
- ✅ Bidirectional sync between design object and Tailwind classes
- ✅ Intelligent conflict resolution
- ✅ Arbitrary value support with units
- ✅ All 8 design categories implemented
- ✅ Clean, maintainable architecture
- ✅ Type-safe implementation
- ✅ No linter or TypeScript errors

The system is ready for testing and use. Future enhancements can build on this solid foundation.

