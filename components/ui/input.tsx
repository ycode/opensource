import * as React from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface InputProps extends Omit<React.ComponentProps<'input'>, 'size'> {
  size?: 'xs' | 'sm';
  stepper?: boolean;
  onStepperChange?: (value: string) => void;
}

function Input({
  className,
  type,
  size = 'xs',
  onKeyDown,
  value,
  onChange,
  stepper = false,
  onStepperChange,
  min,
  max,
  step = '1',
  ...props
}: InputProps) {
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

  const handleIncrement = () => {
    const currentValue = Number(value) || 0;
    const stepValue = Number(step);
    const maxValue = max ? Number(max) : Infinity;
    const newValue = Math.min(currentValue + stepValue, maxValue);

    if (onStepperChange) {
      onStepperChange(String(newValue));
    } else if (onChange && inputRef.current) {
      const inputElement = inputRef.current;
      inputElement.value = String(newValue);
      const syntheticEvent = {
        target: inputElement,
        currentTarget: inputElement,
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      onChange(syntheticEvent);
    }
  };

  const handleDecrement = () => {
    const currentValue = Number(value) || 0;
    const stepValue = Number(step);
    const minValue = min ? Number(min) : -Infinity;
    const newValue = Math.max(currentValue - stepValue, minValue);

    if (onStepperChange) {
      onStepperChange(String(newValue));
    } else if (onChange && inputRef.current) {
      const inputElement = inputRef.current;
      inputElement.value = String(newValue);
      const syntheticEvent = {
        target: inputElement,
        currentTarget: inputElement,
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      onChange(syntheticEvent);
    }
  };

  if (stepper) {
    return (
      <div className="group relative w-full">
        <input
          ref={inputRef}
          type={type}
          data-slot="input"
          min={min}
          max={max}
          step={step}
          className={cn(
            'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground bg-input border-border w-full min-w-0 border transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:font-medium disabled:cursor-not-allowed disabled:opacity-50',
            'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[0px]',
            '',
            'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
            sizeClasses[size],
            stepper && 'pr-8',
            className
          )}
          value={value}
          onChange={onChange}
          onKeyDown={handleKeyDown}
          {...props}
        />
        <div className="absolute right-px top-px bottom-px items-center rounded-r-[10px] bg-gradient-to-l from-input backdrop-blur hidden group-hover:flex pr-1.5">
          <div className="flex flex-col">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleIncrement}
              className="size-2.5 h-3.5 w-4"
              tabIndex={-1}
            >
              <ChevronUp className="size-2.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleDecrement}
              className="size-2.5 h-3.5 w-4"
              tabIndex={-1}
            >
              <ChevronDown className="size-2.5" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

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
