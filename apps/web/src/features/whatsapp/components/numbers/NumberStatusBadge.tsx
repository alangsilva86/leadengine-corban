import { Loader2 } from 'lucide-react';

import { TONE_DOT_CLASSES, TONE_SOFT_CLASSES } from '@/lib/tones';
import { cn } from '@/lib/utils.js';

import type { NumberStatus } from '../../lib/numberStatus';

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
    <span aria-hidden="true" className={cn('inline-block size-2 shrink-0 rounded-full', TONE_DOT_CLASSES[status.tone], className)} />
  );

const NumberStatusBadge = ({ status, className, variant = 'badge' }: NumberStatusBadgeProps) => (
  <span
    data-status={status.key}
    className={cn(
      'inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap text-xs font-medium',
      variant === 'badge' ? cn('rounded-full px-2 py-0.5', TONE_SOFT_CLASSES[status.tone]) : 'text-foreground',
      className,
    )}
  >
    <NumberStatusDot status={status} />
    {status.label}
  </span>
);

export default NumberStatusBadge;
