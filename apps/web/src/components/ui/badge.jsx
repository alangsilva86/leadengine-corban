import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border border-transparent px-3 py-1 text-[0.7rem] font-medium tracking-wide w-fit whitespace-nowrap shrink-0 gap-1 [&>svg]:pointer-events-none [&>svg]:size-3 focus-visible:outline focus-visible:outline-[2px] focus-visible:outline-offset-2",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--surface-strong)] text-[var(--text)]",
        secondary:
          "bg-[rgba(99,102,241,0.14)] text-[var(--primary-foreground)]",
        destructive:
          "bg-[color-mix(in_oklab,_var(--error)_22%,_transparent)] text-[#fecaca]",
        outline:
          "border-[var(--border)] text-[var(--text)]",
        success:
          "bg-[color-mix(in_oklab,_var(--success)_22%,_transparent)] text-[#bbf7d0]",
        warning:
          "bg-[color-mix(in_oklab,_var(--warning)_22%,_transparent)] text-[#fde68a]",
        info:
          "bg-[rgba(148,163,184,0.16)] text-[var(--text-muted)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props} />
  );
}

export { Badge, badgeVariants }
