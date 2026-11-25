import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table.jsx';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group.jsx';
import { cn } from '@/lib/utils.js';

import NumberActionsMenu, { type NumberAction } from './NumberActionsMenu';
import NumberStatusBadge from './NumberStatusBadge';
import type { WhatsAppNumber } from '../../hooks/useWhatsAppNumbers';

/** Filtros só aparecem quando a lista passa deste tamanho. */
const FILTERS_THRESHOLD = 5;

type StatusFilter = 'all' | 'connected' | 'attention';

const formatCount = (value: number | null) =>
  typeof value === 'number' ? new Intl.NumberFormat('pt-BR').format(value) : '—';

interface NumbersListProps {
  numbers: WhatsAppNumber[];
  busyNumberId?: string | null;
  onAction: (action: NumberAction, number: WhatsAppNumber) => void;
}

const PrimaryAction = ({
  number,
  onAction,
  disabled,
  className,
}: {
  number: WhatsAppNumber;
  onAction: NumbersListProps['onAction'];
  disabled?: boolean;
  className?: string;
}) => {
  const { status } = number;
  if (!status.actionLabel || number.isSessionOnly) {
    return null;
  }
  const isDetails = status.action === 'details';
  return (
    <Button
      type="button"
      size="sm"
      variant={isDetails ? 'ghost' : 'outline'}
      className={className}
      disabled={disabled}
      onClick={() => onAction(isDetails ? 'details' : 'connect', number)}
    >
      {status.actionLabel}
    </Button>
  );
};

const NumbersList = ({ numbers, busyNumberId = null, onAction }: NumbersListProps) => {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const showFilters = numbers.length > FILTERS_THRESHOLD;

  const visible = useMemo(() => {
    if (!showFilters) return numbers;
    const normalized = query.trim().toLowerCase();
    const digits = normalized.replace(/\D/g, '');
    return numbers.filter((number) => {
      if (statusFilter === 'connected' && !number.status.isConnected) return false;
      if (statusFilter === 'attention' && !number.status.needsAttention) return false;
      if (!normalized) return true;
      return (
        number.name.toLowerCase().includes(normalized) ||
        (digits.length > 0 && (number.phone ?? '').replace(/\D/g, '').includes(digits))
      );
    });
  }, [numbers, query, showFilters, statusFilter]);

  return (
    <section aria-label="Números de WhatsApp" className="overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
      {showFilters ? (
        <div className="flex flex-col gap-3 border-b border-border p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nome ou número"
              aria-label="Buscar números"
              className="pl-8"
            />
          </div>
          <ToggleGroup
            type="single"
            value={statusFilter}
            onValueChange={(value: string) => setStatusFilter((value as StatusFilter) || 'all')}
            aria-label="Filtrar por status"
            className="w-full sm:w-auto"
          >
            <ToggleGroupItem value="all" className="flex-1 px-3 sm:flex-none">Todos</ToggleGroupItem>
            <ToggleGroupItem value="connected" className="flex-1 px-3 sm:flex-none">Conectados</ToggleGroupItem>
            <ToggleGroupItem value="attention" className="flex-1 px-3 sm:flex-none">Precisam de atenção</ToggleGroupItem>
          </ToggleGroup>
        </div>
      ) : null}

      {visible.length === 0 ? (
        <div className="px-6 py-10 text-center text-sm text-muted-foreground">
          Nenhum número encontrado com esses filtros.
          <Button
            type="button"
            variant="link"
            size="sm"
            className="ml-1"
            onClick={() => {
              setQuery('');
              setStatusFilter('all');
            }}
          >
            Limpar filtros
          </Button>
        </div>
      ) : (
        <>
          {/* Desktop: tabela */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-5">Nome</TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Enviadas</TableHead>
                  <TableHead>Última atividade</TableHead>
                  <TableHead className="pr-5 text-right">
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((number) => {
                  const busy = busyNumberId === number.id;
                  return (
                    <TableRow key={number.id} className={cn(busy && 'opacity-60')}>
                      <TableCell className="pl-5 font-medium text-foreground">
                        <button
                          type="button"
                          className="max-w-[16rem] truncate text-left hover:underline focus-visible:underline focus-visible:outline-none"
                          onClick={() => onAction('details', number)}
                        >
                          {number.name}
                        </button>
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {number.phone ?? <span className="text-subtle-foreground">Ainda não pareado</span>}
                      </TableCell>
                      <TableCell>
                        <NumberStatusBadge status={number.status} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatCount(number.sentCount)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{number.lastActivityLabel ?? '—'}</TableCell>
                      <TableCell className="pr-5">
                        <div className="flex items-center justify-end gap-1">
                          <PrimaryAction number={number} onAction={onAction} disabled={busy} />
                          <NumberActionsMenu number={number} onAction={onAction} disabled={busy} />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile: cartões */}
          <ul className="divide-y divide-border md:hidden">
            {visible.map((number) => {
              const busy = busyNumberId === number.id;
              return (
                <li key={number.id} className={cn('space-y-3 p-4', busy && 'opacity-60')}>
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      className="min-w-0 space-y-0.5 text-left focus-visible:outline-none"
                      onClick={() => onAction('details', number)}
                    >
                      <p className="truncate font-medium text-foreground">{number.name}</p>
                      <p className="text-sm tabular-nums text-muted-foreground">{number.phone ?? 'Ainda não pareado'}</p>
                    </button>
                    <NumberActionsMenu number={number} onAction={onAction} disabled={busy} />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <NumberStatusBadge status={number.status} />
                    <span className="text-xs text-muted-foreground">
                      {number.lastActivityLabel ? `Ativo ${number.lastActivityLabel}` : null}
                    </span>
                  </div>
                  {number.status.action && number.status.action !== 'details' ? (
                    <PrimaryAction number={number} onAction={onAction} disabled={busy} className="w-full" />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
};

export default NumbersList;
