'use client';

/**
 * Collapsible Settings Panel
 * 
 * Reusable component for settings sections in the right sidebar
 */

import React from 'react';

interface SettingsPanelProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export default function SettingsPanel({
  title,
  isOpen,
  onToggle,
  children,
}: SettingsPanelProps) {
  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden">
      {/* Collapsible Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-zinc-900 hover:bg-zinc-800 transition-colors"
      >
        <span className="text-sm font-medium text-white">{title}</span>
        <svg 
          className={`w-4 h-4 text-zinc-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Collapsible Content */}
      {isOpen && (
        <div className="px-4 py-4 space-y-4 bg-zinc-950">
          {children}
        </div>
      )}
    </div>
  );
}

