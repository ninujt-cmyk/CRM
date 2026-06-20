import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-[11px] uppercase tracking-wider font-bold w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-all duration-300 overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-[1px]',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-indigo-500/10 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 [a&]:hover:bg-indigo-500/20 ring-1 ring-inset ring-indigo-500/20',
        secondary:
          'border-transparent bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 [a&]:hover:bg-slate-200 ring-1 ring-inset ring-slate-200 dark:ring-slate-700',
        destructive:
          'border-transparent bg-rose-500/10 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 [a&]:hover:bg-rose-500/20 ring-1 ring-inset ring-rose-500/20',
        outline:
          'text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'span'

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
