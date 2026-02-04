import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getAssetsByIds } from '@/lib/repositories/assetRepository';
import { getComponentsByIds } from '@/lib/repositories/componentRepository';
import type { Layer } from '@/types';

const LAYOUTS_FILE_PATH = path.join(process.cwd(), 'lib', 'templates', 'layouts.ts');

/**
 * Collect all asset IDs from icon layers in the template
 */
function collectIconAssetIds(layer: Layer): string[] {
  const assetIds: string[] = [];

  // Check if this layer has an icon with asset reference
  if (layer.name === 'icon' && layer.variables?.icon?.src) {
    const iconSrc = layer.variables.icon.src as { type: string; data?: { asset_id?: string } };
    if (iconSrc.type === 'asset' && iconSrc.data?.asset_id) {
      assetIds.push(iconSrc.data.asset_id);
    }
  }

  // Recursively check children
  if (layer.children) {
    for (const child of layer.children) {
      assetIds.push(...collectIconAssetIds(child));
    }
  }

  return assetIds;
}

/**
 * Collect all component IDs from layers with componentId
 */
function collectComponentIds(layer: Layer): string[] {
  const componentIds: string[] = [];

  // Check if this layer is a component instance
  if (layer.componentId) {
    componentIds.push(layer.componentId);
  }

  // Recursively check children
  if (layer.children) {
    for (const child of layer.children) {
      componentIds.push(...collectComponentIds(child));
    }
  }

  return componentIds;
}

/**
 * Replace asset references with inline SVG content for portability
 * This makes layouts work across different projects/databases
 */
function inlineIconAssets(layer: Layer, assetsMap: Record<string, { content?: string | null }>): Layer {
  const newLayer = { ...layer };

  // If this is an icon layer with asset reference, convert to static_text with inline content
  if (newLayer.name === 'icon' && newLayer.variables?.icon?.src) {
    const iconSrc = newLayer.variables.icon.src as { type: string; data?: { asset_id?: string } };
    if (iconSrc.type === 'asset' && iconSrc.data?.asset_id) {
      const asset = assetsMap[iconSrc.data.asset_id];
      if (asset?.content) {
        // Convert to static_text with inline SVG
        newLayer.variables = {
          ...newLayer.variables,
          icon: {
            ...newLayer.variables.icon,
            src: {
              type: 'static_text',
              data: { content: asset.content },
            },
          },
        };
      }
    }
  }

  // Recursively process children
  if (newLayer.children) {
    newLayer.children = newLayer.children.map(child => inlineIconAssets(child, assetsMap));
  }

  return newLayer;
}

/**
 * Replace component instances with inlined component layers for portability.
 * Stores the component name and variables in _inlinedComponentName and _inlinedComponentVariables
 * so it can be recreated as a component when the layout is used in another project.
 */
