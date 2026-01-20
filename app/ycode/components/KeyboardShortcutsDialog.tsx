'use client';

/**
 * Keyboard Shortcuts Dialog
 *
 * Displays all available keyboard shortcuts organized by category.
 * Can be opened via the settings dropdown or with Shift+/
 */

import React, { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useEditorStore } from '@/stores/useEditorStore';

interface ShortcutKey {
  name: string;
}

interface Shortcut {
  name: string;
  keys: ShortcutKey[];
}

interface ShortcutCategory {
  name: string;
  shortcuts: Shortcut[];
}

const shortcutCategories: { left: ShortcutCategory[]; right: ShortcutCategory[] } = {
  left: [
    {
      name: 'Edit',
      shortcuts: [
        { name: 'Copy', keys: [{ name: '⌘' }, { name: 'C' }] },
        { name: 'Paste', keys: [{ name: '⌘' }, { name: 'V' }] },
        { name: 'Cut', keys: [{ name: '⌘' }, { name: 'X' }] },
        { name: 'Duplicate', keys: [{ name: '⌘' }, { name: 'D' }] },
        { name: 'Undo', keys: [{ name: '⌘' }, { name: 'Z' }] },
        { name: 'Redo', keys: [{ name: '⇧' }, { name: '⌘' }, { name: 'Z' }] },
        { name: 'Copy style', keys: [{ name: '⌥' }, { name: '⌘' }, { name: 'C' }] },
        { name: 'Paste style', keys: [{ name: '⌥' }, { name: '⌘' }, { name: 'V' }] },
        { name: 'Delete', keys: [{ name: '⌫' }] },
        { name: 'Select parent', keys: [{ name: 'Esc' }] },
      ],
    },
    {
      name: 'Component',
      shortcuts: [
        { name: 'Create component', keys: [{ name: '⌥' }, { name: '⌘' }, { name: 'K' }] },
        { name: 'Detach instance', keys: [{ name: '⌥' }, { name: '⌘' }, { name: 'B' }] },
      ],
    },
    {
      name: 'Publish',
      shortcuts: [
        { name: 'Save', keys: [{ name: '⌘' }, { name: 'S' }] },
        { name: 'Open preview', keys: [{ name: '⌘' }, { name: 'P' }] },
      ],
    },
  ],
  right: [
    {
      name: 'View',
      shortcuts: [
        { name: 'Collapse layers', keys: [{ name: '⌥' }, { name: 'L' }] },
        { name: 'Show/Hide element', keys: [{ name: '⇧' }, { name: '⌘' }, { name: 'H' }] },
        { name: 'Open add elements', keys: [{ name: 'A' }] },
      ],
    },
    {
      name: 'Zoom',
      shortcuts: [
        { name: 'Zoom in', keys: [{ name: '⌘' }, { name: '+' }] },
        { name: 'Zoom out', keys: [{ name: '⌘' }, { name: '-' }] },
        { name: 'Zoom to 100%', keys: [{ name: '⌘' }, { name: '0' }] },
        { name: 'Zoom to Fit', keys: [{ name: '⌘' }, { name: '1' }] },
        { name: 'Autofit', keys: [{ name: '⌘' }, { name: '2' }] },
      ],
    },
    {
      name: 'Other',
      shortcuts: [
        { name: 'Open keyboard shortcuts', keys: [{ name: '⇧' }, { name: '/' }] },
      ],
    },
  ],
};

function ShortcutCategory({ category }: { category: ShortcutCategory }) {
  return (
    <div>
      <div className="py-3 text-xs font-medium border-b border-border mb-3">
        {category.name}
      </div>
      <ul className="space-y-2">
        {category.shortcuts.map((shortcut) => (
          <li key={shortcut.name} className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{shortcut.name}</span>
            <div className="flex items-center gap-0.5">
              {shortcut.keys.map((key, index) => (
                <div
                  key={index}
                  className="px-1.5 py-0.5 leading-none rounded flex items-center justify-center bg-muted text-[10px] min-w-[18px]"
                >
                  {key.name}
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function KeyboardShortcutsDialog() {
  const isOpen = useEditorStore((state) => state.keyboardShortcutsOpen);
  const setKeyboardShortcutsOpen = useEditorStore((state) => state.setKeyboardShortcutsOpen);

  // Handle Shift+/ keyboard shortcut (Shift+/ produces '?' on most keyboards)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Shift + / (produces '?' character)
      // Also check e.code === 'Slash' for physical key detection
      if (e.shiftKey && (e.key === '?' || e.code === 'Slash')) {
        // Don't trigger if user is typing in an input field
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return;
        }
        e.preventDefault();
        setKeyboardShortcutsOpen(!isOpen);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, setKeyboardShortcutsOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={setKeyboardShortcutsOpen}>
      <DialogContent width="640px">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-8">
          {/* Left column */}
          <div className="space-y-6">
            {shortcutCategories.left.map((category) => (
              <ShortcutCategory key={category.name} category={category} />
            ))}
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {shortcutCategories.right.map((category) => (
              <ShortcutCategory key={category.name} category={category} />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
