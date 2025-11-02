import { forwardRef, useMemo } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { Inbox } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import LeadTableRow from './LeadTableRow';
import type { LeadSummary } from '../../state/leads';

const LeadTable = forwardRef<HTMLDivElement, {
  leads: LeadSummary[];
  selectedIds: Set<string>;
  onToggleSelect: (leadId: string) => void;
  onOpenDrawer: (leadId: string) => void;
  fetchNextPage?: () => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  isLoading?: boolean;
  selectable?: boolean;
}>(
  (
    {
      leads,
      selectedIds,
      onToggleSelect,
      onOpenDrawer,
      fetchNextPage,
      hasNextPage = false,
      isFetchingNextPage = false,
      isLoading = false,
      selectable = true,
    },
    ref
  ) => {
    const data = useMemo(() => leads ?? [], [leads]);
    const selectedSet = selectedIds instanceof Set ? selectedIds : new Set();
    const empty = !isLoading && data.length === 0;

    return (
      <div ref={ref} className="flex h-full min-h-[520px] flex-col overflow-hidden rounded-xl border border-border bg-background">
        <div className="grid grid-cols-[32px,minmax(0,1.4fr),minmax(0,1fr),minmax(0,0.9fr),minmax(0,1fr),minmax(0,140px)] gap-3 border-b border-border/60 bg-muted/60 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span />
          <span>Lead</span>
          <span>Etapa / Origem</span>
          <span>Canal</span>
          <span>Última atividade</span>
          <span className="text-right">Potencial</span>
        </div>
        {isLoading && data.length === 0 ? (
          <div className="flex-1 space-y-3 overflow-hidden px-4 py-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ) : empty ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center text-sm text-muted-foreground">
            <Inbox className="h-10 w-10 text-muted-foreground/70" />
            <p>Nenhum lead encontrado com os filtros atuais.</p>
            <p className="text-xs">
              Ajuste filtros ou importe novos leads para continuar trabalhando seu funil.
            </p>
          </div>
        ) : (
          <div className="flex-1">
            <Virtuoso
              data={data}
              style={{ height: '100%' }}
              overscan={200}
              endReached={() => {
                if (hasNextPage && !isFetchingNextPage) {
                  fetchNextPage?.();
                }
              }}
              itemKey={(index, lead) => lead.id ?? String(index)}
              itemContent={(index, lead) => (
                <LeadTableRow
                  lead={lead}
                  selected={selectedSet.has(lead.id)}
                  onToggleSelect={onToggleSelect}
                  onOpenDrawer={onOpenDrawer}
                  selectable={selectable}
                />
              )}
              components={{
                Footer: () => (
                  <div className="flex items-center justify-center px-4 py-4 text-xs text-muted-foreground">
                    {hasNextPage
                      ? isFetchingNextPage
                        ? 'Carregando mais leads…'
                        : 'Role para carregar mais leads'
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

LeadTable.displayName = 'LeadTable';

export default LeadTable;
