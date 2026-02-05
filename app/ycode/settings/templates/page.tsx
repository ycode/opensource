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
        <header className="pt-8 pb-6 flex items-center justify-between">
          <span className="text-base font-medium">Templates</span>
          <Button onClick={() => setShowExportDialog(true)} variant="secondary">
            Submit template
          </Button>
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

        {/* Export Dialog */}
        <TemplateExportDialog
          open={showExportDialog}
          onOpenChange={setShowExportDialog}
        />
      </div>
    </div>
  );
}
