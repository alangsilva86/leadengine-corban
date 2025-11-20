import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import { cn } from '@/lib/utils.js';
import { formatMetricValue } from '../lib/formatting';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible.jsx';
import { ChevronDown } from 'lucide-react';

import InstanceActionsMenu from './InstanceActionsMenu.jsx';

const CONNECTION_STATUS_MAP = {
  success: 'connected',
  info: 'attention',
  warning: 'attention',
  destructive: 'attention',
  secondary: 'disconnected',
  default: 'disconnected',
};

const STATUS_LABEL_MAP = {
  connected: 'Conectado',
  attention: 'Atenção',
  disconnected: 'Desconectado',
};

const STATUS_CHIP_STYLES = {
  connected: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/40',
  attention: 'bg-amber-500/10 text-amber-300 border border-amber-500/40',
  disconnected: 'bg-rose-500/10 text-rose-300 border border-rose-500/40',
};

const DEFAULT_STATUS_CODES = ['1', '2', '3', '4', '5'];

const computeConnectionState = (statusInfo) => {
  if (!statusInfo) {
    return 'disconnected';
  }

  return CONNECTION_STATUS_MAP[statusInfo.variant] ?? CONNECTION_STATUS_MAP.default;
};

const computeLoadLevel = (metrics = {}, ratePercentage = 0) => {
  const queued = Number(metrics.queued ?? 0);
  const sent = Number(metrics.sent ?? 0);
  const failed = Number(metrics.failed ?? 0);
  const usage = Number(ratePercentage ?? 0);

  if (queued > 50 || failed > 10 || usage >= 90) {
    return 'alta';
  }

  if (queued > 10 || failed > 0 || usage >= 75) {
    return 'média';
  }

  if (sent === 0 && queued === 0 && failed === 0) {
    return 'baixa';
  }

  return 'baixa';
};

const mapStatusCodes = (statusValues = {}, statusCodeMeta = []) => {
  const knownCodes = statusCodeMeta.length
    ? statusCodeMeta.map((item) => `${item.code}`)
    : DEFAULT_STATUS_CODES;

  return knownCodes.map((code) => {
    const meta = statusCodeMeta.find((item) => `${item.code}` === `${code}`) ?? null;
    const count = Number(statusValues?.[code] ?? statusValues?.[Number(code)] ?? 0);
    return {
      code: `${code}`,
      label: meta?.label ?? code,
      description: meta?.description ?? 'Sem descrição',
      count,
    };
  });
};

