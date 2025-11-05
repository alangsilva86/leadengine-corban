import { forwardRef, memo, useMemo } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import { cn } from '@/lib/utils.js';
import useInstancePresentation from '../../hooks/useInstancePresentation.js';

const DEFAULT_COLOR = '#94A3B8';

const InstanceChip = memo(
  forwardRef(function InstanceChip({ label, color, withDot = true, className }, ref) {
    const dotStyle = useMemo(() => ({ backgroundColor: color ?? DEFAULT_COLOR }), [color]);
    const textStyle = useMemo(() => ({ color: color ?? DEFAULT_COLOR }), [color]);
    const backgroundStyle = useMemo(() => {
      const resolved = color ?? DEFAULT_COLOR;
      return {
        backgroundColor: `${resolved}1A`,
        borderColor: `${resolved}33`,
      };
    }, [color]);

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
          className
        )}
        style={backgroundStyle}
      >
        {withDot ? <span className="h-1.5 w-1.5 rounded-full" style={dotStyle} /> : null}
        <span style={textStyle}>{label}</span>
      </span>
    );
  })
);

export const InstanceBadge = memo(function InstanceBadge({
  instanceId,
  withTooltip = true,
  withDot = true,
  fallbackLabel = 'Instância desconhecida',
  className,
}) {
  const presentation = useInstancePresentation(instanceId);
  const label = presentation.label ?? fallbackLabel;
  const tooltip = presentation.phone ?? presentation.number ?? null;
  const chip = (
    <InstanceChip label={label} color={presentation.color} withDot={withDot} className={className} />
  );

  if (!withTooltip || !tooltip) {
    return chip;
  }

  return (
    <Tooltip delayDuration={120}>
      <TooltipTrigger asChild>{chip}</TooltipTrigger>
      <TooltipContent className="text-xs">
        <div className="flex flex-col">
          <span className="font-semibold">{label}</span>
          <span className="text-foreground-muted">{tooltip}</span>
        </div>
      </TooltipContent>
    </Tooltip>
  );
});

export default InstanceBadge;
