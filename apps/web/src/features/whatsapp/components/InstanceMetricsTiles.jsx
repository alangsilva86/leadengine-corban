import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import { cn } from '@/lib/utils.js';

import { formatMetricValue } from '../lib/formatting';

const InstanceMetricsTiles = ({
  surfaceStyles,
  metrics,
  statusValues,
  statusCodeMeta,
  rateUsage,
  ratePercentage,
}) => {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2 text-center sm:grid-cols-3">
        <div className={cn('rounded-lg p-3', surfaceStyles.glassTile)}>
          <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Enviadas</p>
          <p className="mt-1 text-base font-semibold text-foreground">{formatMetricValue(metrics.sent)}</p>
        </div>
        <div className={cn('rounded-lg p-3', surfaceStyles.glassTile)}>
          <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Na fila</p>
          <p className="mt-1 text-base font-semibold text-foreground">{formatMetricValue(metrics.queued)}</p>
        </div>
        <div className={cn('rounded-lg p-3', surfaceStyles.glassTile)}>
          <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Falhas</p>
          <p className="mt-1 text-base font-semibold text-foreground">{formatMetricValue(metrics.failed)}</p>
        </div>
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-help rounded-lg p-3 text-center" style={{ gridColumn: 'span 3' }}>
            <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Códigos de Status</p>
            <div className="mt-2 flex items-center justify-around gap-2">
              {statusCodeMeta.map((meta) => (
                <div key={meta.code} className="text-center">
                  <p className="text-xs text-muted-foreground">{meta.label}</p>
                  <p className="text-sm font-semibold text-foreground">
                    {formatMetricValue(statusValues[meta.code])}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-1 text-xs">
            {statusCodeMeta.map((meta) => (
              <div key={meta.code}>
                <strong>Código {meta.label}:</strong> {meta.description}
              </div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>

      <div
        className={cn('rounded-lg p-3 text-left', surfaceStyles.glassTile)}
        title="Uso do limite de envio reportado pelo broker."
      >
        <div className="flex items-center justify-between text-[0.65rem] uppercase tracking-wide text-muted-foreground">
          <span>Utilização do limite</span>
          <span>{ratePercentage}%</span>
        </div>
        <div className={cn('mt-2 h-2 w-full overflow-hidden rounded-full', surfaceStyles.progressTrack)}>
          <div
            className={cn('h-full rounded-full transition-all', surfaceStyles.progressIndicator)}
            style={{ width: `${ratePercentage}%` }}
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>Usadas: {formatMetricValue(rateUsage.used)}</span>
          <span>Disponível: {formatMetricValue(rateUsage.remaining)}</span>
          <span>Limite: {formatMetricValue(rateUsage.limit)}</span>
        </div>
      </div>
    </div>
  );
};

export default InstanceMetricsTiles;
