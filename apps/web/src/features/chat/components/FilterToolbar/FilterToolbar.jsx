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
import { cn } from '@/lib/utils.js';
import { Filter, RefreshCw, Search } from 'lucide-react';

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

const SAVED_PRESETS = [
  {
    id: 'sla-critical',
    label: 'SLA crítico',
    description: 'Janela expirada ou em até 10 min',
    filters: { window: 'expired' },
  },
  {
    id: 'meus-abertos',
    label: 'Meus tickets',
    description: 'Abertos e atribuídos a mim',
    filters: { scope: 'mine', state: 'open' },
  },
  {
    id: 'ganhos',
    label: 'Ganhos',
    description: 'Marcados como ganho nas últimas 24h',
    filters: { outcome: 'won' },
  },
];

const FilterToolbar = ({
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  loading,
  onRefresh,
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

  const handleResetFilters = () => {
    applyFilters(DEFAULT_FILTERS);
    setFiltersOpen(false);
  };

  return (
    <div className="space-y-4 rounded-2xl border border-slate-900/70 bg-slate-950/80 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.35)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Painel de atendimento</p>
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-slate-100">Inbox de Leads</h2>
            <p className="text-sm text-slate-400">
              Priorize as conversas certas e acompanhe os tickets sem deixar o foco se perder.
            </p>
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <div className="relative sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              value={search}
              onChange={(event) => onSearchChange?.(event.target.value)}
              placeholder="Buscar tickets, contatos..."
              className="h-10 w-full rounded-xl border-slate-800/60 bg-slate-900/60 pl-9 text-slate-100 placeholder:text-slate-500"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-10 rounded-xl border-slate-800 bg-slate-900/60 text-slate-200 hover:bg-slate-900"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            <span className="ml-2 text-xs font-semibold uppercase tracking-wide">Sincronizar</span>
          </Button>
        </div>
      </div>

      <div className="h-px w-full bg-slate-900/60" />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {filterSummaries.map((summary) => (
            <Badge
              key={summary.id}
              variant="outline"
              className="rounded-full border-slate-800/70 bg-slate-950/50 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-300"
            >
              <span className="text-slate-500">{summary.label}</span>
              <span className="ml-2 text-slate-100">{summary.value}</span>
            </Badge>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full border-slate-800/80 bg-slate-950/60 px-4 text-slate-200 hover:bg-slate-900"
              >
                <Filter className="h-4 w-4" />
                <span className="ml-2 text-xs font-semibold uppercase tracking-wide">Ajustar filtros</span>
                {activeFiltersCount > 0 ? (
                  <Badge
                    variant="secondary"
                    className="ml-2 rounded-full border-0 bg-sky-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-200"
                  >
                    {activeFiltersCount}
                  </Badge>
                ) : null}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-[320px] rounded-xl border-slate-800/80 bg-slate-950/95 p-4 text-slate-100 shadow-xl"
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Responsável</p>
                  <Select
                    value={effectiveFilters.scope}
                    onValueChange={(value) => applyFilters({ scope: value })}
                  >
                    <SelectTrigger className="h-10 rounded-lg border-slate-800/60 bg-slate-900/60 text-slate-100">
                      <SelectValue placeholder="Equipe" />
                    </SelectTrigger>
                    <SelectContent className="border-slate-800/80 bg-slate-950 text-slate-100">
                      {SCOPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Status</p>
                  <Select
                    value={effectiveFilters.state}
                    onValueChange={(value) => applyFilters({ state: value })}
                  >
                    <SelectTrigger className="h-10 rounded-lg border-slate-800/60 bg-slate-900/60 text-slate-100">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent className="border-slate-800/80 bg-slate-950 text-slate-100">
                      {STATE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Janela</p>
                  <Select
                    value={effectiveFilters.window}
                    onValueChange={(value) => applyFilters({ window: value })}
                  >
                    <SelectTrigger className="h-10 rounded-lg border-slate-800/60 bg-slate-900/60 text-slate-100">
                      <SelectValue placeholder="Janela" />
                    </SelectTrigger>
                    <SelectContent className="border-slate-800/80 bg-slate-950 text-slate-100">
                      {WINDOW_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Resultado</p>
                  <Select
                    value={effectiveFilters.outcome}
                    onValueChange={(value) => applyFilters({ outcome: value })}
                  >
                    <SelectTrigger className="h-10 rounded-lg border-slate-800/60 bg-slate-900/60 text-slate-100">
                      <SelectValue placeholder="Resultado" />
                    </SelectTrigger>
                    <SelectContent className="border-slate-800/80 bg-slate-950 text-slate-100">
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
                  className="w-full justify-center rounded-lg border border-slate-800/60 bg-slate-900/60 text-xs font-semibold uppercase tracking-wide text-slate-300 hover:bg-slate-900"
                  onClick={handleResetFilters}
                >
                  Limpar filtros
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <div className="flex flex-wrap items-center gap-2">
            {SAVED_PRESETS.map((preset) => (
              <Button
                key={preset.id}
                variant="secondary"
                size="sm"
                title={preset.description}
                className="h-9 rounded-full border-0 bg-slate-900/70 px-3 text-[11px] font-medium uppercase tracking-wide text-slate-300 hover:bg-slate-900"
                onClick={() => applyFilters(preset.filters)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilterToolbar;
