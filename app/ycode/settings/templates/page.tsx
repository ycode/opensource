'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldLegend,
  FieldSeparator,
} from '@/components/ui/field';
import { TemplateGallery } from '@/components/templates';
import { TemplateExportDialog } from '@/components/templates/TemplateExportDialog';

export default function TemplatesSettingsPage() {
  const [showExportDialog, setShowExportDialog] = useState(false);

  const handleApplySuccess = () => {
    // Page will reload after template is applied
  };

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <header className="pt-8 pb-6">
          <span className="text-base font-medium">Templates</span>
        </header>

        {/* Apply Template Section */}
        <div className="bg-secondary/20 p-8 rounded-lg mb-8">
          <div className="mb-6">
            <FieldLegend>Apply Template</FieldLegend>
            <FieldDescription>
              Replace your current pages, collections, and components with a
              pre-built template. Your uploaded assets and settings will be
              preserved.
            </FieldDescription>
          </div>

          <TemplateGallery onApplySuccess={handleApplySuccess} />
        </div>

        <FieldSeparator />

        {/* Export Template Section */}
        <div className="bg-secondary/20 p-8 rounded-lg mt-8">
          <div className="grid grid-cols-3 gap-10">
            <div>
              <FieldLegend>Export as Template</FieldLegend>
              <FieldDescription>
                Save your current site as a reusable template. This will export
                all pages, collections, components, and assets.
              </FieldDescription>
            </div>

            <div className="col-span-2 flex items-center">
              <Button onClick={() => setShowExportDialog(true)}>
                Export Template
              </Button>
            </div>
          </div>
        </div>

        {/* Export Dialog */}
        <TemplateExportDialog
          open={showExportDialog}
          onOpenChange={setShowExportDialog}
        />
      </div>
    </div>
  );
}
