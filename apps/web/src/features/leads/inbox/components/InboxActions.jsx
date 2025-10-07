import { Download, Loader2, RefreshCcw, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button.jsx';
import NoticeBanner from '@/components/ui/notice-banner.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import { cn } from '@/lib/utils.js';
import { Badge } from '@/components/ui/badge.jsx';

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
      <NoticeBanner
        variant="info"
        icon={<Sparkles className="h-4 w-4" />}
        className="text-sm"
      >
        Leads chegam automaticamente sempre que um contato envia mensagem para o WhatsApp conectado.
        {lastUpdatedAt ? (
          <div className="text-xs opacity-80">Última sincronização: {lastUpdatedAt.toLocaleTimeString('pt-BR')}</div>
        ) : null}
      </NoticeBanner>

      {rateLimitInfo.show ? (
        <NoticeBanner
          variant="warning"
          icon={<Sparkles className="h-4 w-4" />}
        >
          Muitas requisições recentes. Aguarde {rateLimitInfo.retryAfter ?? rateLimitInfo.resetSeconds ?? 0}s para evitar bloqueios.
        </NoticeBanner>
      ) : null}

      <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/20 p-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 text-muted-foreground">
          <Badge
            variant="outline"
            className={cn(
              'flex items-center gap-2 border-primary/40 bg-primary/5 text-foreground',
              loading && 'border-primary bg-primary/10'
            )}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCcw className="h-3.5 w-3.5" />
            )}
            <span className="font-medium text-xs text-foreground">{primaryRefreshLabel}</span>
            <span className="text-[10px] text-muted-foreground">{secondaryRefreshLabel}</span>
          </Badge>
          {lastUpdatedLabel ? <span>{lastUpdatedLabel}</span> : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={loading}
                className={cn('gap-2')}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                {loading ? 'Sincronizando…' : 'Atualizar agora'}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Atualização automática acontece em segundo plano.</TooltipContent>
          </Tooltip>
          <Button variant="outline" size="sm" onClick={onExport} className="gap-2">
            <Download className="h-4 w-4" /> Exportar CSV
          </Button>
        </div>
      </div>
    </div>
  );
};

export default InboxActions;
