'use client';

/**
 * TemplateGallery Component
 *
 * Displays a grid of available templates for selection with category filtering.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { TemplateCard } from './TemplateCard';
import { TemplateApplyDialog } from './TemplateApplyDialog';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Template {
  id: string;
  name: string;
  description: string;
  preview: string;
  categoryId: string | null;
  livePreviewUrl: string | null;
}

interface Category {
  id: string;
  name: string;
  order: number;
}

interface TemplateGalleryProps {
  onApplySuccess?: () => void;
  className?: string;
}

export function TemplateGallery({
  onApplySuccess,
  className,
}: TemplateGalleryProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null
  );
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showApplyDialog, setShowApplyDialog] = useState(false);

  // Fetch templates and categories on mount
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/templates');

        if (!response.ok) {
          throw new Error('Failed to fetch templates');
        }

        const data = await response.json();
        setTemplates(data.templates || []);
        setCategories(data.categories || []);
      } catch (err) {
        console.error('[TemplateGallery] Error fetching data:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to load templates'
        );
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // Filter templates by selected category
  const filteredTemplates = useMemo(() => {
    if (selectedCategory === 'all') {
      return templates;
    }
    return templates.filter((t) => t.categoryId === selectedCategory);
  }, [templates, selectedCategory]);

  // Clear selected template when category changes and template is no longer visible
  useEffect(() => {
    if (selectedTemplate) {
      const isStillVisible = filteredTemplates.some(
        (t) => t.id === selectedTemplate.id
      );
      if (!isStillVisible) {
        setSelectedTemplate(null);
      }
    }
  }, [filteredTemplates, selectedTemplate]);

  const handleTemplateClick = (template: Template) => {
    setSelectedTemplate(template);
  };

  const handleApplyClick = () => {
    if (selectedTemplate) {
      setShowApplyDialog(true);
    }
  };

  const handleApplySuccess = () => {
    setShowApplyDialog(false);
    setSelectedTemplate(null);
    onApplySuccess?.();
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <EmptyState
        icon="alert-circle"
        title="Failed to load templates"
        description={error}
        actionLabel="Try again"
        onAction={() => window.location.reload()}
      />
    );
  }

  // Empty state
  if (templates.length === 0) {
    return (
      <EmptyState
        icon="layout-template"
        title="No templates available"
        description="Templates will appear here once they are added to the template service."
      />
    );
  }

  return (
    <div className={className}>
      {/* Category Filter Dropdown */}
      {categories.length > 0 && (
        <div className="mb-6">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Template Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredTemplates.map((template) => (
          <TemplateCard
            key={template.id}
            name={template.name}
            description={template.description}
            preview={template.preview}
            livePreviewUrl={template.livePreviewUrl}
            selected={selectedTemplate?.id === template.id}
            onClick={() => handleTemplateClick(template)}
          />
        ))}
      </div>

      {/* Empty state for filtered results */}
      {filteredTemplates.length === 0 && templates.length > 0 && (
        <EmptyState
          icon="layout-template"
          title="No templates in this category"
          description="Try selecting a different category."
        />
      )}

      {/* Apply Button */}
      {selectedTemplate && (
        <div className="mt-6 flex justify-center">
          <Button onClick={handleApplyClick} size="lg">
            Apply &ldquo;{selectedTemplate.name}&rdquo; Template
          </Button>
        </div>
      )}

      {/* Apply Confirmation Dialog */}
      <TemplateApplyDialog
        open={showApplyDialog}
        onOpenChange={setShowApplyDialog}
        template={selectedTemplate}
        onSuccess={handleApplySuccess}
      />
    </div>
  );
}

export default TemplateGallery;
