import { forwardRef } from 'react';

import { cn } from '@/lib/utils.js';

const TONE_STYLES = {
  surface:
    'border border-[color:var(--surface-overlay-glass-border)] bg-[color:var(--surface-overlay-quiet)] text-[color:var(--foreground)] ring-1 ring-[color:var(--surface-overlay-glass-border)]',
  overlay:
    'border border-[color:var(--surface-overlay-glass-border)] bg-[color:var(--surface-overlay-strong)] text-[color:var(--foreground)] ring-1 ring-[color:var(--surface-overlay-glass-border)]',
  glass:
    'border border-[color:var(--surface-overlay-glass-border)] bg-[color:var(--surface-overlay-glass)] text-[color:var(--foreground)] ring-1 ring-[color:var(--surface-overlay-glass-border)]',
  inbox:
    'border border-[color:var(--color-inbox-border)] bg-[color:var(--color-inbox-surface-strong)] text-[color:var(--color-inbox-foreground)] ring-1 ring-[color:var(--color-inbox-border)]',
};

const RADIUS_STYLES = {
  none: 'rounded-none',
  sm: 'rounded-xl',
  md: 'rounded-2xl',
  lg: 'rounded-[24px]',
  xl: 'rounded-[28px]',
  '2xl': 'rounded-[32px]',
  full: 'rounded-full',
};

const SHADOW_STYLES = {
  none: '',
  xs: 'shadow-[var(--shadow-xs)]',
  sm: 'shadow-[var(--shadow-sm)]',
  md: 'shadow-[var(--shadow-md)]',
  lg: 'shadow-[var(--shadow-lg)]',
  xl: 'shadow-[var(--shadow-xl)]',
  '2xl': 'shadow-[0_32px_64px_color-mix(in_srgb,var(--color-border)_48%,transparent)]',
};

const resolveStyle = (map, value) => {
  if (!value) return '';
  if (typeof value === 'string' && map[value]) {
    return map[value];
  }
  return value;
};

export const GlassPanel = forwardRef(
  (
    { as: asElement = 'div', tone = 'surface', radius = 'lg', shadow = 'md', className, ...props },
    ref
  ) => {
    const Component = asElement;
    const toneClass = resolveStyle(TONE_STYLES, tone) || TONE_STYLES.surface;
    const radiusClass = resolveStyle(RADIUS_STYLES, radius) || RADIUS_STYLES.lg;
    const shadowClass = resolveStyle(SHADOW_STYLES, shadow) || SHADOW_STYLES.md;

    return (
      <Component
        ref={ref}
        className={cn(
          'backdrop-blur-xl transition-shadow duration-200 ease-out',
          toneClass,
          radiusClass,
          shadowClass,
          className
        )}
        {...props}
      />
    );
  }
);

GlassPanel.displayName = 'GlassPanel';

export default GlassPanel;
