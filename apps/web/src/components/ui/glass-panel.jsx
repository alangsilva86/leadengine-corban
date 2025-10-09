import { forwardRef } from 'react';

import { cn } from '@/lib/utils.js';

const TONE_STYLES = {
  surface: 'border border-white/12 bg-surface-shell ring-1 ring-white/10',
  overlay: 'border border-surface-contrast bg-slate-950/40 ring-1 ring-white/10',
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
  sm: 'shadow-[0_14px_30px_rgba(5,12,28,0.35)]',
  md: 'shadow-[0_18px_44px_rgba(3,9,24,0.45)]',
  lg: 'shadow-[0_20px_60px_rgba(15,23,42,0.35)]',
  xl: 'shadow-[0_28px_60px_-42px_rgba(15,23,42,0.9)]',
  '2xl': 'shadow-[0_32px_64px_-40px_rgba(15,23,42,0.95)]',
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
