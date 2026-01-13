import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const LAYOUTS_FILE_PATH = path.join(process.cwd(), 'lib', 'templates', 'layouts.ts');

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

    const template = JSON.parse(templateStr);

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
