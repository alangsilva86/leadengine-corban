import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const statusToneVariants = {
  success:
    "border-[var(--tone-success-border)] bg-[var(--tone-success-surface)] text-[var(--tone-success-foreground)]",
  warning:
    "border-[var(--tone-warning-border)] bg-[var(--tone-warning-surface)] text-[var(--tone-warning-foreground)]",
  info:
    "border-[var(--tone-info-border)] bg-[var(--tone-info-surface)] text-[var(--tone-info-foreground)]",
  error:
    "border-[var(--tone-error-border)] bg-[var(--tone-error-surface)] text-[var(--tone-error-foreground)]",
}

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border border-transparent px-3 py-1 text-[0.7rem] font-medium tracking-wide w-fit whitespace-nowrap shrink-0 gap-1 [&>svg]:pointer-events-none [&>svg]:size-3 focus-visible:outline focus-visible:outline-[2px] focus-visible:outline-offset-2",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--color-surface-strong)] text-[var(--color-foreground)]",
        secondary:
          "bg-[var(--color-secondary)] text-[var(--color-secondary-foreground)]",
        destructive:
          "bg-[color-mix(in_oklab,_var(--color-error)_22%,_transparent)] text-[var(--color-error-soft-foreground)]",
        outline:
          "border-[var(--color-border)] text-[var(--color-foreground)]",
        success:
          "bg-[color-mix(in_oklab,_var(--color-success)_22%,_transparent)] text-[var(--color-success-soft-foreground)]",
        warning:
          "bg-[color-mix(in_oklab,_var(--color-warning)_22%,_transparent)] text-[var(--color-warning-soft-foreground)]",
        info:
          "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]",
        status:
          "border border-[var(--tone-neutral-border)] bg-[var(--tone-neutral-surface)] text-[var(--tone-neutral-foreground)]",
      },
      tone: {
        neutral: "",
        success: "",
        warning: "",
        info: "",
        error: "",
      },
    },
    compoundVariants: Object.entries(statusToneVariants).map(([tone, className]) => ({
      variant: "status",
      tone,
      class: className,
    })),
    defaultVariants: {
      variant: "default",
      tone: "neutral",
    },
  }
)

function Badge({
  className = '',
  variant = 'default',
  tone = 'neutral',
  asChild = false,
  ...props
}) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant, tone }), className)}
      {...props} />
  );
}

export { Badge, badgeVariants }
