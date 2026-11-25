import { Loader2, MessageSquareDashed } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { EmptyState, ErrorState } from '@/components/page';
import { cn } from '@/lib/utils.js';
import MessageBubble from './MessageBubble.jsx';
import EventCard from './EventCard.jsx';
import NoteCard from './NoteCard.jsx';
import { resolveMessageAuthor } from './utils/presentation.js';

const GROUP_WINDOW_MS = 5 * 60 * 1000;

const DayDivider = ({ label }) => (
  <div className="sticky top-2 z-10 my-3 flex justify-center" role="separator" aria-label={label}>
    <span className="rounded-full border border-border bg-surface px-3 py-0.5 text-xs font-medium text-muted-foreground shadow-xs">
      {label}
    </span>
  </div>
);

const resolveDirection = (payload) =>
  typeof payload?.direction === 'string' ? payload.direction.toLowerCase() : 'inbound';

const resolveAuthorKey = (payload, author) => {
  const direction = resolveDirection(payload);
  if (direction === 'outbound') {
    return `outbound|${author?.key ?? 'team'}`;
  }
  return 'inbound|contact';
};

const toTime = (entry) => (entry?.date instanceof Date ? entry.date.getTime() : null);

const TimelineSkeleton = () => (
  <div className="flex flex-col gap-3 py-2" aria-hidden>
    {[
      { side: 'start', width: 'w-56' },
      { side: 'start', width: 'w-40' },
      { side: 'end', width: 'w-64' },
      { side: 'start', width: 'w-48' },
      { side: 'end', width: 'w-36' },
    ].map((item, index) => (
      <div key={index} className={cn('flex', item.side === 'end' ? 'justify-end' : 'justify-start')}>
        <Skeleton className={cn('h-10 rounded-2xl bg-surface-sunken', item.width)} />
      </div>
    ))}
  </div>
);

const TypingBubble = ({ agents }) => {
  const label = `${agents[0]?.userName ?? 'Alguém da equipe'} digitando…`;
  return (
    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-bubble-in px-3 py-2">
        <span className="size-1.5 animate-bounce rounded-full bg-subtle-foreground [animation-delay:-0.2s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-subtle-foreground [animation-delay:-0.1s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-subtle-foreground" />
      </span>
      <span>{label}</span>
    </div>
  );
};

/**
 * Linha do tempo da conversa: divisores de dia, mensagens agrupadas por autor,
 * notas internas e eventos. Estados de carregamento, erro e vazio incluídos.
 */
export const MessageTimeline = ({
  items = [],
  loading = false,
  hasMore = false,
  onLoadMore,
  typingAgents = [],
  isInitialLoading = false,
  error = null,
  onRetry,
  emptyTitle = 'Nenhuma mensagem ainda',
  emptyDescription = 'Escreva abaixo para começar a conversa.',
  currentUser = null,
}) => {
  if (isInitialLoading && items.length === 0) {
    return (
      <div role="status" aria-label="Carregando mensagens">
        <TimelineSkeleton />
      </div>
    );
  }

  if (error && items.length === 0) {
    return <ErrorState size="compact" title="Não foi possível carregar as mensagens" error={error} onRetry={onRetry} />;
  }

  const hasContent = items.some((entry) => entry.type !== 'divider');

  return (
    <div className="relative flex min-h-full flex-col" role="log" aria-live="polite" aria-relevant="additions" aria-label="Mensagens">
      {hasMore ? (
        <div className="flex justify-center pb-2">
          <Button type="button" variant="ghost" size="xs" onClick={() => onLoadMore?.()} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {loading ? 'Carregando…' : 'Carregar mensagens anteriores'}
          </Button>
        </div>
      ) : null}

      {!hasContent ? (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState icon={MessageSquareDashed} size="compact" title={emptyTitle} description={emptyDescription} />
        </div>
      ) : null}

      {items.map((entry, index) => {
        if (entry.type === 'divider') {
          return <DayDivider key={entry.id} label={entry.label} />;
        }

        if (entry.type === 'message') {
          const payload = entry.payload ?? {};
          const author = resolveMessageAuthor(payload, currentUser);
          const previousEntry = index > 0 ? items[index - 1] : null;
          const nextEntry = index < items.length - 1 ? items[index + 1] : null;
          const currentKey = resolveAuthorKey(payload, author);
          const previousKey =
            previousEntry?.type === 'message'
              ? resolveAuthorKey(previousEntry.payload, resolveMessageAuthor(previousEntry.payload, currentUser))
              : null;
          const nextKey =
            nextEntry?.type === 'message'
              ? resolveAuthorKey(nextEntry.payload, resolveMessageAuthor(nextEntry.payload, currentUser))
              : null;
          const currentTime = toTime(entry);
          const closeToPrevious =
            previousKey === currentKey &&
            (currentTime === null || toTime(previousEntry) === null || currentTime - toTime(previousEntry) <= GROUP_WINDOW_MS);
          const closeToNext =
            nextKey === currentKey &&
            (currentTime === null || toTime(nextEntry) === null || toTime(nextEntry) - currentTime <= GROUP_WINDOW_MS);

          return (
            <MessageBubble
              key={entry.id}
              message={payload}
              isContinuation={closeToPrevious}
              isTail={!closeToNext}
              isFirst={previousEntry?.type === 'divider' || !previousEntry}
              showMetadata={!closeToPrevious}
              authorLabel={author?.label ?? null}
            />
          );
        }

        if (entry.type === 'note') {
          return <NoteCard key={entry.id} entry={entry} currentUser={currentUser} />;
        }

        return <EventCard key={entry.id} entry={entry} />;
      })}

      {typingAgents.length > 0 ? <TypingBubble agents={typingAgents} /> : null}
    </div>
  );
};

export default MessageTimeline;
