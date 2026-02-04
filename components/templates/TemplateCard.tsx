'use client';

/**
 * TemplateCard Component
 *
 * Displays a single template with preview image, name, and description.
 */

import React from 'react';
import { cn } from '@/lib/utils';
import Icon from '@/components/ui/icon';

export interface TemplateCardProps {
  name: string;
  description: string;
  preview?: string;
  livePreviewUrl?: string | null;
  selected?: boolean;
  onClick?: () => void;
}

export function TemplateCard({
  name,
  description,
  preview,
  livePreviewUrl,
  selected,
  onClick,
}: TemplateCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-xl border bg-background transition-all hover:border-blue-500/50 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50',
        selected && 'border-blue-500 ring-2 ring-blue-500/50'
      )}
    >
      {/* Preview Image */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
        {preview ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={preview}
            alt={`${name} preview`}
            className="h-full w-full object-cover object-top transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900">
            <span className="text-4xl font-bold text-gray-300 dark:text-gray-700">
              {name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        {/* Selected indicator */}
        {selected && (
          <div className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-white">
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-sm font-semibold text-foreground">{name}</h3>
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
          {description}
        </p>

        {/* Live Preview Link */}
        {livePreviewUrl && (
          <a
            href={livePreviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="mt-3 inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 hover:underline"
          >
            <Icon name="link" className="h-3 w-3" />
            View Demo
          </a>
        )}
      </div>
    </button>
  );
}

export default TemplateCard;
