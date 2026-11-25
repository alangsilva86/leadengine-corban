import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table.jsx';
import { cn } from '@/lib/utils.js';
import LeadTableRow from './LeadTableRow';
import type { LeadSummary } from '../../state/leads';
import { formatCount, toDate } from '../../utils/labels';
import { getLeadStageOrder } from '../../utils/lead-stage';

type SortKey = 'name' | 'stage' | 'lastActivityAt' | 'potentialValue';
type SortState = { key: SortKey; direction: 'asc' | 'desc' } | null;

const HEAD = 'h-10 bg-surface-sunken text-xs font-medium text-muted-foreground';

const compare = (a: LeadSummary, b: LeadSummary, key: SortKey) => {
  switch (key) {
    case 'name':
      return a.name.localeCompare(b.name, 'pt-BR');
    case 'stage':
      return getLeadStageOrder(a.stage) - getLeadStageOrder(b.stage);
    case 'potentialValue':
      return (a.potentialValue ?? 0) - (b.potentialValue ?? 0);
    case 'lastActivityAt':
      return (toDate(a.lastActivityAt)?.getTime() ?? 0) - (toDate(b.lastActivityAt)?.getTime() ?? 0);
    default:
      return 0;
  }
};

const SortHead = ({
  label,
  sortKey,
  sort,
  onSort,
  className,
  align = 'left',
}: {
  label: string;
  sortKey: SortKey;
  sort: SortState;
  onSort: (key: SortKey) => void;
  className?: string;
  align?: 'left' | 'right';
}) => {
  const direction = sort?.key === sortKey ? sort.direction : null;
  const Icon = direction === 'asc' ? ArrowUp : direction === 'desc' ? ArrowDown : ArrowUpDown;
  return (
    <TableHead
      className={cn(HEAD, align === 'right' && 'text-right', className)}
      aria-sort={direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          'inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          align === 'right' ? '-mr-1 flex-row-reverse' : '-ml-1'
        )}
      >
        {label}
        <Icon className="size-3.5" aria-hidden="true" />
      </button>
    </TableHead>
  );
};

type LeadTableProps = {
  leads: LeadSummary[];
  onOpenDrawer: (leadId: string) => void;
  fetchNextPage?: () => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  isLoading?: boolean;
  total?: number | null;
};

/**
 * Lista de leads (shadcn Table) com cabeçalho fixo e ordenação.
 * A ordenação vale para os leads já carregados; "Carregar mais" busca a próxima página.
 */
const LeadTable = ({
  leads,
  onOpenDrawer,
  fetchNextPage,
  hasNextPage = false,
  isFetchingNextPage = false,
  isLoading = false,
  total = null,
}: LeadTableProps) => {
  const [sort, setSort] = useState<SortState>(null);

  const rows = useMemo(() => {
    if (!sort) return leads;
    const sorted = [...leads].sort((a, b) => compare(a, b, sort.key));
    return sort.direction === 'desc' ? sorted.reverse() : sorted;
  }, [leads, sort]);

  const handleSort = (key: SortKey) => {
    setSort((current) => {
      if (!current || current.key !== key) return { key, direction: key === 'name' || key === 'stage' ? 'asc' : 'desc' };
      if (current.direction === (key === 'name' || key === 'stage' ? 'asc' : 'desc')) {
        return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
      }
      return null;
    });
  };

  return (
    <div className="rounded-lg border border-border bg-surface">
      <table data-slot="table" className="w-full caption-bottom text-sm">
        <caption className="sr-only">Leads do funil</caption>
        <TableHeader className="sticky top-0 z-10 [&_tr]:border-border">
          <TableRow className="hover:bg-transparent">
            <SortHead label="Lead" sortKey="name" sort={sort} onSort={handleSort} className="rounded-tl-lg pl-4" />
            <SortHead label="Etapa" sortKey="stage" sort={sort} onSort={handleSort} />
            <TableHead className={cn(HEAD, 'hidden md:table-cell')}>Origem</TableHead>
            <TableHead className={cn(HEAD, 'hidden lg:table-cell')}>Responsável</TableHead>
            <SortHead label="Última atividade" sortKey="lastActivityAt" sort={sort} onSort={handleSort} className="hidden sm:table-cell" />
            <SortHead label="Valor" sortKey="potentialValue" sort={sort} onSort={handleSort} align="right" />
            <TableHead className={cn(HEAD, 'w-12 rounded-tr-lg')}>
              <span className="sr-only">Conversa</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && leads.length === 0
            ? Array.from({ length: 6 }).map((_, index) => (
                <TableRow key={index} className="border-border hover:bg-transparent">
                  <TableCell className="py-3 pl-4">
                    <Skeleton className="h-4 w-40" />
                  </TableCell>
                  <TableCell className="py-3">
                    <Skeleton className="h-5 w-24 rounded-full" />
                  </TableCell>
                  <TableCell className="hidden py-3 md:table-cell">
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell className="hidden py-3 lg:table-cell">
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell className="hidden py-3 sm:table-cell">
                    <Skeleton className="h-4 w-14" />
                  </TableCell>
                  <TableCell className="py-3">
                    <Skeleton className="ml-auto h-4 w-16" />
                  </TableCell>
                  <TableCell className="py-3" />
                </TableRow>
              ))
            : rows.map((lead) => <LeadTableRow key={lead.id} lead={lead} onOpenDrawer={onOpenDrawer} />)}
        </TableBody>
      </table>
      {!isLoading || leads.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
          <span className="tabular-nums">
            {typeof total === 'number'
              ? `Mostrando ${formatCount(leads.length)} de ${formatCount(total)}`
              : `${formatCount(leads.length)} leads`}
            {sort && hasNextPage ? ' · ordenação aplicada aos leads carregados' : ''}
          </span>
          {hasNextPage ? (
            <Button type="button" variant="outline" size="sm" onClick={() => fetchNextPage?.()} disabled={isFetchingNextPage}>
              {isFetchingNextPage ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              {isFetchingNextPage ? 'Carregando…' : 'Carregar mais'}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default LeadTable;
