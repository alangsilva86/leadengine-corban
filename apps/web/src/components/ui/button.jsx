import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,background-color,border-color,box-shadow] outline-none disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  {
    variants: {
      variant: {
        // Ação principal: no máximo uma por área.
        default:
          "bg-primary text-primary-foreground shadow-xs hover:bg-primary-hover disabled:bg-surface-sunken disabled:text-subtle-foreground disabled:shadow-none",
        destructive:
          "bg-danger text-danger-foreground shadow-xs hover:bg-[color-mix(in_oklab,var(--color-danger)_88%,black)] disabled:bg-surface-sunken disabled:text-subtle-foreground disabled:shadow-none",
        // Ação secundária: superfície + borda.
        outline:
          "border border-border-strong bg-surface text-foreground shadow-xs hover:bg-surface-hover disabled:text-subtle-foreground disabled:shadow-none",
        secondary:
          "bg-surface-sunken text-foreground hover:bg-surface-hover disabled:text-subtle-foreground",
        // Ação de apoio tingida pela marca (ex.: "Sugerir resposta").
        soft:
          "bg-primary-soft text-primary-soft-foreground hover:bg-[color-mix(in_oklab,var(--color-primary)_16%,var(--color-surface))] disabled:bg-surface-sunken disabled:text-subtle-foreground",
        ghost:
          "text-foreground hover:bg-surface-hover disabled:text-subtle-foreground",
        // Mantido por compatibilidade; equivale a ghost com texto secundário.
        toolbar:
          "text-muted-foreground hover:bg-surface-hover hover:text-foreground disabled:opacity-50",
        link: "h-auto px-0 text-primary underline-offset-4 hover:underline disabled:text-subtle-foreground",
      },
      size: {
        xs: "h-7 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5",
        sm: "h-8 gap-1.5 px-3 has-[>svg]:px-2.5",
        default: "h-9 px-4 has-[>svg]:px-3",
        lg: "h-10 px-5 has-[>svg]:px-4",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-xs": "size-7",
        toolbar: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props} />
  );
}

export { Button, buttonVariants }
