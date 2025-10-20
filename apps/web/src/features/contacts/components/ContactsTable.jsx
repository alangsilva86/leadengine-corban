import { forwardRef } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { Users } from 'lucide-react';

import ContactRow from './ContactRow.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';

const ContactsTable = forwardRef(
  (
    {
      contacts,
      selectedIds,
      onToggle,
      onOpenDetails,
      onTriggerWhatsApp,
      onCreateTask,
      fetchNextPage,
      hasNextPage,
      isFetchingNextPage,
      isLoading,
    },
    ref
  ) => {
    const data = Array.isArray(contacts) ? contacts : [];
    const selectedSet = selectedIds instanceof Set ? selectedIds : new Set();
    const showSkeleton = isLoading && data.length === 0;
    const showEmpty = !isLoading && data.length === 0;

    return (
      <div
        className="flex h-full min-h-[520px] flex-col overflow-hidden rounded-xl border border-border bg-background"
        ref={ref}
      >
        <div className="grid grid-cols-1 gap-4 border-b border-border/60 bg-muted/60 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid-cols-[auto,minmax(0,1.2fr),minmax(0,220px),180px]">
          <span className="pl-8 md:pl-10">Contato</span>
          <span>Tags</span>
          <span className="hidden md:block">Engajamento</span>
          <span className="text-right">Ações</span>
        </div>
        {showSkeleton ? (
          <div className="flex-1 space-y-3 overflow-hidden px-4 py-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-28 w-full rounded-lg" />
            ))}
          </div>
        ) : showEmpty ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center text-sm text-muted-foreground">
            <Users className="h-10 w-10 text-muted-foreground/70" />
            <p>Nenhum contato encontrado com os filtros atuais.</p>
            <p className="text-xs">
              Ajuste os filtros ou cadastre um novo contato para começar a trabalhar sua base.
            </p>
          </div>
        ) : (
          <div className="flex-1">
            <Virtuoso
              data={data}
              style={{ height: '100%' }}
              endReached={() => {
                if (hasNextPage && !isFetchingNextPage) {
                  fetchNextPage?.();
                }
              }}
              overscan={200}
              itemKey={(index, contact) => contact.id ?? index}
              itemContent={(index, contact) => (
                <ContactRow
                  contact={contact}
                  selected={selectedSet.has(contact.id)}
                  onToggle={() => onToggle?.(contact.id)}
                  onOpenDetails={() => onOpenDetails?.(contact)}
                  onTriggerWhatsApp={() => onTriggerWhatsApp?.(contact)}
                  onCreateTask={() => onCreateTask?.(contact)}
                />
              )}
              components={{
                Footer: () => (
                  <div className="flex items-center justify-center px-4 py-4 text-xs text-muted-foreground">
                    {hasNextPage
                      ? isFetchingNextPage
                        ? 'Carregando mais contatos…'
                        : 'Role para carregar mais contatos'
                      : 'Fim da lista'}
                  </div>
                ),
              }}
            />
          </div>
        )}
      </div>
    );
  }
);

ContactsTable.displayName = 'ContactsTable';

export default ContactsTable;
