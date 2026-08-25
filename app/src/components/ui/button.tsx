import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Design-system Button — aliases of the shadcn-style API mapped onto the
 * MediLink semantic tokens (globals.css layer 2/3). Kept for compatibility;
 * product surfaces use `ui.tsx` Button.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-action-primary disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-pine text-on-pine border border-pine hover:bg-pine-deep hover:border-pine-deep",
        destructive:
          "bg-alert-deep text-on-alert border border-alert-deep hover:bg-alert hover:border-alert",
        outline:
          "border border-line-strong bg-paper-raised text-ink hover:border-ink-faint hover:bg-paper-sunk",
        secondary:
          "bg-paper-sunk text-ink border border-line hover:border-line-strong",
        ghost: "bg-transparent text-ink-soft border border-transparent hover:text-ink hover:bg-paper-sunk",
        link: "text-action-link underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3",
        lg: "h-11 rounded-lg px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }
