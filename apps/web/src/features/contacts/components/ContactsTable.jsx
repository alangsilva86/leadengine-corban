import { ArrowDown, ArrowUp, ArrowUpDown, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table.jsx';
import { formatCount } from '@/features/crm/utils/labels';
import ContactRow from './ContactRow.jsx';

const HEAD_CLASS = 'h-10 bg-surface-sunken text-xs font-medium text-muted-foreground';

const SortableHead = ({ label, field, sort, onSortChange, className }) => {
  const active = sort?.sortBy === field;
  const direction = active ? sort.sortOrder : null;
  const Icon = direction === 'asc' ? ArrowUp : direction === 'desc' ? ArrowDown : ArrowUpDown;
  const nextOrder = direction === 'asc' ? 'desc' : direction === 'desc' ? null : 'asc';

  return (
    <TableHead
      className={`${HEAD_CLASS} ${className ?? ''}`}
      aria-sort={direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none'}
    >
      <button
        type="button"
        className="-ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => onSortChange?.(nextOrder ? { sortBy: field, sortOrder: nextOrder } : null)}
      >
        {label}
        <Icon className="size-3.5" aria-hidden="true" />
      </button>
    </TableHead>
  );
};

const SkeletonRows = ({ count = 8 }) =>
  Array.from({ length: count }).map((_, index) => (
    <TableRow key={index} className="border-border hover:bg-transparent">
      <TableCell className="w-10 py-3 pl-4 pr-0">
        <Skeleton className="size-4 rounded" />
      </TableCell>
      <TableCell className="py-3">
        <div className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden py-3 md:table-cell">
        <Skeleton className="h-5 w-24 rounded-full" />
      </TableCell>
      <TableCell className="hidden py-3 lg:table-cell">
        <Skeleton className="h-3.5 w-24" />
      </TableCell>
      <TableCell className="hidden py-3 sm:table-cell">
        <Skeleton className="h-3.5 w-16" />
      </TableCell>
      <TableCell className="hidden py-3 lg:table-cell">
        <Skeleton className="h-5 w-20 rounded-full" />
      </TableCell>
      <TableCell className="py-3" />
    </TableRow>
  ));

/**
 * Tabela de contatos (shadcn Table). Cabeçalho fixo durante a rolagem da página,
 * seleção com "selecionar todos" e paginação incremental por botão.
 */
const ContactsTable = ({
  contacts,
  leadIndex,
  leadIndexReady = false,
  selectedIds,
  onToggle,
  onToggleAll,
  sort,
  onSortChange,
  onOpenDetails,
  onOpenConversation,
  onCreateTask,
  onEdit,
  fetchNextPage,
  hasNextPage = false,
  isFetchingNextPage = false,
  isLoading = false,
  totalCount,
  emptyState = null,
}) => {
  const data = Array.isArray(contacts) ? contacts : [];
  const selectedSet = selectedIds instanceof Set ? selectedIds : new Set();
  const selectedVisible = data.filter((contact) => selectedSet.has(contact.id)).length;
  const allSelected = data.length > 0 && selectedVisible === data.length;
  const headerChecked = allSelected ? true : selectedVisible > 0 ? 'indeterminate' : false;
  const showSkeleton = isLoading && data.length === 0;

  if (!showSkeleton && data.length === 0) {
    return <div className="rounded-lg border border-border bg-surface">{emptyState}</div>;
  }

  return (
    <div className="rounded-lg border border-border bg-surface">
      <table data-slot="table" className="w-full caption-bottom text-sm">
        <caption className="sr-only">Lista de contatos</caption>
        <TableHeader className="sticky top-0 z-10 [&_tr]:border-border">
          <TableRow className="hover:bg-transparent">
            <TableHead className={`${HEAD_CLASS} w-10 rounded-tl-lg pl-4 pr-0`}>
              <Checkbox
                checked={headerChecked}
                disabled={data.length === 0}
                onCheckedChange={() => onToggleAll?.(!allSelected)}
                aria-label={allSelected ? 'Desmarcar todos os contatos' : 'Selecionar todos os contatos carregados'}
              />
            </TableHead>
            <SortableHead label="Contato" field="name" sort={sort} onSortChange={onSortChange} />
            <TableHead className={`${HEAD_CLASS} hidden md:table-cell`}>Lead</TableHead>
            <TableHead className={`${HEAD_CLASS} hidden lg:table-cell`}>Responsável</TableHead>
            <TableHead className={`${HEAD_CLASS} hidden sm:table-cell`}>Última interação</TableHead>
            <TableHead className={`${HEAD_CLASS} hidden lg:table-cell`}>Tags</TableHead>
            <TableHead className={`${HEAD_CLASS} w-12 rounded-tr-lg`}>
              <span className="sr-only">Ações</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {showSkeleton ? (
            <SkeletonRows />
          ) : (
            data.map((contact) => (
              <ContactRow
                key={contact.id}
                contact={contact}
                lead={leadIndex?.get?.(contact.id) ?? null}
                leadIndexReady={leadIndexReady}
                selected={selectedSet.has(contact.id)}
                onToggle={onToggle}
                onOpenDetails={onOpenDetails}
                onOpenConversation={onOpenConversation}
                onCreateTask={onCreateTask}
                onEdit={onEdit}
              />
            ))
          )}
        </TableBody>
      </table>
      {!showSkeleton ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
          <span className="tabular-nums">
            {typeof totalCount === 'number'
              ? `Mostrando ${formatCount(data.length)} de ${formatCount(totalCount)}`
              : `${formatCount(data.length)} carregados`}
          </span>
          {hasNextPage ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fetchNextPage?.()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              {isFetchingNextPage ? 'Carregando…' : 'Carregar mais'}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default ContactsTable;
