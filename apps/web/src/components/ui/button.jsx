import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius)] text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-60 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--ring)_75%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:color-mix(in_srgb,var(--bg)_92%,transparent)]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-sm hover:bg-[color-mix(in_oklab,_var(--primary)_85%,_black)]",
        destructive:
          "bg-destructive text-white shadow-sm hover:bg-[color-mix(in_oklab,_var(--destructive)_85%,_black)]",
        outline:
          "border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_65%,transparent)] text-[color:color-mix(in_srgb,var(--text)_92%,transparent)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--border)_55%,transparent)] hover:bg-[color-mix(in_srgb,var(--surface)_85%,transparent)]",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-[color-mix(in_oklab,_var(--primary)_12%,_transparent)]",
        ghost:
          "hover:bg-[color-mix(in_oklab,_var(--surface)_18%,_transparent)] hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-[42px] px-4 py-2 has-[>svg]:px-3",
        sm: "min-h-[38px] gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "min-h-[46px] px-6 has-[>svg]:px-4",
        icon: "size-10",
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
