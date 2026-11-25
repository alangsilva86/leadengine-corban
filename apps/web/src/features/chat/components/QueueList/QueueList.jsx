import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Inbox, Loader2, MessageSquarePlus, SearchX, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { EmptyState, ErrorState } from '@/components/page';
import QueueListItem from './QueueListItem.jsx';

const ITEM_SELECTOR = '[data-queue-item]';
const NEXT_KEYS = new Set(['ArrowDown', 'j', 'J']);
const PREVIOUS_KEYS = new Set(['ArrowUp', 'k', 'K']);

const useMinuteClock = () => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(interval);
  }, []);
  return now;
};

const ListSkeleton = () => (
  <div aria-hidden className="flex flex-col">
    {Array.from({ length: 7 }).map((_, index) => (
      <div key={index} className="flex items-start gap-3 border-b border-border px-3 py-3">
        <Skeleton className="size-9 rounded-full bg-surface-sunken" />
        <div className="flex flex-1 flex-col gap-2 pt-0.5">
          <div className="flex items-center justify-between gap-6">
            <Skeleton className="h-3.5 w-2/5 bg-surface-sunken" />
            <Skeleton className="h-3 w-8 bg-surface-sunken" />
          </div>
          <Skeleton className="h-3 w-4/5 bg-surface-sunken" />
          <Skeleton className="h-3 w-3/5 bg-surface-sunken" />
        </div>
      </div>
    ))}
  </div>
);

const QueueMissingNotice = ({ compact = false }) => (
  <EmptyState
    icon={Settings2}
    size={compact ? 'compact' : 'default'}
    title="Nenhuma fila ativa"
    description="Crie uma fila para começar a receber mensagens."
    className={compact ? 'border-b border-border bg-warning-soft' : undefined}
    action={
      <Button asChild size="sm" variant="outline">
        <a href="/settings">Abrir configurações</a>
      </Button>
    }
  />
);

