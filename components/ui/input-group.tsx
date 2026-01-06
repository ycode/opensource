'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ChevronDown, ChevronUp } from 'lucide-react';

const InputGroupContext = React.createContext<{ size: 'xs' | 'sm' }>({ size: 'xs' });

interface InputGroupProps extends React.ComponentProps<'div'> {
  size?: 'xs' | 'sm';
}

function InputGroup({ className, size = 'xs', ...props }: InputGroupProps) {
  const sizeClasses = {
    xs: 'h-8 rounded-lg',
    sm: 'h-10 rounded-xl',
  };

  return (
    <InputGroupContext.Provider value={{ size }}>
      <div
        data-slot="input-group"
        role="group"
        className={cn(
          'group/input-group group border-transparent bg-input relative flex w-full items-center border transition-[color,box-shadow] outline-none',
          'min-w-0 has-[>textarea]:h-auto',

          // Variants based on alignment.
          'has-[>[data-align=inline-start]]:[&>input]:pl-2',
          'has-[>[data-align=inline-end]]:[&>input]:pr-2',
          'has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>[data-align=block-start]]:[&>input]:pb-3',
          'has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-end]]:[&>input]:pt-3',

          // Focus state.
          'has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50 has-[[data-slot=input-group-control]:focus-visible]:ring-[0px]',

          // Error state.
          'has-[[data-slot][aria-invalid=true]]:ring-destructive/20 has-[[data-slot][aria-invalid=true]]:border-destructive dark:has-[[data-slot][aria-invalid=true]]:ring-destructive/40',

          sizeClasses[size],
          className
        )}
        {...props}
      />
    </InputGroupContext.Provider>
  )
}

const inputGroupAddonVariants = cva(
  "text-muted-foreground flex h-auto cursor-text items-center justify-center gap-2 py-1.5 text-sm font-medium select-none [&>svg:not([class*='size-'])]:size-4 [&>kbd]:rounded-[calc(var(--radius)-5px)] group-data-[disabled=true]/input-group:opacity-50",
  {
    variants: {
      align: {
        'inline-start':
          'order-first pl-2.5 has-[>button]:ml-[-0.45rem] has-[>kbd]:ml-[-0.35rem]',
        'inline-end':
          'order-last pr-2.5 has-[>button]:mr-[-0.45rem] has-[>kbd]:mr-[-0.35rem]',
        'block-start':
          'order-first w-full justify-start px-3 pt-3 [.border-b]:pb-3 group-has-[>input]/input-group:pt-2.5',
        'block-end':
          'order-last w-full justify-start px-3 pb-3 [.border-t]:pt-3 group-has-[>input]/input-group:pb-2.5',
      },
    },
    defaultVariants: {
      align: 'inline-start',
    },
  }
)

function InputGroupAddon({
  className,
  align = 'inline-start',
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof inputGroupAddonVariants>) {
  return (
    <div
      role="group"
      data-slot="input-group-addon"
      data-align={align}
      className={cn(inputGroupAddonVariants({ align }), className)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button')) {
          return
        }
        e.currentTarget.parentElement?.querySelector('input')?.focus()
      }}
      {...props}
    />
  )
}

const inputGroupButtonVariants = cva(
  'text-sm shadow-none flex gap-2 items-center',
  {
    variants: {
      size: {
        xs: "h-6 gap-1 px-2 rounded-[calc(var(--radius)-5px)] [&>svg:not([class*='size-'])]:size-3.5 has-[>svg]:px-2",
        sm: 'h-8 px-2.5 gap-1.5 rounded-md has-[>svg]:px-2.5',
        'icon-xs':
          'size-6 rounded-[calc(var(--radius)-5px)] p-0 has-[>svg]:p-0',
        'icon-sm': 'size-8 p-0 has-[>svg]:p-0',
      },
    },
    defaultVariants: {
      size: 'xs',
    },
  }
)

function InputGroupButton({
  className,
  type = 'button',
  variant = 'ghost',
  size = 'xs',
  ...props
}: Omit<React.ComponentProps<typeof Button>, 'size'> &
  VariantProps<typeof inputGroupButtonVariants>) {
  return (
    <Button
      type={type}
      data-size={size}
      variant={variant}
      className={cn(inputGroupButtonVariants({ size }), className)}
      {...props}
    />
  )
}

function InputGroupText({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      className={cn(
        "text-muted-foreground flex items-center gap-2 text-sm [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

interface InputGroupInputProps extends React.ComponentProps<typeof Input> {
  stepper?: boolean;
  onStepperChange?: (value: string) => void;
}

function InputGroupInput({
  className,
  size: sizeProp,
  stepper = false,
  onStepperChange,
  value,
  min,
  max,
  step = '1',
  onChange,
  ...props
}: InputGroupInputProps) {
  const context = React.useContext(InputGroupContext);
  const size = sizeProp ?? context.size;

  const handleIncrement = () => {
    const currentValue = Number(value) || 0;
    const stepValue = Number(step);
    const maxValue = max ? Number(max) : Infinity;
    const newValue = Math.min(currentValue + stepValue, maxValue);

    if (onStepperChange) {
      onStepperChange(String(newValue));
    } else if (onChange) {
      onChange({ target: { value: String(newValue) } } as React.ChangeEvent<HTMLInputElement>);
    }
  };

  const handleDecrement = () => {
    const currentValue = Number(value) || 0;
    const stepValue = Number(step);
    const minValue = min ? Number(min) : -Infinity;
    const newValue = Math.max(currentValue - stepValue, minValue);

    if (onStepperChange) {
      onStepperChange(String(newValue));
    } else if (onChange) {
      onChange({ target: { value: String(newValue) } } as React.ChangeEvent<HTMLInputElement>);
    }
  };

  return (
    <>
      <Input
        data-slot="input-group-control"
        size={size}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={onChange}
        className={cn(
          'flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-input/0',
          stepper && !props.disabled && 'pr-0',
          className
        )}
        {...props}
      />
      {stepper && !props.disabled && (
        <InputGroupAddon align="inline-end" className="p-0 px-1.5 hidden group-hover:flex absolute right-0 top-0 bg-gradient-to-l from-input backdrop-blur h-full items-center rounded-r-[10px]">
          <div className="flex flex-col">
            <InputGroupButton
              size="icon-xs"
              variant="ghost"
              onClick={handleIncrement}
              className="size-2.5"
              tabIndex={-1}
            >
              <ChevronUp />
            </InputGroupButton>
            <InputGroupButton
              size="icon-xs"
              variant="ghost"
              onClick={handleDecrement}
              className="size-2.5"
              tabIndex={-1}
            >
              <ChevronDown />
            </InputGroupButton>
          </div>
        </InputGroupAddon>
      )}
    </>
  )
}

function InputGroupTextarea({
  className,
  ...props
}: React.ComponentProps<'textarea'>) {
  return (
    <Textarea
      data-slot="input-group-control"
      className={cn(
        'flex-1 resize-none rounded-none border-0 bg-transparent py-3 shadow-none focus-visible:ring-0 dark:bg-transparent',
        className
      )}
      {...props}
    />
  )
}

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
}
