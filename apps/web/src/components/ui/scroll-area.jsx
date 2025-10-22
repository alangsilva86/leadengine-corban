"use client"

import * as React from 'react';
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';

import { cn } from '@/lib/utils';

const DEFAULT_VIEWPORT_CLASSES =
  'chat-scroll-area block size-full w-full min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:outline-1 focus-visible:ring-[3px] focus-visible:ring-ring/50 [scrollbar-gutter:stable_both-edges]';

const ScrollArea = React.forwardRef(function ScrollArea(
  {
    className,
    viewportClassName,
    viewportRef,
    viewportProps = {},
    children,
    ...props
  },
  ref
) {
  const {
    className: viewportClassNameProp,
    style: viewportStyleProp,
    ...restViewportProps
  } = viewportProps;

  const viewportStyle = {
    overscrollBehavior: 'contain',
    ...viewportStyleProp,
  };

  return (
    <ScrollAreaPrimitive.Root
      ref={ref}
      data-slot="scroll-area"
      className={cn('relative min-w-0', className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        ref={viewportRef}
        data-slot="scroll-area-viewport"
        className={cn(DEFAULT_VIEWPORT_CLASSES, viewportClassName, viewportClassNameProp)}
        style={viewportStyle}
        {...restViewportProps}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar orientation="vertical" />
      <ScrollAreaPrimitive.Corner data-slot="scroll-area-corner" />
    </ScrollAreaPrimitive.Root>
  );
});

function ScrollBar({ className, orientation = 'vertical', ...props }) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn(
        'flex select-none touch-none p-px transition-colors',
        orientation === 'vertical' && 'h-full w-2.5 border-l border-l-transparent',
        orientation === 'horizontal' && 'h-2.5 flex-col border-t border-t-transparent',
        className
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        data-slot="scroll-area-thumb"
        className="relative flex-1 rounded-full bg-[color:var(--color-inbox-scrollbar-thumb,#94a3b8)]"
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  );
}

export { ScrollArea, ScrollBar };
