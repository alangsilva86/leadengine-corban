import MessageBubble from './MessageBubble.jsx';
import EventCard from './EventCard.jsx';

const Divider = ({ label }) => (
  <div className="my-4 flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-foreground-muted">
    <span className="h-px flex-1 bg-gradient-to-r from-transparent via-surface-overlay-glass-border to-transparent" />
    <span className="px-2 text-foreground">{label}</span>
    <span className="h-px flex-1 bg-gradient-to-l from-transparent via-surface-overlay-glass-border to-transparent" />
  </div>
);

const resolveAuthorKey = (payload = {}) => {
  const direction = typeof payload.direction === 'string' ? payload.direction.toLowerCase() : 'inbound';
  const authorCandidate =
    payload.authorId ??
    payload.userId ??
    payload.agentId ??
    payload.contactId ??
    payload.contact?.id ??
    payload.metadata?.whatsapp?.remoteJid ??
    payload.metadata?.remoteJid ??
    payload.metadata?.contactPhone ??
    payload.remoteJid ??
    payload.chatId ??
    payload.contact?.phone ??
    '';
  return `${direction}|${authorCandidate}`;
};

export const MessageTimeline = ({ items, loading, hasMore, onLoadMore, typingAgents = [] }) => (
  <div
    className="chat-scroll-content flex h-full min-h-0 flex-col gap-3"
    role="log"
    aria-live="polite"
    aria-relevant="additions"
  >
    {hasMore ? (
      <button
        type="button"
        onClick={() => onLoadMore?.()}
        className="mx-auto mt-2 rounded-full bg-surface-overlay-quiet px-4 py-1 text-xs text-foreground-muted ring-1 ring-surface-overlay-glass-border transition hover:bg-surface-overlay-strong"
      >
        {loading ? 'Carregando...' : 'Carregar anteriores'}
      </button>
    ) : null}

    {items?.map((entry, index) => {
      if (entry.type === 'divider') {
        return <Divider key={entry.id} label={entry.label} />;
      }

      if (entry.type === 'message') {
        const payload = entry.payload;
        const previousEntry = index > 0 ? items[index - 1] : null;
        const nextEntry = index < items.length - 1 ? items[index + 1] : null;
        const previousPayload = previousEntry?.type === 'message' ? previousEntry.payload : null;
        const nextPayload = nextEntry?.type === 'message' ? nextEntry.payload : null;
        const currentKey = resolveAuthorKey(payload);
        const sameAsPrevious = previousPayload ? resolveAuthorKey(previousPayload) === currentKey : false;
        const sameAsNext = nextPayload ? resolveAuthorKey(nextPayload) === currentKey : false;
        return (
          <MessageBubble
            key={entry.id}
            message={payload}
            isContinuation={sameAsPrevious}
            isTail={!sameAsNext}
            isFirst={!previousPayload}
            showMetadata={!sameAsPrevious}
          />
        );
      }

      return <EventCard key={entry.id} entry={entry} />;
    })}

    {typingAgents.length > 0 ? (
      <div className="flex items-center gap-2 rounded-full bg-success-soft px-3 py-1 text-xs text-success-strong">
        <div className="h-2 w-2 animate-pulse rounded-full bg-success" />
        {typingAgents[0].userName ?? 'Agente'} digitando…
      </div>
    ) : null}
  </div>
);

export default MessageTimeline;
