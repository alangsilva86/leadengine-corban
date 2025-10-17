import { forwardRef } from 'react';

import { cn } from '@/lib/utils.js';

const TONE_STYLES = {
  quiet: 'bg-[color:var(--surface-overlay-inbox-quiet)]',
  bold: 'bg-[color:var(--surface-overlay-inbox-bold)]',
  surface: 'bg-[var(--color-inbox-surface)]',
  strong: 'bg-[var(--color-inbox-surface-strong)]',
};

const RADIUS_STYLES = {
  none: 'rounded-none',
  sm: 'rounded-xl',
  md: 'rounded-2xl',
  lg: 'rounded-3xl',
  xl: 'rounded-[32px]',
  '24': 'rounded-[24px]',
  token: 'rounded-[var(--radius)]',
  pill: 'rounded-full',
  default: 'rounded-3xl',
};

const PADDING_STYLES = {
  none: '',
  xs: 'p-2',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5',
  xl: 'p-6',
  '2xl': 'p-10',
};

const SHADOW_STYLES = {
  none: 'shadow-none',
  xs: 'shadow-[var(--shadow-xs)]',
  sm: 'shadow-[var(--shadow-sm)]',
  md: 'shadow-[var(--shadow-md)]',
  lg: 'shadow-[var(--shadow-lg)]',
  xl: 'shadow-[var(--shadow-xl)]',
  base: 'shadow-[var(--shadow)]',
};

const InboxSurface = forwardRef(
  (
    {
      as: Component = 'div',
      tone = 'quiet',
      radius = 'default',
      padding = 'none',
      shadow = 'xl',
      border = true,
      className,
      ...props
    },
    ref
  ) => {
    const toneClass = TONE_STYLES[tone] ?? tone ?? TONE_STYLES.quiet;
    const radiusClass = RADIUS_STYLES[radius] ?? radius ?? RADIUS_STYLES.default;
    const paddingClass = PADDING_STYLES[padding] ?? padding ?? '';
    const shadowClass = SHADOW_STYLES[shadow] ?? shadow ?? SHADOW_STYLES.xl;

    return (
      <Component
        ref={ref}
        className={cn(
          'text-[color:var(--color-inbox-foreground)]',
          border && 'border border-[color:var(--color-inbox-border)]',
          toneClass,
          radiusClass,
          paddingClass,
          shadowClass,
          className
        )}
        {...props}
      />
    );
  }
);

InboxSurface.displayName = 'InboxSurface';

export { InboxSurface };
export const inboxSurfaceClasses = ({
  tone = 'quiet',
  radius = 'default',
  padding = 'none',
  shadow = 'xl',
  border = true,
  className,
} = {}) => {
  const toneClass = TONE_STYLES[tone] ?? tone ?? TONE_STYLES.quiet;
  const radiusClass = RADIUS_STYLES[radius] ?? radius ?? RADIUS_STYLES.default;
  const paddingClass = PADDING_STYLES[padding] ?? padding ?? '';
  const shadowClass = SHADOW_STYLES[shadow] ?? shadow ?? SHADOW_STYLES.xl;

  return cn(
    'text-[color:var(--color-inbox-foreground)]',
    border && 'border border-[color:var(--color-inbox-border)]',
    toneClass,
    radiusClass,
    paddingClass,
    shadowClass,
    className
  );
};
