'use client';

/**
 * Collapsible Settings Panel
 *
 * Reusable component for settings sections in the right sidebar
 */

import React from 'react';
import { Label } from '@/components/ui/label';

interface SettingsPanelProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  action?: React.ReactNode; // Optional action button (like +)
}

export default function SettingsPanel({
  title,
  isOpen,
  onToggle,
  children,
  action,
}: SettingsPanelProps) {
  return (
    <div className="py-5">
      {/* Collapsible Header */}

      <header className="w-full py-4 -mt-4 flex items-center justify-between">
        <Label>{title}</Label>
        <div className="flex items-center gap-2 -my-2">
          {action}
        </div>
      </header>

      {/* Collapsible Content */}
      {isOpen && (
        <div className="flex flex-col gap-2">
          {children}
        </div>
      )}
    </div>
  );
}


