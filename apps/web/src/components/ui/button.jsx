import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius)] text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-60 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:outline focus-visible:outline-[2px] focus-visible:outline-offset-2",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-sm hover:bg-[color-mix(in_oklab,_var(--primary)_85%,_black)] focus-visible:outline-ring",
        destructive:
          "bg-destructive text-white shadow-sm hover:bg-[color-mix(in_oklab,_var(--destructive)_85%,_black)] focus-visible:outline-[color:var(--error)]",
        outline:
          "border border-[var(--border)] bg-transparent text-foreground hover:bg-[rgba(255,255,255,0.04)] focus-visible:outline-ring",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-[color-mix(in_oklab,_var(--primary)_12%,_transparent)]",
        ghost:
          "hover:bg-[rgba(255,255,255,0.06)] hover:text-foreground",
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
