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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold text-foreground">Instâncias &amp; Canais</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Conecte, monitore e mantenha saudáveis seus números de WhatsApp. Campanhas são configuradas em{' '}
              <strong>Campanhas</strong>.
            </p>
          </div>
          {summary.state === 'ready' ? (
            <div className="flex flex-wrap items-center gap-2 text-[0.7rem] uppercase tracking-wide">
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-800/60 bg-slate-950/60 px-3 py-1 text-emerald-300">
                Instâncias: {summary.totals.connected} ativas / {summary.totals.disconnected} desconectadas
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-800/60 bg-slate-950/60 px-3 py-1 text-slate-200">
                Fila total: {formatMetricValue(summary.queueTotal)}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-800/60 bg-slate-950/60 px-3 py-1 text-slate-200">
                Falhas 24h: {formatMetricValue(summary.failureTotal)}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-800/60 bg-slate-950/60 px-3 py-1 text-indigo-200">
                Uso médio do limite: {summary.usageAverage}%
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-800/60 bg-slate-950/60 px-3 py-1 text-slate-300">
                Última sync: {summary.lastSyncLabel}
              </span>
            </div>
          ) : summary.state === 'loading' ? (
            <div className="flex flex-wrap items-center gap-2 text-[0.7rem] uppercase tracking-wide text-slate-400">
              <Badge variant="status" tone="info">
                Sincronizando instâncias…
              </Badge>
              {instancesCountLabel ? <span>{instancesCountLabel}</span> : null}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              {instancesCountLabel || 'Nenhuma instância cadastrada.'}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={onRefresh} disabled={loadingInstances || !isAuthenticated}>
            <RefreshCcw className="mr-2 h-4 w-4" /> Atualizar lista
          </Button>
          <Button size="sm" onClick={onCreateInstance}>
            <Plus className="mr-2 h-4 w-4" /> Nova instância
          </Button>
          {onViewLogs ? (
            <Button size="sm" variant="outline" onClick={() => onViewLogs?.()} className="gap-2">
              <Link2 className="h-4 w-4" /> Logs de eventos
            </Button>
          ) : null}
          {onConfirm ? (
            <Button size="sm" variant="ghost" onClick={onConfirm} disabled={confirmDisabled} className="gap-2">
              <Inbox className="h-4 w-4" /> {confirmLabel || 'Ir para a Inbox'}
            </Button>
          ) : null}
        </div>
      </div>

      <Separator className="border-slate-800/60" />

      <div className="grid gap-4 rounded-2xl border border-surface-overlay-glass-border bg-surface-overlay-quiet p-4 md:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Instância em foco</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{selectedName}</p>
            {selectedInstanceStatusInfo ? (
              <Badge variant={selectedInstanceStatusInfo.variant}>{selectedInstanceStatusInfo.label}</Badge>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {selectedInstance ? `Telefone: ${formattedPhone || selectedInstancePhone || '—'}` : copy?.description}
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 text-sm">
          {showMarkConnected ? (
            <Button onClick={onMarkConnected} size="sm" disabled={confirmDisabled}>
              Marcar como conectado
            </Button>
          ) : null}
          <Button onClick={onConfirm} size="sm" disabled={confirmDisabled} variant="secondary">
            {confirmLabel || 'Ir para a Inbox'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SelectedInstanceBanner;