const InstanceSummaryCard = ({
  viewModel,
  statusCodeMeta,
  isBusy,
  isAuthenticated,
  deletingInstanceId,
  onSelectInstance,
  onViewQr,
  onRequestDelete,
  onOpenStatusDrawer,
  onOpenHealthDrawer,
  onRenameInstance,
  onViewLogs,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [showMetrics, setShowMetrics] = useState(false);

  const {
    instance,
    displayName,
    formattedPhone,
    addressLabel,
    statusInfo,
    metrics,
    statusValues,
    rateUsage,
    ratePercentage,
    lastUpdatedLabel,
    isCurrent,
  } = viewModel;

  const connectionState = computeConnectionState(statusInfo);
  const loadLevel = computeLoadLevel(metrics, ratePercentage);
  const statusChipClass = STATUS_CHIP_STYLES[connectionState] ?? STATUS_CHIP_STYLES.disconnected;

  const statusCodes = useMemo(
    () => mapStatusCodes(statusValues, statusCodeMeta),
    [statusValues, statusCodeMeta],
  );

  const sortedCodes = useMemo(() => {
    return [...statusCodes].sort((a, b) => b.count - a.count);
  }, [statusCodes]);

  const primaryActionLabel = connectionState === 'connected' ? 'Pausar' : 'Ativar';
  const usagePercentage = Math.max(0, Math.min(100, Number(ratePercentage ?? 0)));
  const usageBarClass = usagePercentage >= 80 ? 'bg-rose-500' : 'bg-indigo-500';
  const primaryDisabled =
    connectionState === 'connected' ? Boolean(isBusy) : Boolean(isBusy || !isAuthenticated);

  const totalMessages = useMemo(() => {
    const queued = Number(metrics?.queued ?? 0);
    const sent = Number(metrics?.sent ?? 0);
    const failed = Number(metrics?.failed ?? 0);
    return queued + sent + failed;
  }, [metrics]);

  const handlePrimaryAction = () => {
    if (connectionState === 'connected') {
      onSelectInstance?.(instance, { skipAutoQr: true });
      onOpenHealthDrawer?.(viewModel);
    } else {
      onViewQr?.(instance);
    }
  };

  const topStatus = sortedCodes[0]?.label ?? 'Código 1';

  return (
    <article
      className={cn(
        'group flex h-full flex-col rounded-2xl border border-slate-800 bg-slate-950/80 p-4 transition-colors hover:border-indigo-500/40 hover:bg-slate-900/80 focus-within:ring-2 focus-within:ring-indigo-500/40',
        isCurrent ? 'border-indigo-500/60 shadow-[0_0_0_1px_rgba(129,140,248,0.45)]' : null,
      )}
      tabIndex={-1}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">{displayName}</h3>
          <p className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
            Instância {instance?.id ?? '—'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.65rem] font-medium uppercase', statusChipClass)}>
            {STATUS_LABEL_MAP[connectionState]}
          </span>
          <InstanceActionsMenu
            instance={instance}
            deletingInstanceId={deletingInstanceId}
            isBusy={isBusy}
            isAuthenticated={isAuthenticated}
            onViewQr={onViewQr}
            onRequestDelete={onRequestDelete}
            onRenameInstance={onRenameInstance}
            onViewLogs={() => onViewLogs?.(viewModel)}
          />
        </div>
      </div>

      <Collapsible open={showDetails} onOpenChange={setShowDetails} className="mt-2">
        <div className="flex items-center justify-between text-[0.7rem] text-muted-foreground">
          <span>Atualizado — {lastUpdatedLabel || '—'}</span>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[0.65rem] uppercase tracking-wide"
            >
              <ChevronDown className={cn('mr-1 h-3.5 w-3.5 transition-transform', showDetails ? 'rotate-180' : '')} />
              {showDetails ? 'Recolher detalhes' : 'Detalhes'}
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="mt-2 grid gap-2 text-[0.8rem] text-muted-foreground sm:grid-cols-2">
          <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-2">
            <p className="text-[0.65rem] uppercase tracking-wide text-slate-400">Telefone</p>
            <p className="text-sm text-foreground">{formattedPhone || '—'}</p>
          </div>
          <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-2">
            <p className="text-[0.65rem] uppercase tracking-wide text-slate-400">Remetente</p>
            <p className="text-sm text-foreground">{addressLabel || '—'}</p>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible open={showMetrics} onOpenChange={setShowMetrics} className="mt-4 space-y-2">
        <div className="rounded-xl border border-slate-800/70 bg-slate-950/70 p-3">
          <div className="flex items-center justify-between gap-2 text-[0.65rem] uppercase tracking-wide text-slate-400">
            <span>Métricas</span>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[0.65rem] uppercase tracking-wide"
              >
                <ChevronDown className={cn('mr-1 h-3.5 w-3.5 transition-transform', showMetrics ? 'rotate-180' : '')} />
                {showMetrics ? 'Ocultar' : 'Ver completas'}
              </Button>
            </CollapsibleTrigger>
          </div>
          <p className="mt-2 text-sm font-semibold text-foreground">
            Total {formatMetricValue(totalMessages)} • Ganhos {formatMetricValue(metrics?.sent)}
          </p>
          <CollapsibleContent className="mt-3 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-2">
                <p className="text-[0.6rem] uppercase tracking-wide text-slate-400">Env.</p>
                <p className="text-sm font-semibold text-foreground">{formatMetricValue(metrics?.sent)}</p>
              </div>
              <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-2">
                <p className="text-[0.6rem] uppercase tracking-wide text-slate-400">Fila</p>
                <p className="text-sm font-semibold text-foreground">{formatMetricValue(metrics?.queued)}</p>
              </div>
              <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-2">
                <p className="text-[0.6rem] uppercase tracking-wide text-slate-400">Falhas</p>
                <p className="text-sm font-semibold text-foreground">{formatMetricValue(metrics?.failed)}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-[0.65rem] uppercase tracking-wide text-slate-400">
                <span>Códigos de status</span>
                <span className="text-[0.6rem] lowercase text-slate-500">Top: {topStatus}</span>
              </div>
              <div className="flex items-center gap-1">
                {statusCodes.map((code) => {
                  const isActive = code.count > 0;
                  const toneClass = isActive ? 'bg-indigo-400' : 'bg-slate-800';
                  return (
                    <Tooltip key={code.code}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            'h-2.5 w-2.5 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60',
                            toneClass,
                          )}
                          onClick={() => onOpenStatusDrawer?.(viewModel)}
                          aria-label={`Código ${code.label}: ${formatMetricValue(code.count)}`}
                        />
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">
                        <p className="font-medium">Código {code.label}</p>
                        <p>{code.description}</p>
                        <p className="mt-1 text-[0.6rem] uppercase tracking-wide text-slate-400">
                          {formatMetricValue(code.count)} ocorrência(s)
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-[0.65rem] uppercase tracking-wide text-slate-400">
                <span>Utilização do limite {usagePercentage}%</span>
              </div>
              <div className="h-[6px] w-full overflow-hidden rounded-full bg-slate-900">
                <div className={cn('h-full rounded-full transition-all', usageBarClass)} style={{ width: `${usagePercentage}%` }} />
              </div>
              <p className="text-[0.65rem] text-slate-400">
                Usadas {formatMetricValue(rateUsage?.used)} | Limite {formatMetricValue(rateUsage?.limit)}
              </p>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-[0.65rem] uppercase tracking-wide text-slate-500">
        <span className="flex items-center gap-2">Carga {loadLevel}</span>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full border border-slate-800/70 px-2 py-0.5 text-[0.6rem] font-medium',
            loadLevel === 'alta' ? 'text-rose-300' : loadLevel === 'média' ? 'text-amber-300' : 'text-emerald-300',
          )}
        >
          {lastUpdatedLabel ? `Última atualização ${lastUpdatedLabel}` : 'Sem atualização recente'}
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <Button
          size="sm"
          className="w-full"
          onClick={handlePrimaryAction}
          disabled={primaryDisabled}
        >
          {primaryActionLabel}
        </Button>
      </div>
    </article>
  );
};

export default InstanceSummaryCard;
