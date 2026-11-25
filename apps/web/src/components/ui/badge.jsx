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
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full border border-transparent px-2 py-0.5 text-xs font-medium [&>svg]:pointer-events-none [&>svg]:size-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
  {
    variants: {
      variant: {
        default: "bg-surface-sunken text-foreground",
        secondary: "bg-surface-sunken text-muted-foreground",
        destructive: "bg-danger-soft text-danger-soft-foreground",
        outline: "border-border text-foreground",
        success: "bg-success-soft text-success-soft-foreground",
        warning: "bg-warning-soft text-warning-soft-foreground",
        info: "bg-info-soft text-info-soft-foreground",
        primary: "bg-primary-soft text-primary-soft-foreground",
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
