import { useMemo } from 'react';

import { cn } from '@/lib/utils.js';

const TONE_ALIASES = {
  neutral: 'neutral',
  default: 'neutral',
  muted: 'neutral',
  info: 'info',
  informative: 'info',
  pending: 'info',
  success: 'success',
  ok: 'success',
  positive: 'success',
  good: 'success',
  warning: 'warning',
  attention: 'warning',
  caution: 'warning',
  error: 'error',
  danger: 'error',
  negative: 'error',
  critical: 'error',
  expired: 'error',
};

const SIZE_CLASS_MAP = {
  xs: 'px-2 py-0.5 text-[0.65rem]',
  sm: 'px-2.5 py-1 text-[11px]',
  md: 'px-3 py-1.5 text-sm',
};

const WEIGHT_CLASS_MAP = {
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
};

const TEXT_TONE_CLASS_MAP = {
  neutral: 'text-[color:var(--color-inbox-foreground-muted)]',
  info: 'text-[var(--tone-info-foreground)]',
  success: 'text-[var(--tone-success-foreground)]',
  warning: 'text-[var(--tone-warning-foreground)]',
  error: 'text-[var(--tone-error-foreground)]',
};

const normalizeTone = (tone) => {
  if (typeof tone !== 'string') {
    return 'neutral';
  }
  const key = tone.trim().toLowerCase();
  return TONE_ALIASES[key] ?? key ?? 'neutral';
};

const useStatusToneClasses = (tone, options = {}) => {
  const { size = 'sm', uppercase = false, weight = 'medium', className } = options;

  return useMemo(() => {
    const badgeTone = normalizeTone(tone);
    const sizeClass = SIZE_CLASS_MAP[size] ?? SIZE_CLASS_MAP.sm;
    const weightClass = WEIGHT_CLASS_MAP[weight] ?? WEIGHT_CLASS_MAP.medium;
    const textClassName = TEXT_TONE_CLASS_MAP[badgeTone] ?? TEXT_TONE_CLASS_MAP.neutral;
    const badgeClassName = cn(
      sizeClass,
      weightClass,
      uppercase ? 'uppercase tracking-[0.18em]' : '',
      className
    );

    return {
      badgeTone,
      badgeClassName,
      textClassName,
    };
  }, [tone, size, uppercase, weight, className]);
};

export default useStatusToneClasses;
