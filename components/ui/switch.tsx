'use client'

import * as React from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'

import { cn } from '@/lib/utils'

interface SwitchProps extends React.ComponentProps<typeof SwitchPrimitive.Root> {
  size?: 'sm' | 'md' | 'lg'
}

const switchSizes = {
  sm: {
    root: 'h-4 w-7',
    thumb: 'size-3 data-[state=checked]:translate-x-[0.75rem] data-[state=unchecked]:translate-x-0.5',
  },
  md: {
    root: 'h-[1.15rem] w-8',
    thumb: 'size-3.5 data-[state=checked]:translate-x-[calc(100%)] data-[state=unchecked]:translate-x-0.5',
  },
  lg: {
    root: 'h-6 w-10',
    thumb: 'size-5 data-[state=checked]:translate-x-[1.25rem] data-[state=unchecked]:translate-x-0.5',
  },
}

function Switch({
  className,
  size = 'md',
  ...props
}: SwitchProps) {
  const sizeClasses = switchSizes[size]

  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-input focus-visible:border-ring focus-visible:ring-ring/50 dark:data-[state=unchecked]:bg-secondary inline-flex shrink-0 items-center rounded-full border border-transparent transition-all outline-none focus-visible:ring-[3px] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50',
        sizeClasses.root,
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          'bg-background dark:data-[state=unchecked]:bg-foreground dark:data-[state=checked]:bg-primary-foreground pointer-events-none block rounded-full ring-0 transition-transform',
          sizeClasses.thumb
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
