import InboxFilters from './InboxFilters.jsx';
import InboxItem from './InboxItem.jsx';

const buildTypingMap = (agentsTyping = []) => {
  const map = new Map();
  for (const entry of agentsTyping) {
    if (!entry?.ticketId) continue;
    const current = map.get(entry.ticketId) ?? [];
    current.push(entry);
    map.set(entry.ticketId, current);
  }
  return map;
};

const MetricsCard = ({ metrics }) => {
  if (!metrics) {
    return null;
  }

  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-950/70 p-3 text-xs text-slate-300">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">FRT &lt; 5 min</span>
          <p className="text-lg font-semibold text-slate-100">
            {metrics.firstResponse?.underFiveMinutesRate !== null && metrics.firstResponse?.underFiveMinutesRate !== undefined
              ? `${Math.round((metrics.firstResponse.underFiveMinutesRate ?? 0) * 100)}%`
              : '—'}
          </p>
        </div>
        <div>
          <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Entropia status</span>
          <p className="text-lg font-semibold text-slate-100">
            {metrics.statusEntropy ?? '—'}
          </p>
        </div>
        <div>
          <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Proposta → CCB</span>
          <p className="text-lg font-semibold text-slate-100">
            {metrics.proposalToCcbRate !== null && metrics.proposalToCcbRate !== undefined
              ? `${Math.round((metrics.proposalToCcbRate ?? 0) * 100)}%`
              : '—'}
          </p>
        </div>
        <div>
          <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Qualidade WA</span>
          <p className="text-lg font-semibold text-slate-100">
            {metrics.whatsappQuality?.qualityTier ? metrics.whatsappQuality.qualityTier : '—'}
          </p>
          <p className="text-[11px] text-slate-500">
            Limite: {metrics.whatsappQuality?.throughputLimit ?? '—'} msgs/dia
          </p>
        </div>
      </div>
    </div>
  );
};

export const InboxPanel = ({
  filters,
  onFiltersChange,
  search,
  onSearchChange,
  onRefresh,
  loading,
  tickets,
  selectedTicketId,
  onSelectTicket,
  metrics,
  typingAgents,
  onAssign,
  onTransfer,
  onMute,
  onFollowUp,
  onMacro,
}) => {
  const typingMap = buildTypingMap(typingAgents);

  return (
    <div className="flex h-full flex-col gap-4">
      <InboxFilters
        filters={filters}
        onFiltersChange={(partial) => onFiltersChange?.((current) => ({ ...current, ...partial }))}
        search={search}
        onSearchChange={onSearchChange}
        onRefresh={onRefresh}
        loading={loading}
      />

      <MetricsCard metrics={metrics} />

      <div className="flex-1 overflow-y-auto pr-1">
        {tickets.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-800/70 bg-slate-950/70 p-6 text-center text-sm text-slate-400">
            <p>Nenhum ticket encontrado com os filtros selecionados.</p>
            <p className="text-xs text-slate-500">Ajuste os filtros ou pesquise por outro contato.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {tickets.map((ticket) => (
              <InboxItem
                key={ticket.id}
                ticket={ticket}
                selected={ticket.id === selectedTicketId}
                onSelect={onSelectTicket}
                typingAgents={typingMap.get(ticket.id)}
                onAssign={onAssign}
                onTransfer={onTransfer}
                onMute={onMute}
                onFollowUp={onFollowUp}
                onMacro={onMacro}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default InboxPanel;
