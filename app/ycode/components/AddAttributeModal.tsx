'use client';

/**
 * Add Attribute Modal
 * 
 * Modal dialog for adding custom HTML attributes to elements
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';

interface AddAttributeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (name: string, value: string) => void;
}

export default function AddAttributeModal({
  isOpen,
  onClose,
  onAdd,
}: AddAttributeModalProps) {
  const [name, setName] = useState('');
  const [value, setValue] = useState('');

  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd(name.trim(), value.trim());
    setName('');
    setValue('');
    onClose();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAdd();
    }
  };

  // Handle name change - convert spaces to hyphens
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.replace(/\s+/g, '-');
    setName(newValue);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] bg-zinc-800 rounded-lg z-50 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-white font-medium">New attribute</h3>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <Icon name="x" className="size-4" />
          </button>
        </div>

        <div className="space-y-4">
          <Input
            type="text"
            value={name}
            onChange={handleNameChange}
            onKeyPress={handleKeyPress}
            placeholder="Name"
            className="w-full"
            autoFocus
          />
          <Input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Value"
            className="w-full"
          />
          <Button
            onClick={handleAdd}
            className="w-full"
            disabled={!name.trim()}
          >
            Add
          </Button>
        </div>
      </div>
    </>
  );
}
