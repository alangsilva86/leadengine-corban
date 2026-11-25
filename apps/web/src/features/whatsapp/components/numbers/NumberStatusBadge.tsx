import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils.js';

import type { NumberStatus, NumberStatusTone } from '../../lib/numberStatus';

const TONE_CLASSES: Record<NumberStatusTone, { badge: string; dot: string }> = {
  success: { badge: 'bg-success-soft text-success-soft-foreground', dot: 'bg-success' },
  info: { badge: 'bg-info-soft text-info-soft-foreground', dot: 'bg-info' },
  warning: { badge: 'bg-warning-soft text-warning-soft-foreground', dot: 'bg-warning' },
  neutral: { badge: 'bg-surface-sunken text-muted-foreground', dot: 'bg-subtle-foreground' },
  danger: { badge: 'bg-danger-soft text-danger-soft-foreground', dot: 'bg-danger' },
};

interface NumberStatusBadgeProps {
  status: NumberStatus;
  className?: string;
  /** Só o ponto + texto, sem o fundo (para linhas densas). */
  variant?: 'badge' | 'inline';
}

/** Status de um número: sempre ponto (ou spinner) + texto, nunca só a cor. */
export const NumberStatusDot = ({ status, className }: { status: NumberStatus; className?: string }) =>
  status.isBusy ? (
    <Loader2 aria-hidden="true" className={cn('size-3 shrink-0 animate-spin text-info', className)} />
  ) : (
    <span aria-hidden="true" className={cn('inline-block size-2 shrink-0 rounded-full', TONE_CLASSES[status.tone].dot, className)} />
  );

const NumberStatusBadge = ({ status, className, variant = 'badge' }: NumberStatusBadgeProps) => (
  <span
    data-status={status.key}
    className={cn(
      'inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap text-xs font-medium',
      variant === 'badge' ? cn('rounded-full px-2 py-0.5', TONE_CLASSES[status.tone].badge) : 'text-foreground',
      className,
    )}
  >
    <NumberStatusDot status={status} />
    {status.label}
  </span>
);

export default NumberStatusBadge;
