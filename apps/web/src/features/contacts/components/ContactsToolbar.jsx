import { useMemo } from 'react';
import { Filter, Plus, RefreshCw, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.jsx';
import { Badge } from '@/components/ui/badge.jsx';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'ACTIVE', label: 'Ativos' },
  { value: 'INACTIVE', label: 'Inativos' },
  { value: 'ARCHIVED', label: 'Arquivados' },
];

const QUICK_FILTERS = [
  { id: 'isBlocked', label: 'Bloqueados' },
  { id: 'hasWhatsapp', label: 'Com WhatsApp' },
];

const ContactsToolbar = ({
  searchValue,
  onSearchChange,
  filters,
  onFiltersChange,
  onClearFilters,
  selectedCount = 0,
  onClearSelection,
  onBulkAction,
  isBulkProcessing = false,
  onRefresh,
  isRefreshing = false,
  availableTags = [],
  totalCount,
  onCreateContact,
}) => {
  const activeFilters = useMemo(() => {
    const badges = [];

    if (filters.status && filters.status !== 'all') {
      const statusOption = STATUS_OPTIONS.find((option) => option.value === filters.status);
      if (statusOption) {
        badges.push({ id: `status:${filters.status}`, label: `Status: ${statusOption.label}` });
      }
    }

    if (Array.isArray(filters.tags) && filters.tags.length > 0) {
      filters.tags.forEach((tag) => {
        badges.push({ id: `tag:${tag}`, label: `Tag: ${tag}` });
      });
    }

    if (filters.isBlocked) {
      badges.push({ id: 'isBlocked', label: 'Bloqueados' });
    }

    if (filters.hasWhatsapp) {
      badges.push({ id: 'hasWhatsapp', label: 'Com WhatsApp' });
    }

    if (filters.ownerId) {
      badges.push({ id: 'owner', label: 'Com responsável' });
    }

    return badges;
  }, [filters]);

  const totalLabel = useMemo(() => {
    if (typeof totalCount !== 'number') {
      return null;
    }
    const formatted = new Intl.NumberFormat('pt-BR').format(totalCount);
    return `${formatted} ${totalCount === 1 ? 'contato' : 'contatos'}`;
  }, [totalCount]);

  const handleStatusChange = (status) => {
    onFiltersChange?.({ ...filters, status });
  };

  const handleTagToggle = (tag) => {
    const current = Array.isArray(filters.tags) ? [...filters.tags] : [];
    if (current.includes(tag)) {
      onFiltersChange?.({ ...filters, tags: current.filter((item) => item !== tag) });
    } else {
      onFiltersChange?.({ ...filters, tags: [...current, tag] });
    }
  };

  const handleQuickFilterToggle = (key, value) => {
    const isEnabled = value === true;
    onFiltersChange?.({
      ...filters,
      [key]: isEnabled ? true : undefined,
    });
  };

  const handleReset = () => {
    onFiltersChange?.({ status: 'all', tags: [], ownerId: null, isBlocked: undefined, hasWhatsapp: undefined });
    onClearFilters?.();
  };

  const hasFilters = activeFilters.length > 0;
  const hasSelection = selectedCount > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex flex-1 flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchValue}
              onChange={(event) => onSearchChange?.(event.target.value)}
              placeholder="Buscar por nome, telefone ou e-mail"
              className="h-9 w-full rounded-lg border border-border bg-background pl-9 text-sm shadow-none"
              aria-label="Buscar contatos"
            />
            {searchValue ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
                onClick={() => onSearchChange?.('')}
                aria-label="Limpar busca"
              >
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="icon" aria-label="Abrir filtros">
                <Filter className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Status</DropdownMenuLabel>
              {STATUS_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onSelect={() => handleStatusChange(option.value)}
                  className={filters.status === option.value ? 'bg-muted/70' : undefined}
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Tags</DropdownMenuLabel>
              {availableTags.length === 0 ? (
                <DropdownMenuItem disabled>Nenhuma tag disponível</DropdownMenuItem>
              ) : null}
              {availableTags.map((tag) => (
                <DropdownMenuCheckboxItem
                  key={tag}
                  checked={Array.isArray(filters.tags) && filters.tags.includes(tag)}
                  onCheckedChange={() => handleTagToggle(tag)}
                >
                  {tag}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Filtros rápidos</DropdownMenuLabel>
              {QUICK_FILTERS.map((filterOption) => (
                <DropdownMenuCheckboxItem
                  key={filterOption.id}
                  checked={Boolean(filters[filterOption.id])}
                  onCheckedChange={(checked) => handleQuickFilterToggle(filterOption.id, checked)}
                >
                  {filterOption.label}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={handleReset}>Limpar filtros</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="hidden lg:inline-flex"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label="Recarregar lista"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          {totalLabel ? <span className="text-xs text-muted-foreground">Exibindo {totalLabel}</span> : null}
        </div>
        <div className="flex items-center gap-2 self-start">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="lg:hidden"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label="Recarregar lista"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button type="button" size="sm" className="gap-2" onClick={onCreateContact}>
            <Plus className="h-4 w-4" />
            Novo contato
          </Button>
        </div>
      </div>
      {hasSelection ? (
        <div className="flex flex-col gap-3 rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-primary sm:flex-row sm:items-center sm:justify-between">
          <div className="font-semibold">
            {selectedCount === 1 ? '1 contato selecionado' : `${selectedCount} contatos selecionados`}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isBulkProcessing}
              onClick={onClearSelection}
              aria-label="Limpar seleção"
            >
              Limpar seleção
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isBulkProcessing}
              onClick={() => onBulkAction?.('mergeDuplicates')}
            >
              Deduplicar
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isBulkProcessing}
              onClick={() => onBulkAction?.('sendWhatsApp')}
            >
              Disparar WhatsApp
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isBulkProcessing}
              onClick={() => onBulkAction?.('createTask')}
            >
              Criar tarefa
            </Button>
          </div>
        </div>
      ) : null}
      {hasFilters ? (
        <div className="flex flex-wrap items-center gap-2">
          {activeFilters.map((filter) => (
            <Badge key={filter.id} variant="secondary" className="flex items-center gap-1">
              {filter.label}
              <button
                type="button"
                className="text-muted-foreground transition hover:text-foreground"
                onClick={() => {
                  if (filter.id.startsWith('status:')) {
                    handleStatusChange('all');
                    return;
                  }
                  if (filter.id.startsWith('tag:')) {
                    handleTagToggle(filter.id.replace('tag:', ''));
                    return;
                  }
                  if (filter.id === 'isBlocked' || filter.id === 'hasWhatsapp') {
                    handleQuickFilterToggle(filter.id, false);
                    return;
                  }
                  handleReset();
                }}
                aria-label={`Remover filtro ${filter.label}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <Button variant="ghost" size="sm" onClick={handleReset} className="text-muted-foreground">
            Limpar todos
          </Button>
        </div>
      ) : totalLabel ? (
        <div className="text-xs text-muted-foreground">
          Ajuste os filtros para refinar os {totalLabel} disponíveis.
        </div>
      ) : null}
    </div>
  );
};

export default ContactsToolbar;
