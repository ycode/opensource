'use client';

/**
 * Collapsible Settings Panel
 *
 * Reusable component for settings sections in the right sidebar
 */

import React from 'react';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { cn } from '@/lib/utils';

interface SettingsPanelProps {
  title: string;
  className?: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  action?: React.ReactNode; // Optional action button (like +)
  collapsible?: boolean; // Whether to show collapse triangle icon
}

export default function SettingsPanel({
  title,
  className,
  isOpen,
  onToggle,
  children,
  action,
  collapsible = false,
}: SettingsPanelProps) {
  return (
    <div className={cn('pt-5', className)}>
      <header
        className={cn(
          'w-full py-5 -mt-5 flex items-center justify-between',
          collapsible && 'cursor-pointer'
        )}
        onClick={collapsible ? onToggle : undefined}
      >
        <div className="flex items-center gap-2">
          {collapsible && (
            <Icon
              name="triangle-right"
              className={cn('size-3 opacity-30 transition-transform', isOpen && 'rotate-90')}
            />
          )}
          <Label className={collapsible ? 'cursor-pointer' : undefined}>{title}</Label>
        </div>
        <div
          className="flex items-center gap-2 -my-2"
          onClick={(e) => e.stopPropagation()}
        >
          {action}
        </div>
      </header>

      {isOpen && (
        <div className="flex flex-col gap-2 pb-5">
          {children}
        </div>
      )}
    </div>
  );
}
