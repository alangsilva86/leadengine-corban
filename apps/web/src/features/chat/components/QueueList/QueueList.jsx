import { Fragment, useMemo } from 'react';
import { Loader2, RefreshCw, AlertTriangle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { ScrollArea } from '@/components/ui/scroll-area.jsx';
import { cn, formatPhoneNumber } from '@/lib/utils.js';

const minutesToLabel = (minutes) => {
  if (minutes === null || minutes === undefined) {
    return { label: 'Sem janela', tone: 'text-slate-300', badge: 'bg-slate-800/60 text-slate-200' };
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
        'w-full rounded-xl border border-slate-900/60 bg-slate-950/60 p-3 text-left transition hover:border-slate-700/70 hover:bg-slate-900/70',
        selected && 'border-sky-500/50 bg-slate-900'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <p className="truncate text-sm font-semibold text-slate-100" title={displayName}>
            {displayName}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
            <span>{displayPhone}</span>
            {remoteJid ? <span className="text-slate-600">{remoteJid}</span> : null}
          </div>
          <p className="text-xs text-slate-500">{ticket.pipelineStep ?? ticket.metadata?.pipelineStep ?? 'Sem etapa'}</p>
        </div>
        <Badge className={cn('text-xs font-medium', slaBadgeClass)}>{slaLabel}</Badge>
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-slate-300">
        <span className="flex items-center gap-1 text-slate-400">
          <Clock className="h-3.5 w-3.5 text-slate-500" />
          Último cliente: {lastInbound ?? '—'}
        </span>
        <span className="text-slate-500">•</span>
        <span className="text-slate-400">Você: {lastOutbound ?? '—'}</span>
      </div>
      <p className="mt-2 line-clamp-2 text-xs text-slate-400">{formatPreview(ticket)}</p>
      {agentTyping ? (
        <div className="mt-2 text-xs text-emerald-200">Agente digitando…</div>
      ) : null}
      {ticket.timeline?.unreadInboundCount ? (
        <div className="mt-2 text-xs text-emerald-200">
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
    <div className="grid grid-cols-1 gap-2 rounded-lg border border-slate-900/80 bg-slate-950/70 p-3 text-xs text-slate-300">
      <div className="flex items-center justify-between">
        <span>1ª resposta (mediana)</span>
        <span className="font-medium text-slate-100">{median !== null ? `${median} min` : '—'}</span>
      </div>
      <div className="flex items-center justify-between">
        <span>Dentro de 5 min</span>
        <span className="font-medium text-slate-100">{slaRate !== null ? `${Math.round(slaRate * 100)}%` : '—'}</span>
      </div>
      <div className="flex items-center justify-between">
        <span>Qualidade WA</span>
        <span className="uppercase tracking-wide text-slate-100">{qualityTier ?? '—'}</span>
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
          <h2 className="text-sm font-semibold text-slate-200">Filas de atendimento</h2>
          <Button
            variant="ghost"
            size="icon"
            className="text-slate-300 hover:text-slate-100"
            onClick={onRefresh}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="sr-only">Sincronizar</span>
          </Button>
        </div>
      </div>

      <QueueMetrics metrics={metrics} />

      <ScrollArea className="flex-1">
        <div className="space-y-2 px-1 pb-6">
          {tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-800/80 bg-slate-950/60 p-6 text-center text-sm text-slate-400">
              <AlertTriangle className="h-5 w-5 text-slate-500" />
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
