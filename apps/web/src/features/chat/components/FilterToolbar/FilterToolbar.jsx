import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge.jsx';
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
import { GlassPanel } from '@/components/ui/glass-panel.jsx';
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
    <GlassPanel
      tone="overlay"
      radius="md"
      shadow="lg"
      className="space-y-4 border border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] p-5 text-[color:var(--color-inbox-foreground)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[color:var(--color-inbox-foreground-muted)]">Painel de atendimento</p>
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-[color:var(--color-inbox-foreground)]">Inbox de Leads</h2>
            <p className="text-sm text-[color:var(--color-inbox-foreground-muted)]">
              Priorize as conversas certas e acompanhe os tickets sem deixar o foco se perder.
            </p>
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <div className="relative sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--color-inbox-foreground-muted)]" />
            <Input
              value={search}
              onChange={(event) => onSearchChange?.(event.target.value)}
              placeholder="Buscar tickets, contatos..."
              className="h-10 w-full rounded-xl border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-bold)] pl-9 text-[color:var(--color-inbox-foreground)] placeholder:text-[color:var(--color-inbox-foreground-muted)]"
            />
          </div>
          {onStartManualConversation ? (
            <Button
              size="sm"
              className="h-10 rounded-xl bg-success text-xs font-semibold uppercase tracking-wide text-success-foreground shadow-[var(--shadow-md)] transition hover:bg-success/90 disabled:opacity-70"
              onClick={onStartManualConversation}
              disabled={manualConversationPending}
            >
              {manualConversationPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MessageSquarePlus className="h-4 w-4" />
              )}
              <span className="ml-2 text-xs font-semibold uppercase tracking-wide">Nova conversa</span>
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            className="h-10 rounded-xl border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-bold)] text-[color:var(--color-inbox-foreground)] hover:bg-[color:color-mix(in_srgb,var(--surface-overlay-inbox-bold)_92%,transparent)]"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            <span className="ml-2 text-xs font-semibold uppercase tracking-wide">Sincronizar</span>
          </Button>
        </div>
      </div>

      <div className="h-px w-full bg-[color:var(--color-inbox-border)]" />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-bold)] px-4 text-[color:var(--color-inbox-foreground)] hover:bg-[color:color-mix(in_srgb,var(--surface-overlay-inbox-bold)_92%,transparent)]"
              >
                <Filter className="h-4 w-4" />
                <span className="ml-2 text-xs font-semibold uppercase tracking-wide">Ajustar filtros</span>
                {activeFiltersCount > 0 ? (
                  <Badge
                    variant="secondary"
                    className="ml-2 rounded-full border border-[color:var(--accent-inbox-primary)] bg-[color:color-mix(in_srgb,var(--accent-inbox-primary)_18%,transparent)] px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-[color:var(--accent-inbox-primary)]"
                  >
                    {activeFiltersCount}
                  </Badge>
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
                    <SelectTrigger className="h-10 rounded-lg border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-bold)] text-[color:var(--color-inbox-foreground)]">
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
                    <SelectTrigger className="h-10 rounded-lg border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-bold)] text-[color:var(--color-inbox-foreground)]">
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
                    <SelectTrigger className="h-10 rounded-lg border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-bold)] text-[color:var(--color-inbox-foreground)]">
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
                    <SelectTrigger className="h-10 rounded-lg border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-bold)] text-[color:var(--color-inbox-foreground)]">
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

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-center rounded-lg border border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-bold)] text-xs font-semibold uppercase tracking-wide text-[color:var(--color-inbox-foreground)] hover:bg-[color:color-mix(in_srgb,var(--surface-overlay-inbox-bold)_92%,transparent)]"
                  onClick={handleResetFilters}
                >
                  Limpar filtros
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {activeFilterSummaries.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {activeFilterSummaries.map((summary) => (
              <Badge
                key={summary.id}
                variant="outline"
                className="inline-flex items-center gap-2 rounded-full border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-bold)] px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-[color:var(--color-inbox-foreground)]"
              >
                <span className="text-[color:var(--color-inbox-foreground-muted)]">{summary.label}</span>
                <span className="text-[color:var(--color-inbox-foreground)]">{summary.value}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveFilter(summary.id)}
                  className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[color:var(--surface-overlay-inbox-quiet)] text-[color:var(--color-inbox-foreground-muted)] transition hover:bg-[color:var(--surface-overlay-inbox-bold)] hover:text-[color:var(--color-inbox-foreground)]"
                >
                  <span className="sr-only">Remover filtro {summary.label}</span>
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
    </GlassPanel>
  );
};

export default FilterToolbar;