function inlineComponents(
  layer: Layer,
  componentsMap: Record<string, { name: string; layers: Layer[]; variables?: any[] }>
): Layer {
  const newLayer = { ...layer };

  // If this is a component instance, inline its layers
  if (newLayer.componentId) {
    console.log(`[inlineComponents] Found component instance: ${newLayer.componentId}`);
    const component = componentsMap[newLayer.componentId];
    if (component && component.layers?.length > 0) {
      // Check if layers have interactions
      const checkInteractions = (layers: any[]): boolean => {
        return layers.some(l => l.interactions?.length > 0 || (l.children && checkInteractions(l.children)));
      };
      const hasInteractions = checkInteractions(component.layers);
      console.log(`[inlineComponents] Inlining component "${component.name}" with ${component.layers.length} layers, hasInteractions: ${hasInteractions}`);
      // Store the component name for recreation later
      (newLayer as any)._inlinedComponentName = component.name;
      // Store component variables if they exist
      if (component.variables?.length) {
        (newLayer as any)._inlinedComponentVariables = component.variables;
        console.log(`[inlineComponents] Stored ${component.variables.length} component variables`);
      }
      // Remove the componentId (it won't be valid in other projects)
      delete newLayer.componentId;
      // Set the component's layers as children (deep copy and process recursively)
      newLayer.children = component.layers.map(child =>
        inlineComponents({ ...child }, componentsMap)
      );
    } else {
      console.log(`[inlineComponents] Component not found in map or has no layers`);
    }
  }

  // Recursively process existing children (non-component layers)
  if (newLayer.children && !newLayer.componentId) {
    newLayer.children = newLayer.children.map(child => inlineComponents(child, componentsMap));
  }

  return newLayer;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const layoutKey = formData.get('layoutKey') as string;
    const layoutName = formData.get('layoutName') as string;
    const category = formData.get('category') as string;
    const templateStr = formData.get('template') as string;
    const imageFile = formData.get('image') as File | null;

    if (!layoutKey || !layoutName || !category || !templateStr) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    let template = JSON.parse(templateStr);

    // Make components portable: inline component layers with metadata for recreation
    const componentIds = collectComponentIds(template);
    console.log(`[layouts API] Found ${componentIds.length} component(s) to inline:`, componentIds);
    if (componentIds.length > 0) {
      try {
        const componentsMap = await getComponentsByIds(componentIds);
        console.log(`[layouts API] Fetched components:`, Object.keys(componentsMap));
        template = inlineComponents(template, componentsMap);
        console.log(`✅ Inlined ${componentIds.length} component(s) for portability`);

        // After inlining components, re-collect icon asset IDs since components may have icons
        // We need to inline those icons too
      } catch (error) {
        console.warn('Warning: Could not inline components:', error);
        // Continue without inlining - layout will still save but may not be portable
      }
    }

    // Make icons portable: collect asset IDs and inline the SVG content
    // This runs after component inlining to catch icons inside components
    // Uses draft assets (isPublished: false) since layouts are exported from the builder
    const iconAssetIds = collectIconAssetIds(template);
    if (iconAssetIds.length > 0) {
      try {
        const assetsMap = await getAssetsByIds(iconAssetIds, false);
        template = inlineIconAssets(template, assetsMap);
        console.log(`✅ Inlined ${iconAssetIds.length} icon(s) for portability`);
      } catch (error) {
        console.warn('Warning: Could not inline icon assets:', error);
        // Continue without inlining - layout will still save but may not be portable
      }
    }

    // Handle image upload if provided
    let imageExtension = '.webp'; // default
    if (imageFile) {
      const layoutsDir = path.join(process.cwd(), 'public', 'layouts');

      // Ensure layouts directory exists
      try {
        await fs.access(layoutsDir);
      } catch {
        await fs.mkdir(layoutsDir, { recursive: true });
      }

      // Get file extension
      imageExtension = path.extname(imageFile.name) || '.webp';
      const imagePath = path.join(layoutsDir, `${layoutKey}${imageExtension}`);

      // Convert File to Buffer and save
      const bytes = await imageFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await fs.writeFile(imagePath, buffer);

      console.log('✅ Image saved:', imagePath);
    }

    // Read the existing file
    let fileContent = await fs.readFile(LAYOUTS_FILE_PATH, 'utf-8');

    // Find the closing brace of layoutTemplates object
    const layoutTemplatesMatch = fileContent.match(/export const layoutTemplates: Record<string, LayoutTemplate> = \{([\s\S]*?)\n\};/);

    if (!layoutTemplatesMatch) {
      return NextResponse.json(
        { error: 'Could not find layoutTemplates in layouts.ts' },
        { status: 500 }
      );
    }

    const existingLayouts = layoutTemplatesMatch[1];

    // Make layout key unique if it already exists
    let uniqueLayoutKey = layoutKey;
    let counter = 2;
    while (existingLayouts.includes(`'${uniqueLayoutKey}':`)) {
      uniqueLayoutKey = `${layoutKey}-${counter}`;
      counter++;
    }

    // Update image extension if key was modified
    const finalImagePath = `/layouts/${uniqueLayoutKey}${imageExtension}`;

    // If we had to make the key unique, also rename the saved image file
    if (uniqueLayoutKey !== layoutKey && imageFile) {
      const layoutsDir = path.join(process.cwd(), 'public', 'layouts');
      const oldImagePath = path.join(layoutsDir, `${layoutKey}${imageExtension}`);
      const newImagePath = path.join(layoutsDir, `${uniqueLayoutKey}${imageExtension}`);

      try {
        await fs.rename(oldImagePath, newImagePath);
      } catch (error) {
        console.error('Failed to rename image file:', error);
      }
    }

    // Format the new layout entry
    const templateJson = JSON.stringify(template, null, 6);
    const newLayoutEntry = `  '${uniqueLayoutKey}': {
    category: '${category}',
    previewImage: '${finalImagePath}',
    template: ${templateJson.replace(/\n/g, '\n    ')},
  },`;

    // Insert the new layout before the closing brace
    const updatedLayouts = existingLayouts.trimEnd() + '\n\n' + newLayoutEntry;

    // Replace in file content
    fileContent = fileContent.replace(
      /export const layoutTemplates: Record<string, LayoutTemplate> = \{[\s\S]*?\n\};/,
      `export const layoutTemplates: Record<string, LayoutTemplate> = {${updatedLayouts}\n};`
    );

    // Write back to file
    await fs.writeFile(LAYOUTS_FILE_PATH, fileContent, 'utf-8');

    return NextResponse.json({
      data: { layoutKey, layoutName, category },
      message: 'Layout saved successfully',
    });
  } catch (error) {
    console.error('Error saving layout:', error);
    return NextResponse.json(
      { error: 'Failed to save layout' },
      { status: 500 }
    );
  }
}
