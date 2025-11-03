'use client';

/**
 * Class Autocomplete Input
 * 
 * Enhanced input component with inline autocomplete suggestions for Tailwind classes
 * Features:
 * - Inline gray text suggestions
 * - Tab to accept
 * - Color preview swatches
 * - Arbitrary value hints
 */

// 1. React/Next.js
import { useState, useEffect, useRef, KeyboardEvent } from 'react';

// 3. ShadCN UI
import { Input } from '@/components/ui/input';

// 6. Utils
import {
  getBestSuggestion,
  getColorPreview,
  isArbitraryValuePrefix,
  getArbitraryExample,
} from '@/lib/tailwind-suggestions';

interface ClassAutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  onAccept: (value: string) => void;
  placeholder?: string;
}

export default function ClassAutocompleteInput({
  value,
  onChange,
  onAccept,
  placeholder = 'Type class and press Enter...',
}: ClassAutocompleteInputProps) {
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [showArbitraryHint, setShowArbitraryHint] = useState(false);
  const [arbitraryExample, setArbitraryExample] = useState<string | null>(null);
  const [colorPreview, setColorPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update suggestion when value changes
  useEffect(() => {
    if (!value) {
      setSuggestion(null);
      setShowArbitraryHint(false);
      setArbitraryExample(null);
      setColorPreview(null);
      return;
    }

    // Check if typing arbitrary value
    if (isArbitraryValuePrefix(value)) {
      setSuggestion(null);
      setShowArbitraryHint(true);
      setArbitraryExample(getArbitraryExample(value));
      setColorPreview(null);
    } else {
      setShowArbitraryHint(false);
      setArbitraryExample(null);
      
      // Get best suggestion
      const best = getBestSuggestion(value);
      setSuggestion(best);
      
      // Get color preview for suggestion
      if (best) {
        setColorPreview(getColorPreview(best));
      } else {
        setColorPreview(null);
      }
    }
  }, [value]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Tab or Right Arrow - Accept suggestion
    if ((e.key === 'Tab' || e.key === 'ArrowRight') && suggestion) {
      e.preventDefault();
      onChange(suggestion);
    }
    
    // Enter - Add class
    if (e.key === 'Enter' && value) {
      e.preventDefault();
      onAccept(value);
    }
    
    // Escape - Clear input
    if (e.key === 'Escape') {
      e.preventDefault();
      onChange('');
      inputRef.current?.blur();
    }
  };

  return (
    <div className="relative">
      {/* Actual input */}
      <Input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="relative z-10 bg-transparent"
        autoComplete="off"
        spellCheck={false}
      />

      {/* Inline suggestion overlay (gray text behind input) */}
      {suggestion && (
        <div className="absolute inset-0 flex items-center px-3 pointer-events-none z-0">
          <span className="invisible">{value}</span>
          <span className="text-zinc-600">
            {suggestion.slice(value.length)}
          </span>
        </div>
      )}

      {/* Color preview swatch */}
      {colorPreview && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20 pointer-events-none">
          <div
            className="w-4 h-4 rounded border border-zinc-700"
            style={{ backgroundColor: colorPreview }}
            title={colorPreview}
          />
        </div>
      )}

      {/* Arbitrary value hint tooltip */}
      {showArbitraryHint && arbitraryExample && (
        <div className="absolute top-full left-0 mt-1 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-400 whitespace-nowrap z-30">
          Arbitrary value - e.g., {arbitraryExample}
        </div>
      )}
    </div>
  );
}
