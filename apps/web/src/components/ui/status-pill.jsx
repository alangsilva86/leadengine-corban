import { forwardRef } from 'react';

import { cva } from 'class-variance-authority';

import { cn } from '@/lib/utils.js';

const statusPillVariants = cva(
  'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_oklab,var(--color-ring)65%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-canvas)] disabled:pointer-events-none disabled:opacity-60',
  {
    variants: {
      tone: {
        neutral:
          'border-[color:color-mix(in_oklab,var(--color-border)62%,transparent)] bg-[color:color-mix(in_oklab,var(--color-surface-shell)92%,transparent)] text-[color:var(--color-muted-foreground)]',
        primary:
          'border-[color:color-mix(in_oklab,var(--color-primary)50%,transparent)] bg-[color:color-mix(in_oklab,var(--color-primary)22%,transparent)] text-[color:var(--color-primary-foreground)]',
        success:
          'border-[color:color-mix(in_oklab,var(--tone-success-border)100%,transparent)] bg-[color:var(--tone-success-surface)] text-[color:var(--tone-success-foreground)]',
        warning:
          'border-[color:color-mix(in_oklab,var(--tone-warning-border)100%,transparent)] bg-[color:var(--tone-warning-surface)] text-[color:var(--tone-warning-foreground)]',
        danger:
          'border-[color:color-mix(in_oklab,var(--tone-error-border)100%,transparent)] bg-[color:var(--tone-error-surface)] text-[color:var(--tone-error-foreground)]',
        whatsapp:
          'border-[color:var(--color-status-whatsapp-border)] bg-[color:var(--color-status-whatsapp-surface)] text-[color:var(--color-status-whatsapp-foreground)]',
      },
      size: {
        sm: 'px-2.5 py-1 text-[11px]',
        md: 'px-3 py-1.5 text-xs',
        lg: 'px-3.5 py-2 text-sm',
      },
      withDot: {
        true: 'pl-2.5',
      },
    },
    defaultVariants: {
      tone: 'neutral',
      size: 'md',
    },
    compoundVariants: [
      {
        withDot: true,
        className: 'gap-1.5',
      },
    ],
  },
);

const IndicatorDot = ({ tone }) => (
  <span
    aria-hidden
    className={cn(
      'inline-flex size-2 rounded-full shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-border)50%,transparent)]',
      {
        neutral: 'bg-[color:var(--color-muted-foreground)]',
        primary: 'bg-[color:var(--color-primary)]',
        success: 'bg-[color:var(--color-success)]',
        warning: 'bg-[color:var(--color-warning)]',
        danger: 'bg-[color:var(--color-destructive)]',
        whatsapp: 'bg-[color:var(--color-status-whatsapp)]',
      }[tone] ?? 'bg-[color:var(--color-muted-foreground)]',
    )}
  />
);

export const StatusPill = forwardRef(
  ({ tone, size, className, withDot = false, children, ...props }, ref) => (
    <span ref={ref} className={cn(statusPillVariants({ tone, size, withDot, className }))} {...props}>
      {withDot ? <IndicatorDot tone={tone} /> : null}
      {children}
    </span>
  ),
);

StatusPill.displayName = 'StatusPill';

export { statusPillVariants };

export default StatusPill;
