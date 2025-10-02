import { Download, Loader2, RefreshCcw, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button.jsx';
import { ButtonGroup } from '@/components/ui/button-group.jsx';
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

      <ButtonGroup className="justify-between">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {countdownLabel ? countdownLabel : 'Atualização contínua a cada 15s'}
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
            <TooltipContent>Atualização automática a cada 15 segundos.</TooltipContent>
          </Tooltip>
          <Button variant="outline" size="sm" onClick={onExport} className="gap-2">
            <Download className="h-4 w-4" /> Exportar CSV
          </Button>
        </div>
      </ButtonGroup>
    </div>
  );
};

export default InboxActions;
