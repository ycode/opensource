'use client'

import * as React from 'react'
import * as LabelPrimitive from '@radix-ui/react-label'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const labelVariants = cva(
  'flex items-center gap-2 leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
  {
    variants: {
      variant: {
        default: '',
        muted: 'text-muted-foreground',
      },
      size: {
        xs: 'text-xs',
        sm: 'text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'xs',
    },
  }
)

function Label({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root> &
  VariantProps<typeof labelVariants>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(labelVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Label, labelVariants }
