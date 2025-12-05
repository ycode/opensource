import * as React from 'react'

import { cn } from '@/lib/utils'

interface InputProps extends Omit<React.ComponentProps<'input'>, 'size'> {
  size?: 'xs' | 'sm';
}

function Input({ className, type, size = 'xs', onKeyDown, value, onChange, ...props }: InputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const sizeClasses = {
    xs: 'h-8 text-xs px-2 py-1 rounded-lg',
    sm: 'h-10 text-sm px-3 py-1.5 rounded-xl',
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Only handle arrow keys for numeric inputs
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && value !== undefined) {
      const currentValue = typeof value === 'string' ? value : String(value || '');
      
      // Check if the value is a valid number
      const numValue = parseFloat(currentValue);
      if (!isNaN(numValue) && isFinite(numValue)) {
        e.preventDefault();
        
        const increment = e.shiftKey ? 10 : 1;
        const newValue = e.key === 'ArrowUp' 
          ? numValue + increment 
          : numValue - increment;
        
        // Create a synthetic event to trigger onChange
        if (inputRef.current && onChange) {
          const inputElement = inputRef.current;
          // Set the value on the input element
          inputElement.value = String(newValue);
          
          // Create event with the input element as both target and currentTarget
          const syntheticEvent = {
            target: inputElement,
            currentTarget: inputElement,
          } as unknown as React.ChangeEvent<HTMLInputElement>;
          
          onChange(syntheticEvent);
        }
        return;
      }
    }
    
    // Call original onKeyDown if provided
    onKeyDown?.(e);
  };

  return (
    <input
      ref={inputRef}
      type={type}
      data-slot="input"
      className={cn(
        'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground bg-input border-transparent w-full min-w-0 border transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:font-medium disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[0px]',
        '',
        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
        sizeClasses[size],
        className
      )}
      value={value}
      onChange={onChange}
      onKeyDown={handleKeyDown}
      {...props}
    />
  )
}

export { Input }
