import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.jsx';
import { cn } from '@/lib/utils.js';
import { Filter, Loader2, MessageSquarePlus, RefreshCw, Search, X } from 'lucide-react';

const DEFAULT_FILTERS = {
  scope: 'team',
  state: 'open',
  window: 'in_window',
  outcome: 'all',
};

const SCOPE_OPTIONS = [
  { value: 'team', label: 'Equipe' },
  { value: 'mine', label: 'Meus' },
];

const STATE_OPTIONS = [
  { value: 'open', label: 'Abertos' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'assigned', label: 'Atribuídos' },
  { value: 'resolved', label: 'Resolvidos' },
];

const WINDOW_OPTIONS = [
  { value: 'in_window', label: 'Janela 24h' },
  { value: 'expired', label: 'Expirados' },
];

const OUTCOME_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'won', label: 'Ganhos' },
  { value: 'lost', label: 'Perdidos' },
];

const FilterToolbar = ({
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  loading,
  onRefresh,
  onStartManualConversation,
  manualConversationPending = false,
}) => {
  const [filtersOpen, setFiltersOpen] = useState(false);

  const effectiveFilters = useMemo(
    () => ({
      scope: filters?.scope ?? DEFAULT_FILTERS.scope,
      state: filters?.state ?? DEFAULT_FILTERS.state,
      window: filters?.window ?? DEFAULT_FILTERS.window,
      outcome: filters?.outcome ?? DEFAULT_FILTERS.outcome,
    }),
    [filters]
  );

  const activeFiltersCount = useMemo(
    () =>
      Object.entries(effectiveFilters).reduce(
        (count, [key, value]) => (DEFAULT_FILTERS[key] !== value ? count + 1 : count),
        0
      ),
    [effectiveFilters]
  );

  const applyFilters = (updater) => {
    if (typeof onFiltersChange !== 'function') return;
    onFiltersChange((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      return { ...current, ...next };
    });
  };

  const getOptionLabel = (options, value) => options.find((option) => option.value === value)?.label ?? value;

  const filterSummaries = useMemo(
    () => [
      { id: 'scope', label: 'Responsável', value: getOptionLabel(SCOPE_OPTIONS, effectiveFilters.scope) },
      { id: 'state', label: 'Status', value: getOptionLabel(STATE_OPTIONS, effectiveFilters.state) },
      { id: 'window', label: 'Janela', value: getOptionLabel(WINDOW_OPTIONS, effectiveFilters.window) },
      { id: 'outcome', label: 'Resultado', value: getOptionLabel(OUTCOME_OPTIONS, effectiveFilters.outcome) },
    ],
    [effectiveFilters]
  );

  const activeFilterSummaries = useMemo(
    () =>
      filterSummaries.filter((summary) => effectiveFilters[summary.id] !== DEFAULT_FILTERS[summary.id]),
    [effectiveFilters, filterSummaries]
  );

  const handleResetFilters = () => {
    applyFilters(DEFAULT_FILTERS);
    setFiltersOpen(false);
  };

  const handleRemoveFilter = (filterId) => {
    if (!(filterId in DEFAULT_FILTERS)) return;
    applyFilters({ [filterId]: DEFAULT_FILTERS[filterId] });
  };

  return (
    <div className="flex w-full flex-col gap-2 text-[color:var(--color-inbox-foreground)]">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="relative flex min-w-[200px] flex-1 items-center sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--color-inbox-foreground-muted)]" />
          <Input
            value={search}
            onChange={(event) => onSearchChange?.(event.target.value)}
            placeholder="Buscar tickets, contatos..."
            className="h-9 w-full rounded-lg border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-bold)] pl-9 text-sm text-[color:var(--color-inbox-foreground)] placeholder:text-[color:var(--color-inbox-foreground-muted)]"
          />
        </div>

        <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-lg border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-bold)] px-3 text-xs font-medium text-[color:var(--color-inbox-foreground)] hover:bg-[color:color-mix(in_srgb,var(--surface-overlay-inbox-bold)_92%,transparent)]"
            >
              <Filter className="h-4 w-4" />
              <span className="ml-2 hidden sm:inline">Filtros</span>
              {activeFiltersCount > 0 ? (
                <span className="ml-2 inline-flex h-5 min-w-[1.5rem] items-center justify-center rounded-full bg-[color:color-mix(in_srgb,var(--accent-inbox-primary)_18%,transparent)] px-2 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--accent-inbox-primary)]">
                  {activeFiltersCount}
                </span>
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-[320px] rounded-xl border border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-bold)] p-4 text-[color:var(--color-inbox-foreground)] shadow-[var(--shadow-lg)]"
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-inbox-foreground-muted)]">Responsável</p>
                <Select
                  value={effectiveFilters.scope}
                  onValueChange={(value) => applyFilters({ scope: value })}
                >
                  <SelectTrigger className="h-9 rounded-lg border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-bold)] text-sm text-[color:var(--color-inbox-foreground)]">
                    <SelectValue placeholder="Equipe" />
                  </SelectTrigger>
                  <SelectContent className="border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] text-[color:var(--color-inbox-foreground)]">
                    {SCOPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-inbox-foreground-muted)]">Status</p>
                <Select
                  value={effectiveFilters.state}
                  onValueChange={(value) => applyFilters({ state: value })}
                >
                  <SelectTrigger className="h-9 rounded-lg border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-bold)] text-sm text-[color:var(--color-inbox-foreground)]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className="border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] text-[color:var(--color-inbox-foreground)]">
                    {STATE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-inbox-foreground-muted)]">Janela</p>
                <Select
                  value={effectiveFilters.window}
                  onValueChange={(value) => applyFilters({ window: value })}
                >
                  <SelectTrigger className="h-9 rounded-lg border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-bold)] text-sm text-[color:var(--color-inbox-foreground)]">
                    <SelectValue placeholder="Janela" />
                  </SelectTrigger>
                  <SelectContent className="border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] text-[color:var(--color-inbox-foreground)]">
                    {WINDOW_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-inbox-foreground-muted)]">Resultado</p>
                <Select
                  value={effectiveFilters.outcome}
                  onValueChange={(value) => applyFilters({ outcome: value })}
                >
                  <SelectTrigger className="h-9 rounded-lg border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-bold)] text-sm text-[color:var(--color-inbox-foreground)]">
                    <SelectValue placeholder="Resultado" />
                  </SelectTrigger>
                  <SelectContent className="border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] text-[color:var(--color-inbox-foreground)]">
                    {OUTCOME_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-lg px-3 text-xs font-medium text-[color:var(--color-inbox-foreground-muted)] hover:text-[color:var(--color-inbox-foreground)]"
                  onClick={handleResetFilters}
                >
                  Limpar filtros
                </Button>
                <Button
                  size="sm"
                  className="h-8 rounded-lg bg-[color:var(--accent-inbox-primary)] px-4 text-xs font-semibold text-white hover:bg-[color:color-mix(in_srgb,var(--accent-inbox-primary)_92%,transparent)]"
                  onClick={() => setFiltersOpen(false)}
                >
                  Aplicar
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Button
          variant="outline"
          size="sm"
          className="h-9 rounded-lg border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-bold)] px-3 text-xs font-medium text-[color:var(--color-inbox-foreground)] hover:bg-[color:color-mix(in_srgb,var(--surface-overlay-inbox-bold)_92%,transparent)]"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          <span className="ml-2 hidden sm:inline">Atualizar</span>
        </Button>

        {onStartManualConversation ? (
          <Button
            size="sm"
            className="h-9 rounded-lg bg-success px-3 text-xs font-semibold text-success-foreground hover:bg-success/90 disabled:opacity-70"
            onClick={onStartManualConversation}
            disabled={manualConversationPending}
          >
            {manualConversationPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MessageSquarePlus className="h-4 w-4" />
            )}
            <span className="ml-2 hidden sm:inline">Nova conversa</span>
          </Button>
        ) : null}
      </div>

      {activeFilterSummaries.length ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--color-inbox-foreground-muted)]">
          {activeFilterSummaries.map((summary) => (
            <button
              key={summary.id}
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-bold)] px-3 py-1 text-xs font-medium text-[color:var(--color-inbox-foreground)] transition hover:bg-[color:color-mix(in_srgb,var(--surface-overlay-inbox-bold)_92%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-inbox-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--surface-shell)]"
              onClick={() => handleRemoveFilter(summary.id)}
            >
              <span className="text-[color:var(--color-inbox-foreground-muted)]">{summary.label}:</span>
              <span>{summary.value}</span>
              <X className="h-3 w-3" />
            </button>
          ))}
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-inbox-foreground-muted)] hover:text-[color:var(--color-inbox-foreground)]"
            onClick={handleResetFilters}
          >
            Limpar tudo
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default FilterToolbar;
