import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.jsx';
import { cn } from '@/lib/utils.js';
import { formatPhoneNumber, formatMetricValue } from '../lib/formatting';
import {
  Activity,
  AlarmClock,
  EllipsisVertical,
  Gauge,
  Inbox,
  Link2,
  Plus,
  RefreshCcw,
  Zap,
} from 'lucide-react';

const QR_STATUS_VARIANTS = {
  connected: 'bg-emerald-500/10 text-emerald-200 border border-emerald-400/40',
  connecting: 'bg-sky-500/10 text-sky-100 border border-sky-400/40',
  qr_required: 'bg-amber-500/10 text-amber-200 border border-amber-400/40',
  disconnected: 'bg-rose-500/10 text-rose-200 border border-rose-400/40',
  fallback: 'bg-slate-800/70 text-slate-200 border border-slate-700',
};

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
  qrStatusMessage,
  countdownMessage,
  journeySteps,
  canContinue,
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

  const qrBadgeClass = QR_STATUS_VARIANTS[localStatus] ?? QR_STATUS_VARIANTS.fallback;

  const timeline = Array.isArray(journeySteps) && journeySteps.length > 0 ? journeySteps : null;

  const renderSummaryContent = () => {
    if (normalizedSummary.state === 'ready') {
      return (
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Badge className="flex items-center gap-2 rounded-full bg-slate-900/70 px-3 py-1 text-[0.65rem] text-slate-200">
            <Activity className="h-3.5 w-3.5 text-indigo-300" />
            Fila total: {formatMetricValue(normalizedSummary.queueTotal)}
          </Badge>
          <Badge className="flex items-center gap-2 rounded-full bg-slate-900/70 px-3 py-1 text-[0.65rem] text-slate-200">
            <Zap className="h-3.5 w-3.5 text-emerald-300" />
            Falhas 24h: {formatMetricValue(normalizedSummary.failureTotal)}
          </Badge>
          <Badge className="flex items-center gap-2 rounded-full bg-slate-900/70 px-3 py-1 text-[0.65rem] text-slate-200">
            <Gauge className={cn('h-3.5 w-3.5', normalizedSummary.usageAverage >= 80 ? 'text-rose-200' : normalizedSummary.usageAverage >= 60 ? 'text-amber-200' : 'text-emerald-200')} />
            Uso médio: {normalizedSummary.usageAverage}%
          </Badge>
          <Badge className="flex items-center gap-2 rounded-full bg-slate-900/70 px-3 py-1 text-[0.65rem] text-slate-200">
            <AlarmClock className="h-3.5 w-3.5 text-slate-300" />
            Última sync: {normalizedSummary.lastSyncLabel}
          </Badge>
          {instancesCountLabel ? (
            <span className="ml-2 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground/80">
              {instancesCountLabel}
            </span>
          ) : null}
        </div>
      );
    }

    if (normalizedSummary.state === 'loading') {
      return (
        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          <Badge variant="status" tone="info">
            Sincronizando instâncias…
          </Badge>
          {instancesCountLabel ? <span>{instancesCountLabel}</span> : null}
        </div>
      );
    }

    return <span className="text-xs text-muted-foreground">{instancesCountLabel || 'Nenhuma instância cadastrada.'}</span>;
  };

  return (
    <div className="space-y-6">
      {timeline ? (
        <nav aria-label="Jornada WhatsApp" className="flex flex-wrap items-center gap-3 text-xs font-medium uppercase">
          {timeline.map((step, index) => {
            const isLast = index === timeline.length - 1;
            const statusClass =
              step.status === 'current'
                ? 'border-indigo-400/50 bg-indigo-500/10 text-indigo-200'
                : step.status === 'ready'
                  ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
                  : 'border-slate-700 bg-slate-900/60 text-muted-foreground';

            return (
              <div key={step.key || step.label} className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex items-center gap-2 rounded-full border px-4 py-1.5 text-[0.7rem] tracking-wide transition',
                    statusClass,
                  )}
                >
                  <span>{step.label}</span>
                  {step.status === 'ready' ? <span className="text-[0.65rem] text-emerald-200/90">Pronto</span> : null}
                  {step.status === 'current' ? <span className="text-[0.65rem] text-indigo-200/80">Agora</span> : null}
                </div>
                {!isLast ? <span className="h-0.5 w-6 rounded-full bg-slate-800" /> : null}
              </div>
            );
          })}
        </nav>
      ) : null}

      {renderSummaryContent()}

      <div className="rounded-3xl border border-slate-800/60 bg-slate-950/70 p-5 shadow-[0_10px_40px_rgba(15,23,42,0.35)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Instância ativa</p>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-semibold text-foreground">{selectedName}</p>
                {selectedInstanceStatusInfo ? (
                  <Badge variant={selectedInstanceStatusInfo.variant}>{selectedInstanceStatusInfo.label}</Badge>
                ) : null}
                {qrStatusMessage ? (
                  <span className={cn('rounded-full px-3 py-1 text-[0.65rem] font-medium uppercase', qrBadgeClass)}>
                    {countdownMessage && countdownMessage !== qrStatusMessage ? countdownMessage : qrStatusMessage}
                  </span>
                ) : null}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {selectedInstance
                ? `Telefone: ${formattedPhone || selectedInstancePhone || '—'}`
                : copy?.description || 'Selecione uma instância para continuar.'}
            </p>
          </div>

          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <Button
                onClick={onConfirm}
                size="default"
                disabled={confirmDisabled}
                className="gap-2 rounded-full px-5 py-2 text-sm font-semibold"
              >
                <Inbox className="h-4 w-4" /> {confirmLabel || 'Ir para a Inbox'}
              </Button>
              {showMarkConnected ? (
                <Button
                  onClick={onMarkConnected}
                  size="sm"
                  variant="outline"
                  disabled={confirmDisabled}
                  className="rounded-full"
                >
                  Marcar como conectado
                </Button>
              ) : null}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full border border-slate-800/80">
                  <EllipsisVertical className="h-5 w-5" />
                  <span className="sr-only">Mais ações</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    onRefresh?.();
                  }}
                  disabled={loadingInstances || !isAuthenticated}
                  className="gap-2"
                >
                  <RefreshCcw className="h-4 w-4" /> Atualizar lista
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    onCreateInstance?.();
                  }}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" /> Nova instância
                </DropdownMenuItem>
                {onViewLogs ? (
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault();
                      onViewLogs?.();
                    }}
                    className="gap-2"
                  >
                    <Link2 className="h-4 w-4" /> Logs da instância
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem disabled className="gap-2 text-muted-foreground">
                  <Inbox className="h-4 w-4" />
                  {canContinue ? 'Pronto para Inbox' : 'Selecione uma instância conectada'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SelectedInstanceBanner;
