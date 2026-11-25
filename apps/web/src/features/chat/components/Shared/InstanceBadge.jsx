import { forwardRef, memo, useMemo } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import { cn } from '@/lib/utils.js';
import useInstancePresentation from '../../hooks/useInstancePresentation.js';
import { toSentenceCase } from '../ConversationArea/utils/presentation.js';

/**
 * Número de WhatsApp (instância) por onde a conversa passa.
 * Texto neutro (contraste garantido) + ponto na cor do número.
 */
const InstanceChip = memo(
  forwardRef(function InstanceChip({ label, color, withDot = true, className, variant = 'chip' }, ref) {
    const dotStyle = useMemo(() => (color ? { backgroundColor: color } : undefined), [color]);

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted-foreground',
          variant === 'chip' && 'rounded-md border border-border bg-surface-sunken px-1.5 py-0.5',
          className,
        )}
      >
        {withDot ? (
          <span
            className={cn('size-1.5 shrink-0 rounded-full', !color && 'bg-subtle-foreground')}
            style={dotStyle}
            aria-hidden
          />
        ) : null}
        <span className="truncate">{label}</span>
      </span>
    );
  }),
);

export const InstanceBadge = memo(function InstanceBadge({
  instanceId,
  withTooltip = true,
  withDot = true,
  fallbackLabel = 'Número não identificado',
  variant = 'chip',
  className,
}) {
  const presentation = useInstancePresentation(instanceId);
  const label = toSentenceCase(presentation.label ?? fallbackLabel);
  const tooltip = presentation.phone ?? presentation.number ?? null;
  const chip = (
    <InstanceChip
      label={label}
      color={presentation.known ? presentation.color : null}
      withDot={withDot}
      variant={variant}
      className={className}
    />
  );

  if (!withTooltip || !tooltip) {
    return chip;
  }

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>{chip}</TooltipTrigger>
      <TooltipContent className="text-xs">
        <div className="flex flex-col">
          <span className="font-semibold">{label}</span>
          <span>{tooltip}</span>
        </div>
      </TooltipContent>
    </Tooltip>
  );
});

export default InstanceBadge;
