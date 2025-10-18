import { useEffect } from 'react';
import MessageBubble from './MessageBubble.jsx';
import EventCard from './EventCard.jsx';
import useChatAutoscroll from '../../hooks/useChatAutoscroll.js';

const Divider = ({ label }) => (
  <div className="my-4 flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-foreground-muted">
    <span className="h-px flex-1 bg-gradient-to-r from-transparent via-surface-overlay-glass-border to-transparent" />
    <span className="px-2 text-foreground">{label}</span>
    <span className="h-px flex-1 bg-gradient-to-l from-transparent via-surface-overlay-glass-border to-transparent" />
  </div>
);

export const MessageTimeline = ({
  items,
  loading,
  hasMore,
  onLoadMore,
  typingAgents = [],
}) => {
  const { scrollRef: containerRef, scrollToBottom } = useChatAutoscroll();
  const lastEntryKey = items?.length ? items[items.length - 1]?.id ?? items.length : 0;

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const handleScroll = () => {
      if (element.scrollTop < 60 && hasMore && typeof onLoadMore === 'function' && !loading) {
        onLoadMore();
      }
    };

    element.addEventListener('scroll', handleScroll, { passive: true });
    return () => element.removeEventListener('scroll', handleScroll);
  }, [containerRef, hasMore, loading, onLoadMore]);

  useEffect(() => {
    scrollToBottom();
  }, [lastEntryKey, typingAgents.length, scrollToBottom]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <section
        id="chat-scroll"
        ref={containerRef}
        className="chat-scroll-area flex-1 min-h-0 w-full overflow-y-auto overscroll-contain scroll-smooth px-6 py-6"
        style={{ scrollbarGutter: 'stable' }}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        <div className="flex flex-col gap-4">
          {hasMore ? (
            <button
              type="button"
              onClick={() => onLoadMore?.()}
              className="mx-auto mt-2 rounded-full bg-surface-overlay-quiet px-4 py-1 text-xs text-foreground-muted ring-1 ring-surface-overlay-glass-border transition hover:bg-surface-overlay-strong"
            >
              {loading ? 'Carregando...' : 'Carregar anteriores'}
            </button>
          ) : null}

          {items?.map((entry) => {
            if (entry.type === 'divider') {
              return <Divider key={entry.id} label={entry.label} />;
            }

            if (entry.type === 'message') {
              return <MessageBubble key={entry.id} message={entry.payload} />;
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
      </section>
    </div>
  );
};

export default MessageTimeline;
