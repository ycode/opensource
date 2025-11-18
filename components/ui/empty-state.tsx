/**
 * EmptyState Component
 * 
 * Reusable empty state with icon, title, and optional action
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon = 'file',
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className='flex flex-col items-center justify-center py-12 px-4 text-center'>
      <Icon name={icon as any} className='w-12 h-12 text-gray-400 mb-4' />
      <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2'>
        {title}
      </h3>
      {description && (
        <p className='text-sm text-gray-600 dark:text-gray-400 mb-6 max-w-sm'>
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <Button onClick={onAction} size='sm'>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export default EmptyState;
