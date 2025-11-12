import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import { formatPhoneNumber, formatMetricValue } from '../lib/formatting';
import { Inbox, Link2, Plus, RefreshCcw } from 'lucide-react';

const SelectedInstanceBanner = ({
  copy,
  summary,
  selectedInstance,
  selectedInstanceStatusInfo,
  selectedInstancePhone,
  instancesCountLabel,
  confirmLabel,
  confirmDisabled,
  onConfirm,
  onMarkConnected,
  localStatus,
  onRefresh,
  onCreateInstance,
  onViewLogs,
  loadingInstances,
  isAuthenticated,
}) => {
  const selectedName = selectedInstance?.name || selectedInstance?.id || 'Selecione um canal';
  const formattedPhone = selectedInstance ? formatPhoneNumber(selectedInstancePhone) : null;
  const showMarkConnected = Boolean(onMarkConnected) && localStatus !== 'connected';

  const normalizedSummary =
    summary ??
    {
      state: 'loading',
      totals: { connected: 0, attention: 0, disconnected: 0 },
      queueTotal: 0,
      failureTotal: 0,
      usageAverage: 0,
      lastSyncLabel: '—',
    };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-start gap-2 md:justify-end">
        <Button size="sm" variant="outline" onClick={onRefresh} disabled={loadingInstances || !isAuthenticated}>
          <RefreshCcw className="mr-2 h-4 w-4" /> Atualizar lista
        </Button>
        <Button size="sm" onClick={onCreateInstance}>
          <Plus className="mr-2 h-4 w-4" /> Nova instância
        </Button>
        {onViewLogs ? (
          <Button size="sm" variant="outline" onClick={() => onViewLogs?.()} className="gap-2">
            <Link2 className="h-4 w-4" /> Logs
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 text-[0.65rem] uppercase tracking-wide text-muted-foreground">
        {normalizedSummary.state === 'ready' ? (
          <>
            <Badge variant="outline" className="border-slate-800/60 bg-transparent px-3 py-1 text-slate-200">
              Fila total: {formatMetricValue(normalizedSummary.queueTotal)}
            </Badge>
            <Badge variant="outline" className="border-slate-800/60 bg-transparent px-3 py-1 text-slate-200">
              Falhas 24h: {formatMetricValue(normalizedSummary.failureTotal)}
            </Badge>
            <Badge variant="outline" className="border-slate-800/60 bg-transparent px-3 py-1 text-indigo-200">
              Uso médio do limite: {normalizedSummary.usageAverage}%
            </Badge>
            <Badge variant="outline" className="border-slate-800/60 bg-transparent px-3 py-1 text-slate-300">
              Última sync: {normalizedSummary.lastSyncLabel}
            </Badge>
          </>
        ) : normalizedSummary.state === 'loading' ? (
          <>
            <Badge variant="status" tone="info">
              Sincronizando instâncias…
            </Badge>
            {instancesCountLabel ? <span>{instancesCountLabel}</span> : null}
          </>
        ) : (
          <span>{instancesCountLabel || 'Nenhuma instância cadastrada.'}</span>
        )}
      </div>

      <div className="rounded-2xl border border-surface-overlay-glass-border bg-surface-overlay-quiet p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Instância em foco</p>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-foreground">{selectedName}</p>
              {selectedInstanceStatusInfo ? (
                <Badge variant={selectedInstanceStatusInfo.variant}>{selectedInstanceStatusInfo.label}</Badge>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedInstance ? `Telefone: ${formattedPhone || selectedInstancePhone || '—'}` : copy?.description}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {showMarkConnected ? (
              <Button onClick={onMarkConnected} size="sm" variant="outline" disabled={confirmDisabled}>
                Marcar como conectado
              </Button>
            ) : null}
            <Button onClick={onConfirm} size="sm" disabled={confirmDisabled} className="gap-2">
              <Inbox className="h-4 w-4" /> {confirmLabel || 'Ir para a Inbox'}
            </Button>
          </div>
        </div>
      </div>
      <Separator className="border-slate-800/60" />
    </div>
  );
};

export default SelectedInstanceBanner;
