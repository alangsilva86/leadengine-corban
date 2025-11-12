import { Fragment, useMemo } from 'react';
import { Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import { cn } from '@/lib/utils.js';
import useStatusToneClasses from '@/hooks/use-status-tone-classes.js';
import { getTicketIdentity } from '../../utils/ticketIdentity.js';
import InstanceBadge from '../Shared/InstanceBadge.jsx';

const resolveWindowStatus = (minutes) => {
  if (minutes === null || minutes === undefined) {
    return { label: 'Sem janela', tone: 'neutral' };
  }

  if (minutes <= 0) {
    return { label: 'Expirado', tone: 'expired' };
  }

  if (minutes <= 10) {
    return { label: `Crítico • ${minutes} min`, tone: 'critical' };
  }

  if (minutes <= 30) {
    return { label: `Atenção • ${minutes} min`, tone: 'warning' };
  }

  return { label: `Em dia • ${minutes} min`, tone: 'success' };
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

const QueueListItem = ({ ticket, selected, onSelect, selectedForBulk = false, onToggleSelection }) => {
  const windowStats = ticket?.window;
  const { label: slaLabel, tone: slaTone } = resolveWindowStatus(windowStats?.remainingMinutes ?? null);
  const slaToneClasses = useStatusToneClasses(slaTone, { uppercase: false, className: 'text-xs' });
  const lastInbound = formatTime(ticket?.timeline?.lastInboundAt);
  const lastOutbound = formatTime(ticket?.timeline?.lastOutboundAt);
  const agentTyping = ticket?.timeline?.typing;
  const { displayName, displayPhone, remoteJid } = getTicketIdentity(ticket);
  const instanceId =
    ticket?.metadata?.sourceInstance ??
    ticket?.instanceId ??
    ticket?.metadata?.instanceId ??
    ticket?.timeline?.instanceId ??
    null;

  const unreadInbound = ticket.timeline?.unreadInboundCount ?? 0;
  const lastActivity = lastInbound ?? lastOutbound ?? '—';
  const preview = formatPreview(ticket);

  return (
    <button
      type="button"
      data-active={selected ? 'true' : 'false'}
      data-bulk-selected={selectedForBulk ? 'true' : 'false'}
      aria-pressed={selected}
      onClick={() => onSelect?.(ticket.id)}
      className={cn(
        'group/list relative w-full rounded-2xl border border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] px-3 py-2 text-left transition-colors duration-150 hover:border-[color:color-mix(in_srgb,var(--accent-inbox-primary)_38%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--surface-overlay-inbox-bold)_90%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-inbox-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--surface-shell)]',
        selected && 'border-[color:color-mix(in_srgb,var(--accent-inbox-primary)_45%,transparent)] bg-[color:color-mix(in_srgb,var(--accent-inbox-primary)_12%,transparent)]',
        'data-[bulk-selected=true]:ring-2 data-[bulk-selected=true]:ring-[color:var(--accent-inbox-primary)] data-[bulk-selected=true]:ring-offset-2 data-[bulk-selected=true]:ring-offset-[color:var(--surface-shell)]'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-5 items-center pt-1">
          <Checkbox
            checked={selectedForBulk}
            onCheckedChange={() => onToggleSelection?.(ticket.id)}
            onClick={(event) => event.stopPropagation()}
            className="h-4 w-4"
            aria-label={selectedForBulk ? 'Remover ticket da seleção' : 'Selecionar ticket para ações em massa'}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center justify-between gap-2 text-[10px] text-[color:var(--color-inbox-foreground-muted)]">
            <InstanceBadge instanceId={instanceId} />
            <span>{lastActivity}</span>
          </div>
          <div className="mt-2 flex min-w-0 items-center gap-2">
            <p className="truncate text-sm font-semibold text-[color:var(--color-inbox-foreground)]" title={displayName}>
              {displayName}
            </p>
            {unreadInbound > 0 ? (
              <span className="inline-flex items-center justify-center rounded-full bg-[color:var(--accent-inbox-primary)]/10 px-2 py-0.5 text-[11px] font-semibold text-[color:var(--accent-inbox-primary)]">
                +{unreadInbound}
              </span>
            ) : null}
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-[color:var(--color-inbox-foreground-muted)]">
            <span className="truncate">{preview}</span>
            <span className="hidden overflow-hidden text-[10px] uppercase tracking-wide text-[color:var(--color-inbox-foreground-muted)]/70 group-hover/list:inline">
              {slaLabel}
            </span>
          </div>
        </div>
        <div className="hidden flex-col items-end gap-1 text-xs text-[color:var(--color-inbox-foreground-muted)] group-hover/list:flex">
          <span>{ticket.pipelineStep ?? ticket.metadata?.pipelineStep ?? 'Sem etapa'}</span>
          <span className="text-[10px]">{displayPhone ?? remoteJid ?? 'Sem telefone'}</span>
        </div>
      </div>
      {agentTyping ? (
        <div className="mt-2 flex items-center gap-1 text-[10px] font-medium text-[color:var(--accent-inbox-primary)]">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[color:var(--accent-inbox-primary)]" />
          Digitando…
        </div>
      ) : null}
    </button>
  );
};

const QueueList = ({
  tickets,
  selectedTicketId,
  selectedTicketIds = [],
  onSelectTicket,
  onToggleTicketSelection,
  onClearSelection,
  loading,
  onRefresh,
  typingAgents = [],
  metrics,
  onBulkRegisterLoss,
  bulkActionPending = false,
  bulkActionsDisabled = false,
}) => {
  const typingTicketIds = useMemo(() => new Set(typingAgents.map((agent) => agent.ticketId)), [typingAgents]);
  const selectionCount = Array.isArray(selectedTicketIds) ? selectedTicketIds.length : 0;
  const selectionLabel =
    selectionCount === 1 ? '1 ticket selecionado' : `${selectionCount} tickets selecionados`;

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-2 px-1">
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

      {selectionCount > 0 ? (
        <div className="mx-1 flex flex-col gap-2 rounded-xl border border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] px-3 py-2 text-xs text-[color:var(--color-inbox-foreground)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium">{selectionLabel}</span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onClearSelection?.()}
                className="h-7"
              >
                Limpar
              </Button>
              <Button
                size="sm"
                onClick={() => onBulkRegisterLoss?.()}
                disabled={bulkActionsDisabled || selectionCount === 0}
                className="h-7"
              >
                {bulkActionPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
                Registrar perda
              </Button>
            </div>
          </div>
          <p className="text-[10px] text-[color:var(--color-inbox-foreground-muted)]">
            Aplique ações em massa nos tickets selecionados.
          </p>
        </div>
      ) : null}

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
                selectedForBulk={selectedTicketIds.includes(ticket.id)}
                onSelect={onSelectTicket}
                onToggleSelection={onToggleTicketSelection}
              />
            </Fragment>
          ))
        )}
      </div>
    </div>
  );
};

export default QueueList;
