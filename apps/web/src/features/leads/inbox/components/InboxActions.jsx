import { Download, Loader2, MessageSquarePlus, RefreshCcw } from 'lucide-react';

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
  onStartManualConversation,
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
      <Card className="rounded-3xl border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] text-[color:var(--color-inbox-foreground)] shadow-[var(--shadow-xl)]">
        <CardHeader className="space-y-2 pb-3">
          <CardTitle className="text-sm font-semibold text-foreground-muted">Sincronização inteligente</CardTitle>
          <CardDescription className="text-xs text-[color:var(--color-inbox-foreground-muted)]">
            Leads chegam automaticamente após cada mensagem recebida. Você pode forçar uma atualização a qualquer momento.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] px-4 py-3 text-[color:var(--color-inbox-foreground-muted)] shadow-[0_14px_32px_color-mix(in_srgb,var(--color-inbox-border)_48%,transparent)]">
            <div className="flex items-center gap-2 text-left text-sm text-[color:var(--color-inbox-foreground)]">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-[color:var(--color-inbox-foreground-muted)]" />
              ) : (
                <RefreshCcw className="h-4 w-4 text-[color:var(--color-inbox-foreground-muted)]" />
              )}
              <div>
                <p className="font-medium leading-tight text-[color:var(--color-inbox-foreground)]">{primaryRefreshLabel}</p>
                <p className="text-xs text-[color:var(--color-inbox-foreground-muted)]">{secondaryRefreshLabel}</p>
              </div>
            </div>
            {lastUpdatedLabel ? (
              <span className="text-xs font-medium text-[color:var(--color-inbox-foreground-muted)]">{lastUpdatedLabel}</span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
            {onStartManualConversation ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    onClick={onStartManualConversation}
                    className="gap-2 rounded-2xl bg-emerald-500 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-950 shadow-[0_10px_24px_color-mix(in_srgb,#10b981_35%,transparent)] transition hover:bg-emerald-400"
                  >
                    <MessageSquarePlus className="h-4 w-4" />
                    Nova conversa manual
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Cadastre um contato e abra o WhatsApp imediatamente.</TooltipContent>
              </Tooltip>
            ) : null}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRefresh}
                  disabled={loading}
                  className={cn(
                    'gap-2 text-sm font-medium text-[color:var(--color-inbox-foreground)] border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-quiet)] hover:border-primary/40 hover:bg-[color:color-mix(in_srgb,var(--surface-overlay-inbox-quiet)_75%,transparent)]'
                  )}
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
              className="gap-2 text-sm font-medium text-[color:var(--color-inbox-foreground-muted)] hover:text-[color:var(--color-inbox-foreground)]"
            >
              <Download className="h-4 w-4" /> Exportar CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {rateLimitInfo.show ? (
        <NoticeBanner tone="warning" className="rounded-2xl text-sm">
          Muitas requisições recentes. Aguarde {rateLimitInfo.retryAfter ?? rateLimitInfo.resetSeconds ?? 0}s para evitar
          bloqueios.
        </NoticeBanner>
      ) : null}
    </div>
  );
};

export default InboxActions;
