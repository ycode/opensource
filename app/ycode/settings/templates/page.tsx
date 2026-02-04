'use client';

import {
  FieldDescription,
  FieldLegend,
} from '@/components/ui/field';
import { TemplateGallery } from '@/components/templates';

export default function TemplatesSettingsPage() {
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
        <div className="bg-secondary/20 p-8 rounded-lg">
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
      </div>
    </div>
  );
}
