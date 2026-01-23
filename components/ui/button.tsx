import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: 'bg-blue-500 text-white hover:bg-blue-500/90',
        destructive: 'bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
        outline: 'border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50',
        secondary: 'bg-secondary text-muted-foreground hover:bg-secondary/70 backdrop-blur',
        purple: 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30',
        ghost: 'hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 text-muted-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        input: 'bg-input hover:bg-input/60 text-muted-foreground',
        white: 'bg-white text-neutral-900',
        overlay: 'bg-white/90 text-neutral-800 hover:bg-white dark:bg-neutral-800/90 dark:text-white dark:hover:bg-neutral-800',
        inline_variable_canvas: 'bg-white/5 text-white hover:bg-white/15',
        variable: 'text-muted-foreground hover:text-[#8a6df1]',
      },
      size: {
        default: 'text-sm h-9 px-4 rounded-xl py-2 has-[>svg]:px-3',
        lg: 'text-sm h-10 rounded-md px-6 has-[>svg]:px-4',
        sm: 'text-xs h-8 rounded-lg gap-1.5 px-2.5 has-[>svg]:px-2.5 [&>svg]:!size-3',
        xs: 'text-xs h-6 rounded-md gap-1.5 px-2 has-[>svg]:px-1.5 [&>svg]:!size-3',
        icon: 'size-9',
        'icon-sm': 'size-8',
        'icon-lg': 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'sm',
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
