import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble.jsx';
import EventCard from './EventCard.jsx';

const Divider = ({ label }) => (
  <div className="my-4 flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-slate-500">
    <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    <span className="px-2 text-slate-300">{label}</span>
    <span className="h-px flex-1 bg-gradient-to-l from-transparent via-white/10 to-transparent" />
  </div>
);

export const MessageTimeline = ({
  items,
  loading,
  hasMore,
  onLoadMore,
  typingAgents = [],
}) => {
  const containerRef = useRef(null);
  const previousLengthRef = useRef(items?.length ?? 0);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    if ((items?.length ?? 0) > previousLengthRef.current) {
      element.scrollTop = element.scrollHeight;
    }
    previousLengthRef.current = items?.length ?? 0;
  }, [items]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const handleScroll = () => {
      if (element.scrollTop < 60 && hasMore && typeof onLoadMore === 'function' && !loading) {
        onLoadMore();
      }
    };

    element.addEventListener('scroll', handleScroll);
    return () => element.removeEventListener('scroll', handleScroll);
  }, [hasMore, loading, onLoadMore]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-6 py-6"
      role="log"
      aria-live="polite"
      aria-relevant="additions"
    >
      <div className="flex flex-col gap-4">
        {hasMore ? (
          <button
            type="button"
            onClick={() => onLoadMore?.()}
            className="mx-auto mt-2 rounded-full bg-slate-900/40 px-4 py-1 text-xs text-slate-300 ring-1 ring-white/5 transition hover:bg-slate-900/30"
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
          <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
            <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            {typingAgents[0].userName ?? 'Agente'} digitando…
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default MessageTimeline;
