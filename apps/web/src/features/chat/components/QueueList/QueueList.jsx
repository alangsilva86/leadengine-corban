import { Fragment, useMemo } from 'react';
import { Loader2, RefreshCw, AlertTriangle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { ScrollArea } from '@/components/ui/scroll-area.jsx';
import { cn, formatPhoneNumber } from '@/lib/utils.js';

const minutesToLabel = (minutes) => {
  if (minutes === null || minutes === undefined) {
    return {
      label: 'Sem janela',
      tone: 'text-[color:var(--color-inbox-foreground-muted)]',
      badge: 'bg-[color:var(--surface-overlay-inbox-bold)] text-[color:var(--color-inbox-foreground)] border border-[color:var(--color-inbox-border)]',
    };
  }

  if (minutes <= 0) {
    return { label: 'Expirado', tone: 'text-rose-300', badge: 'bg-rose-500/10 text-rose-200 border border-rose-500/30' };
  }

  if (minutes <= 10) {
    return { label: `Crítico • ${minutes} min`, tone: 'text-amber-200', badge: 'bg-amber-500/10 text-amber-100 border border-amber-500/30' };
  }

  if (minutes <= 30) {
    return { label: `Atenção • ${minutes} min`, tone: 'text-amber-100', badge: 'bg-amber-400/10 text-amber-100/90 border border-amber-400/20' };
  }

  return { label: `Em dia • ${minutes} min`, tone: 'text-emerald-200', badge: 'bg-emerald-500/10 text-emerald-200 border border-emerald-500/20' };
};

const formatPreview = (ticket) => {
  if (ticket?.lastMessagePreview) {
    return ticket.lastMessagePreview;
  }
  if (ticket?.timeline?.lastDirection === 'INBOUND') {
    return 'Aguardando resposta';
  }
  if (ticket?.timeline?.lastDirection === 'OUTBOUND') {
    return 'Aguardando cliente';
  }
  return 'Sem mensagens registradas';
};

const formatTime = (iso) => {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const QueueListItem = ({ ticket, selected, onSelect }) => {
  const windowStats = ticket?.window;
  const { label: slaLabel, badge: slaBadgeClass } = minutesToLabel(windowStats?.remainingMinutes ?? null);
  const lastInbound = formatTime(ticket?.timeline?.lastInboundAt);
  const lastOutbound = formatTime(ticket?.timeline?.lastOutboundAt);
  const agentTyping = ticket?.timeline?.typing;
  const contact = ticket?.contact ?? {};
  const displayName = contact.name || ticket.subject || 'Contato sem nome';
  const phoneFromMetadata =
    ticket?.metadata?.contactPhone ||
    ticket?.metadata?.whatsapp?.phone ||
    ticket?.metadata?.remoteJid;
  const displayPhone = formatPhoneNumber(contact.phone || phoneFromMetadata);
  const remoteJid =
    ticket?.metadata?.whatsapp?.remoteJid ||
    ticket?.metadata?.remoteJid ||
    null;

  return (
    <button
      type="button"
      onClick={() => onSelect?.(ticket.id)}
      className={cn(
        'w-full rounded-xl border border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] p-3 text-left transition hover:border-[color:var(--accent-inbox-primary)] hover:bg-[color:color-mix(in_srgb,var(--surface-overlay-inbox-bold)_92%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-inbox-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--surface-shell)]',
        selected && 'border-[color:var(--accent-inbox-primary)] bg-[color:var(--surface-overlay-inbox-bold)]'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <p className="truncate text-sm font-semibold text-[color:var(--color-inbox-foreground)]" title={displayName}>
            {displayName}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[color:var(--color-inbox-foreground-muted)]">
            <span>{displayPhone}</span>
            {remoteJid ? <span className="text-[color:var(--color-inbox-foreground-muted)]/80">{remoteJid}</span> : null}
          </div>
          <p className="text-xs text-[color:var(--color-inbox-foreground-muted)]">{ticket.pipelineStep ?? ticket.metadata?.pipelineStep ?? 'Sem etapa'}</p>
        </div>
        <Badge className={cn('text-xs font-medium', slaBadgeClass)}>{slaLabel}</Badge>
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-[color:var(--color-inbox-foreground-muted)]">
        <span className="flex items-center gap-1 text-[color:var(--color-inbox-foreground-muted)]">
          <Clock className="h-3.5 w-3.5 text-[color:var(--color-inbox-foreground-muted)]" />
          Último cliente: {lastInbound ?? '—'}
        </span>
        <span className="text-[color:var(--color-inbox-foreground-muted)]">•</span>
        <span className="text-[color:var(--color-inbox-foreground-muted)]">Você: {lastOutbound ?? '—'}</span>
      </div>
      <p className="mt-2 line-clamp-2 text-xs text-[color:var(--color-inbox-foreground-muted)]">{formatPreview(ticket)}</p>
      {agentTyping ? (
        <div className="mt-2 text-xs text-[color:var(--accent-inbox-primary)]">Agente digitando…</div>
      ) : null}
      {ticket.timeline?.unreadInboundCount ? (
        <div className="mt-2 text-xs text-[color:var(--accent-inbox-primary)]">
          {ticket.timeline.unreadInboundCount} novas mensagens do cliente
        </div>
      ) : null}
    </button>
  );
};

const QueueMetrics = ({ metrics }) => {
  if (!metrics) {
    return null;
  }

  const median = metrics.firstResponse?.medianMinutes ?? null;
  const slaRate = metrics.firstResponse?.underFiveMinutesRate ?? null;
  const qualityTier = metrics.whatsappQuality?.qualityTier ?? null;

  return (
    <div className="grid grid-cols-1 gap-2 rounded-lg border border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] p-3 text-xs text-[color:var(--color-inbox-foreground-muted)]">
      <div className="flex items-center justify-between">
        <span>1ª resposta (mediana)</span>
        <span className="font-medium text-[color:var(--color-inbox-foreground)]">{median !== null ? `${median} min` : '—'}</span>
      </div>
      <div className="flex items-center justify-between">
        <span>Dentro de 5 min</span>
        <span className="font-medium text-[color:var(--color-inbox-foreground)]">{slaRate !== null ? `${Math.round(slaRate * 100)}%` : '—'}</span>
      </div>
      <div className="flex items-center justify-between">
        <span>Qualidade WA</span>
        <span className="uppercase tracking-wide text-[color:var(--color-inbox-foreground)]">{qualityTier ?? '—'}</span>
      </div>
    </div>
  );
};

const QueueList = ({
  tickets,
  selectedTicketId,
  onSelectTicket,
  loading,
  onRefresh,
  typingAgents = [],
  metrics,
}) => {
  const typingTicketIds = useMemo(() => new Set(typingAgents.map((agent) => agent.ticketId)), [typingAgents]);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="space-y-2 px-1">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[color:var(--color-inbox-foreground)]">Filas de atendimento</h2>
          <Button
            variant="ghost"
            size="icon"
            className="text-[color:var(--color-inbox-foreground-muted)] hover:text-[color:var(--color-inbox-foreground)]"
            onClick={onRefresh}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="sr-only">Sincronizar</span>
          </Button>
        </div>
      </div>

      <QueueMetrics metrics={metrics} />

      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-2 px-1 pb-6">
          {tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] p-6 text-center text-sm text-[color:var(--color-inbox-foreground-muted)]">
              <AlertTriangle className="h-5 w-5 text-[color:var(--color-inbox-foreground-muted)]" />
              <p>Nenhum ticket encontrado com os filtros atuais.</p>
            </div>
          ) : (
            tickets.map((ticket) => (
              <Fragment key={ticket.id}>
                <QueueListItem
                  ticket={{
                    ...ticket,
                    timeline: {
                      ...ticket.timeline,
                      typing: typingTicketIds.has(ticket.id),
                    },
                  }}
                  selected={ticket.id === selectedTicketId}
                  onSelect={onSelectTicket}
                />
              </Fragment>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default QueueList;
