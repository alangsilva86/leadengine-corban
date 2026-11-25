import { useMemo } from 'react';
import { GitMerge, ListFilter, RefreshCw, Search, Tag, X } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import { cn } from '@/lib/utils.js';
import { formatCount } from '@/features/crm/utils/labels';

export const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'ACTIVE', label: 'Ativos' },
  { value: 'INACTIVE', label: 'Inativos' },
  { value: 'ARCHIVED', label: 'Arquivados' },
];

const QUICK_FILTERS = [
  { id: 'hasWhatsapp', label: 'Com WhatsApp' },
  { id: 'isBlocked', label: 'Bloqueados' },
];

export const EMPTY_CONTACT_FILTERS = { status: 'all', tags: [], isBlocked: undefined, hasWhatsapp: undefined };

export const countActiveFilters = (filters) =>
  (filters.status && filters.status !== 'all' ? 1 : 0) +
  (Array.isArray(filters.tags) ? filters.tags.length : 0) +
  (filters.isBlocked ? 1 : 0) +
  (filters.hasWhatsapp ? 1 : 0);

const ContactsToolbar = ({
  searchValue,
  onSearchChange,
  filters,
  onFiltersChange,
  onRefresh,
  isRefreshing = false,
  availableTags = [],
  selectedCount = 0,
  onClearSelection,
  onAddTag,
  onMerge,
  canMerge = false,
  isBulkProcessing = false,
}) => {
  const activeFilters = useMemo(() => {
    const chips = [];
    if (filters.status && filters.status !== 'all') {
      const option = STATUS_OPTIONS.find((entry) => entry.value === filters.status);
      if (option) chips.push({ id: 'status', label: `Status: ${option.label}` });
    }
    (filters.tags ?? []).forEach((tag) => chips.push({ id: `tag:${tag}`, label: `Tag: ${tag}` }));
    QUICK_FILTERS.forEach((entry) => {
      if (filters[entry.id]) chips.push({ id: entry.id, label: entry.label });
    });
    return chips;
  }, [filters]);

  const activeCount = countActiveFilters(filters);

  const toggleTag = (tag) => {
    const current = Array.isArray(filters.tags) ? filters.tags : [];
    onFiltersChange?.({
      ...filters,
      tags: current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag],
    });
  };

  const removeChip = (chipId) => {
    if (chipId === 'status') {
      onFiltersChange?.({ ...filters, status: 'all' });
    } else if (chipId.startsWith('tag:')) {
      toggleTag(chipId.slice(4));
    } else {
      onFiltersChange?.({ ...filters, [chipId]: undefined });
    }
  };

  const reset = () => onFiltersChange?.({ ...EMPTY_CONTACT_FILTERS });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={searchValue}
            onChange={(event) => onSearchChange?.(event.target.value)}
            placeholder="Buscar por nome, telefone ou e-mail"
            className="h-9 bg-surface pl-9 pr-9"
            aria-label="Buscar contatos"
          />
          {searchValue ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground"
              onClick={() => onSearchChange?.('')}
              aria-label="Limpar busca"
            >
              <X />
            </Button>
          ) : null}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" className="gap-2">
              <ListFilter aria-hidden="true" />
              Filtros
              {activeCount > 0 ? (
                <Badge variant="primary" className="h-5 min-w-5 px-1.5 tabular-nums">
                  {activeCount}
                </Badge>
              ) : null}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60">
            <DropdownMenuLabel>Status</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={filters.status ?? 'all'}
              onValueChange={(value) => onFiltersChange?.({ ...filters, status: value })}
            >
              {STATUS_OPTIONS.map((option) => (
                <DropdownMenuRadioItem key={option.value} value={option.value} onSelect={(event) => event.preventDefault()}>
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Canal e bloqueio</DropdownMenuLabel>
            {QUICK_FILTERS.map((entry) => (
              <DropdownMenuCheckboxItem
                key={entry.id}
                checked={Boolean(filters[entry.id])}
                onSelect={(event) => event.preventDefault()}
                onCheckedChange={(checked) => onFiltersChange?.({ ...filters, [entry.id]: checked ? true : undefined })}
              >
                {entry.label}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Tags</DropdownMenuLabel>
            <div className="max-h-56 overflow-y-auto">
              {availableTags.length === 0 ? (
                <p className="px-2 py-1.5 text-sm text-muted-foreground">Nenhuma tag cadastrada.</p>
              ) : (
                availableTags.map(({ tag, count }) => (
                  <DropdownMenuCheckboxItem
                    key={tag}
                    checked={(filters.tags ?? []).includes(tag)}
                    onSelect={(event) => event.preventDefault()}
                    onCheckedChange={() => toggleTag(tag)}
                  >
                    <span className="flex-1 truncate">{tag}</span>
                    {typeof count === 'number' ? (
                      <span className="ml-2 text-xs text-muted-foreground tabular-nums">{formatCount(count)}</span>
                    ) : null}
                  </DropdownMenuCheckboxItem>
                ))
              )}
            </div>
            {activeCount > 0 ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={reset}>Limpar filtros</DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onRefresh}
              disabled={isRefreshing}
              aria-label="Atualizar lista"
              className="text-muted-foreground"
            >
              <RefreshCw className={cn(isRefreshing && 'animate-spin')} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Atualizar lista</TooltipContent>
        </Tooltip>
      </div>

      {activeFilters.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {activeFilters.map((chip) => (
            <Badge key={chip.id} variant="secondary" className="gap-1 py-1 pl-2.5 pr-1 text-foreground">
              {chip.label}
              <button
                type="button"
                className="rounded-full p-0.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                onClick={() => removeChip(chip.id)}
                aria-label={`Remover filtro ${chip.label}`}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
          <Button type="button" variant="link" size="xs" onClick={reset} className="text-muted-foreground">
            Limpar tudo
          </Button>
        </div>
      ) : null}

      {selectedCount > 0 ? (
        <div
          role="region"
          aria-label="Ações para contatos selecionados"
          className="flex flex-wrap items-center gap-2 rounded-lg border border-primary-soft-border bg-primary-soft px-3 py-2 text-sm text-primary-soft-foreground"
        >
          <span className="font-medium tabular-nums">
            {selectedCount === 1 ? '1 contato selecionado' : `${formatCount(selectedCount)} contatos selecionados`}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onAddTag} disabled={isBulkProcessing}>
              <Tag aria-hidden="true" />
              Adicionar tag
            </Button>
            {canMerge ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onMerge}
                disabled={isBulkProcessing || selectedCount < 2}
                title={selectedCount < 2 ? 'Selecione ao menos 2 contatos duplicados' : undefined}
              >
                <GitMerge aria-hidden="true" />
                Mesclar duplicados
              </Button>
            ) : null}
            <Button type="button" variant="ghost" size="sm" onClick={onClearSelection} disabled={isBulkProcessing}>
              Limpar seleção
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ContactsToolbar;
