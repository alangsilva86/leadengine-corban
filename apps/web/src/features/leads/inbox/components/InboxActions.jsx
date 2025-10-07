import { Download, Loader2, RefreshCcw } from 'lucide-react';

import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import NoticeBanner from '@/components/ui/notice-banner.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import { cn } from '@/lib/utils.js';

const formatCountdown = (seconds) => {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) {
    return null;
  }
  if (seconds <= 0) {
    return 'Atualizando…';
  }
  return `Atualização automática em ${seconds}s`;
};

export const InboxActions = ({
  loading,
  onRefresh,
  onExport,
  rateLimitInfo,
  autoRefreshSeconds,
  lastUpdatedAt,
}) => {
  const countdownLabel = formatCountdown(autoRefreshSeconds);
  const primaryRefreshLabel = loading ? 'Sincronizando em tempo real' : 'Atualização automática';
  const secondaryRefreshLabel = countdownLabel ?? 'A cada 15 segundos';
  const lastUpdatedLabel = lastUpdatedAt
    ? `Última atualização às ${lastUpdatedAt.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      })}`
    : null;

  return (
    <div className="space-y-4">
      <Card className="rounded-3xl border-white/15 bg-white/[0.08] shadow-[0_18px_40px_rgba(5,12,30,0.45)]">
        <CardHeader className="space-y-2 pb-3">
          <CardTitle className="text-sm font-semibold text-white/85">Sincronização inteligente</CardTitle>
          <CardDescription className="text-xs text-white/70">
            Leads chegam automaticamente após cada mensagem recebida. Você pode forçar uma atualização a qualquer momento.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/15 bg-white/[0.08] px-4 py-3 text-white/75 shadow-[0_14px_32px_rgba(5,12,28,0.35)]">
            <div className="flex items-center gap-2 text-left text-sm text-white/90">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-white/75" />
              ) : (
                <RefreshCcw className="h-4 w-4 text-white/70" />
              )}
              <div>
                <p className="font-medium leading-tight text-white/90">{primaryRefreshLabel}</p>
                <p className="text-xs text-white/70">{secondaryRefreshLabel}</p>
              </div>
            </div>
            {lastUpdatedLabel ? (
              <span className="text-[11px] font-medium text-white/70">{lastUpdatedLabel}</span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRefresh}
                  disabled={loading}
                  className={cn('gap-2 text-sm font-medium text-white/90 border-white/20 bg-white/[0.04] hover:border-white/30 hover:bg-white/[0.1]')}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                  {loading ? 'Sincronizando…' : 'Atualizar agora'}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Atualização automática acontece em segundo plano.</TooltipContent>
            </Tooltip>
            <Button
              variant="ghost"
              size="sm"
              onClick={onExport}
              className="gap-2 text-sm font-medium text-white/75 hover:text-white"
            >
              <Download className="h-4 w-4" /> Exportar CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {rateLimitInfo.show ? (
        <NoticeBanner
          variant="warning"
          className="rounded-2xl border-white/12 bg-white/[0.08] text-sm text-white/85"
        >
          Muitas requisições recentes. Aguarde {rateLimitInfo.retryAfter ?? rateLimitInfo.resetSeconds ?? 0}s para evitar
          bloqueios.
        </NoticeBanner>
      ) : null}
    </div>
  );
};

export default InboxActions;