const QueueList = ({
  tickets = [],
  selectedTicketId,
  selectedTicketIds = [],
  onSelectTicket,
  onToggleTicketSelection,
  onClearSelection,
  isInitialLoading = false,
  error = null,
  onRetry,
  typingAgents = [],
  currentUser = null,
  total,
  loadedCount,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  hasActiveFilters = false,
  onClearFilters,
  queueMissing = false,
  contactLink = null,
  onBulkRegisterLoss,
  bulkActionPending = false,
  bulkActionsDisabled = false,
}) => {
  const listRef = useRef(null);
  const now = useMinuteClock();
  const typingTicketIds = useMemo(
    () => new Set((typingAgents ?? []).map((agent) => agent?.ticketId).filter(Boolean)),
    [typingAgents],
  );
  const selectionCount = Array.isArray(selectedTicketIds) ? selectedTicketIds.length : 0;
  const selectionMode = selectionCount > 0;
  const selectionLabel = selectionCount === 1 ? '1 conversa selecionada' : `${selectionCount} conversas selecionadas`;

  // ↑/↓ (ou J/K) movem o foco entre conversas; Enter abre.
  const handleItemKeyDown = useCallback((event) => {
    const isNext = NEXT_KEYS.has(event.key);
    const isPrevious = PREVIOUS_KEYS.has(event.key);
    if ((!isNext && !isPrevious) || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    const container = listRef.current;
    if (!container) return;
    const items = Array.from(container.querySelectorAll(ITEM_SELECTOR));
    const index = items.indexOf(event.currentTarget);
    if (index === -1) return;
    const nextIndex = isNext ? Math.min(items.length - 1, index + 1) : Math.max(0, index - 1);
    event.preventDefault();
    items[nextIndex]?.focus();
    items[nextIndex]?.scrollIntoView?.({ block: 'nearest' });
  }, []);

  if (isInitialLoading && tickets.length === 0) {
    return (
      <div role="status" aria-label="Carregando conversas">
        <ListSkeleton />
      </div>
    );
  }

  if (error && tickets.length === 0) {
    return (
      <ErrorState
        size="compact"
        title="Não foi possível carregar as conversas"
        error={error}
        onRetry={onRetry}
      />
    );
  }

  // Link vindo do CRM/Contatos para um contato sem conversa: nada é enviado sozinho.
  if (contactLink && contactLink.status !== 'loading') {
    const name = contactLink.contactName ?? 'este contato';
    return (
      <EmptyState
        icon={contactLink.status === 'error' ? SearchX : MessageSquarePlus}
        size="compact"
        title={contactLink.status === 'error' ? 'Não foi possível abrir a conversa' : `Nenhuma conversa com ${name}`}
        description={
          contactLink.status === 'error'
            ? 'Procure o contato pelo nome ou telefone, ou veja todas as conversas.'
            : 'Inicie uma conversa no WhatsApp. Você escreve a primeira mensagem antes de enviar.'
        }
        action={
          contactLink.status !== 'error' && typeof contactLink.onStartConversation === 'function' ? (
            <Button type="button" size="sm" onClick={contactLink.onStartConversation}>
              Nova conversa
            </Button>
          ) : null
        }
        secondaryAction={
          <Button type="button" variant="ghost" size="sm" onClick={contactLink.onDismiss}>
            Ver todas as conversas
          </Button>
        }
      />
    );
  }

  const shownCount = typeof loadedCount === 'number' ? loadedCount : tickets.length;
  const totalCount = typeof total === 'number' ? Math.max(total, shownCount) : shownCount;

  return (
    <div className="flex min-h-0 flex-col">
      {selectionMode ? (
        <div className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-border bg-surface px-3 py-2 text-sm">
          <span className="font-medium text-foreground" aria-live="polite">
            {selectionLabel}
          </span>
          <div className="flex items-center gap-1.5">
            <Button type="button" variant="ghost" size="xs" onClick={() => onClearSelection?.()}>
              Limpar
            </Button>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => onBulkRegisterLoss?.()}
              disabled={bulkActionsDisabled || selectionCount === 0}
            >
              {bulkActionPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Registrar perda
            </Button>
          </div>
        </div>
      ) : null}

      {contactLink?.status === 'loading' ? (
        <p className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs text-muted-foreground" role="status">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          Abrindo a conversa do contato…
        </p>
      ) : null}
      {queueMissing ? <QueueMissingNotice compact={tickets.length > 0} /> : null}

      {tickets.length === 0 ? (
        queueMissing ? null : hasActiveFilters ? (
          <EmptyState
            icon={SearchX}
            size="compact"
            title="Nenhuma conversa encontrada"
            description="Tente outro nome ou telefone, ou limpe os filtros."
            action={
              onClearFilters ? (
                <Button type="button" variant="outline" size="sm" onClick={onClearFilters}>
                  Limpar filtros
                </Button>
              ) : null
            }
          />
        ) : (
          <EmptyState
            icon={Inbox}
            size="compact"
            title="Nenhuma conversa por aqui"
            description="Quando um cliente mandar mensagem no WhatsApp, a conversa aparece nesta lista."
          />
        )
      ) : (
        <ul ref={listRef} aria-label="Conversas" className="flex flex-col">
          {tickets.map((ticket) => (
            <QueueListItem
              key={ticket.id}
              ticket={ticket}
              typing={typingTicketIds.has(ticket.id)}
              selected={ticket.id === selectedTicketId}
              selectedForBulk={selectedTicketIds.includes(ticket.id)}
              selectionMode={selectionMode}
              currentUser={currentUser}
              now={now}
              onSelect={onSelectTicket}
              onToggleSelection={onToggleTicketSelection}
              onKeyDown={handleItemKeyDown}
            />
          ))}
        </ul>
      )}

      {tickets.length > 0 && (hasMore || totalCount > shownCount) ? (
        <div className="flex flex-col items-center gap-2 px-3 py-4 text-xs text-muted-foreground">
          <span>
            Mostrando {shownCount} de {totalCount}
          </span>
          {hasMore && typeof onLoadMore === 'function' ? (
            <Button type="button" variant="outline" size="sm" onClick={onLoadMore} disabled={isLoadingMore}>
              {isLoadingMore ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Carregar mais
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default QueueList;
