import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"
import { ptBR } from "date-fns/locale"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

/**
 * Calendário (react-day-picker v9) em pt-BR, semana começando na segunda.
 * Classes seguem as chaves da v9 (weekdays/weekday/day/day_button/selected/today/outside…).
 */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  locale = ptBR,
  weekStartsOn = 1,
  components,
  ...props
}) {
  return (
    <DayPicker
      locale={locale}
      weekStartsOn={weekStartsOn}
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        root: "w-fit",
        months: "relative flex flex-col gap-4 sm:flex-row",
        month: "flex w-full flex-col gap-3",
        nav: "absolute inset-x-0 top-0 flex h-8 items-center justify-between",
        button_previous: cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          "text-muted-foreground aria-disabled:opacity-40"
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          "text-muted-foreground aria-disabled:opacity-40"
        ),
        month_caption: "flex h-8 items-center justify-center px-10",
        caption_label: "text-sm font-medium capitalize text-foreground",
        dropdowns: "flex items-center gap-1 text-sm font-medium",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "w-9 select-none text-center text-xs font-normal capitalize text-muted-foreground",
        week: "mt-1 flex w-full",
        week_number_header: "w-9 select-none text-xs text-muted-foreground",
        week_number: "w-9 select-none text-center text-xs text-muted-foreground",
        day: cn(
          "group/day relative size-9 p-0 text-center text-sm focus-within:relative focus-within:z-20",
          props.mode === "range"
            ? "[&:first-child[data-selected=true]_button]:rounded-l-md [&:last-child[data-selected=true]_button]:rounded-r-md"
            : ""
        ),
        day_button: cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "size-9 rounded-md font-normal tabular-nums text-foreground aria-selected:opacity-100"
        ),
        range_start: "rounded-l-md bg-primary-soft [&>button]:bg-primary [&>button]:text-primary-foreground",
        range_middle: "bg-primary-soft [&>button]:rounded-none [&>button]:bg-transparent [&>button]:text-primary-soft-foreground",
        range_end: "rounded-r-md bg-primary-soft [&>button]:bg-primary [&>button]:text-primary-foreground",
        selected:
          "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button:hover]:bg-primary-hover [&>button:hover]:text-primary-foreground",
        today: "[&>button]:font-semibold [&>button]:text-primary [&>button]:ring-1 [&>button]:ring-inset [&>button]:ring-primary/40",
        outside: "[&>button]:text-subtle-foreground",
        disabled: "[&>button]:text-subtle-foreground [&>button]:opacity-50",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chevronClassName, ...chevronProps }) =>
          orientation === "left" ? (
            <ChevronLeft className={cn("size-4", chevronClassName)} {...chevronProps} />
          ) : (
            <ChevronRight className={cn("size-4", chevronClassName)} {...chevronProps} />
          ),
        ...components,
      }}
      {...props} />
  );
}

export { Calendar }
