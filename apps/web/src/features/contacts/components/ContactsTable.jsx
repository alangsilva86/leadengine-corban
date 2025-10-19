import { Virtuoso } from 'react-virtuoso';
import { forwardRef } from 'react';
import ContactRow from './ContactRow.jsx';

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

    return (
      <div className="h-full min-h-[480px] rounded-xl border border-border bg-background" ref={ref}>
        <div className="grid grid-cols-[auto,1fr,200px] gap-4 border-b border-border/60 bg-muted/50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <span className="pl-8">Contato</span>
          <span>Tags</span>
          <span className="text-right">Ações</span>
        </div>
        <Virtuoso
          data={data}
          style={{ height: 'calc(100% - 40px)' }}
          endReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              fetchNextPage?.();
            }
          }}
          overscan={200}
          itemContent={(index, contact) => (
            <ContactRow
              contact={contact}
              selected={selectedIds.has(contact.id)}
              onToggle={() => onToggle?.(contact.id)}
              onOpenDetails={() => onOpenDetails?.(contact)}
              onTriggerWhatsApp={() => onTriggerWhatsApp?.(contact)}
              onCreateTask={() => onCreateTask?.(contact)}
            />
          )}
          components={{
            Footer: () => (
              <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                {isLoading
                  ? 'Carregando contatos…'
                  : hasNextPage
                    ? isFetchingNextPage
                      ? 'Carregando mais contatos…'
                      : 'Role para carregar mais contatos'
                    : data.length === 0
                      ? 'Nenhum contato encontrado'
                      : 'Fim da lista'}
              </div>
            ),
          }}
        />
      </div>
    );
  }
);

ContactsTable.displayName = 'ContactsTable';

export default ContactsTable;
