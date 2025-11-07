import * as React from 'react'

import { cn } from '@/lib/utils'

interface InputProps extends Omit<React.ComponentProps<'input'>, 'size'> {
  size?: 'xs' | 'sm';
}

function Input({ className, type, size = 'xs', ...props }: InputProps) {
  const sizeClasses = {
    xs: 'h-8 text-xs px-2 py-1 rounded-lg',
    sm: 'h-10 text-sm px-3 py-1.5 rounded-xl',
  };

  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'file:text-foreground placeholder:text-current/25 selection:bg-primary selection:text-primary-foreground bg-input border-transparent w-full min-w-0 border transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[0px]',
        '',
        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
        sizeClasses[size],
        className
      )}
      {...props}
    />
  )
}

export { Input }
