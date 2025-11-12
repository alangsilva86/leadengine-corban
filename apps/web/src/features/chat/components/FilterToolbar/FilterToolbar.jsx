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
import { AlertTriangle, Filter, Loader2, RefreshCw, Search, X } from 'lucide-react';

const DEFAULT_FILTERS = {
  scope: 'team',
  state: 'open',
  window: 'in_window',
  outcome: 'all',
  instanceId: null,
  campaignId: null,
  productType: null,
  strategy: null,
};

const ALL_OPTION_VALUE = '__all__';

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

const WhatsAppGlyph = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    role="img"
    aria-hidden="true"
    focusable="false"
    {...props}
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.1-.47-.149-.67.149-.198.297-.767.966-.94 1.164-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.447-.52.149-.173.198-.297.298-.495.1-.198.05-.371-.025-.52-.075-.148-.669-1.61-.916-2.2-.242-.579-.487-.502-.669-.512-.173-.009-.371-.011-.57-.011-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.227 1.36.195 1.872.118.571-.085 1.758-.718 2.006-1.413.248-.695.248-1.29.173-1.413-.074-.123-.272-.198-.57-.347m-5.421 4.768h-.004a8.856 8.856 0 01-4.487-1.227l-.321-.191-3.333.874.894-3.257-.209-.334a8.86 8.86 0 01-1.362-4.722c.003-4.858 3.966-8.82 8.824-8.82 2.361 0 4.577.92 6.241 2.585a8.78 8.78 0 012.585 6.234c-.003 4.858-3.966 8.82-8.828 8.82m7.545-16.37A10.63 10.63 0 0012.05 0C5.495 0 .16 5.335.156 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.305-1.655a10.56 10.56 0 005.717 1.67h.005c6.554 0 11.89-5.335 11.893-11.892A11.81 11.81 0 0019.596 2.78" />
  </svg>
);

const FilterToolbar = ({
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  loading,
  onRefresh,
  onStartManualConversation,
  manualConversationPending = false,
  manualConversationUnavailableReason,
  instanceOptions = [],
  campaignOptions = [],
  productTypeOptions = [],
  strategyOptions = [],
}) => {
  const [filtersOpen, setFiltersOpen] = useState(false);

  const effectiveFilters = useMemo(
    () => ({
      scope: filters?.scope ?? DEFAULT_FILTERS.scope,
      state: filters?.state ?? DEFAULT_FILTERS.state,
      window: filters?.window ?? DEFAULT_FILTERS.window,
      outcome: filters?.outcome ?? DEFAULT_FILTERS.outcome,
      instanceId: filters?.instanceId ?? DEFAULT_FILTERS.instanceId,
      campaignId: filters?.campaignId ?? DEFAULT_FILTERS.campaignId,
      productType: filters?.productType ?? DEFAULT_FILTERS.productType,
      strategy: filters?.strategy ?? DEFAULT_FILTERS.strategy,
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

  const getOptionLabel = (options, value, fallbackLabel) => {
    if (value === null || value === undefined || value === '') {
      return fallbackLabel ?? '';
    }
    const option = options.find((option) => option.value === value);
    return option?.label ?? value;
  };

  const filterSummaries = useMemo(
    () => [
      { id: 'scope', label: 'Responsável', value: getOptionLabel(SCOPE_OPTIONS, effectiveFilters.scope) },
      { id: 'state', label: 'Status', value: getOptionLabel(STATE_OPTIONS, effectiveFilters.state) },
      { id: 'window', label: 'Janela', value: getOptionLabel(WINDOW_OPTIONS, effectiveFilters.window) },
      { id: 'outcome', label: 'Resultado', value: getOptionLabel(OUTCOME_OPTIONS, effectiveFilters.outcome) },
      {
        id: 'instanceId',
        label: 'Instância',
        value: getOptionLabel(instanceOptions, effectiveFilters.instanceId, 'Todas instâncias'),
      },
      {
        id: 'campaignId',
        label: 'Campanha',
        value: getOptionLabel(campaignOptions, effectiveFilters.campaignId, 'Todas campanhas'),
      },
      {
        id: 'productType',
        label: 'Convênio',
        value: getOptionLabel(productTypeOptions, effectiveFilters.productType, 'Todos convênios'),
      },
      {
        id: 'strategy',
        label: 'Estratégia',
        value: getOptionLabel(strategyOptions, effectiveFilters.strategy, 'Todas estratégias'),
      },
    ],
    [campaignOptions, effectiveFilters, instanceOptions, productTypeOptions, strategyOptions]
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

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-inbox-foreground-muted)]">Instância</p>
                <Select
                  value={effectiveFilters.instanceId ?? ALL_OPTION_VALUE}
                  onValueChange={(value) =>
                    applyFilters({ instanceId: value === ALL_OPTION_VALUE ? null : value })
                  }
                >
                  <SelectTrigger className="h-9 rounded-lg border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-bold)] text-sm text-[color:var(--color-inbox-foreground)]">
                    <SelectValue placeholder="Todas instâncias" />
                  </SelectTrigger>
                  <SelectContent className="border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] text-[color:var(--color-inbox-foreground)]">
                    <SelectItem value={ALL_OPTION_VALUE}>Todas</SelectItem>
                    {instanceOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-inbox-foreground-muted)]">Campanha</p>
                <Select
                  value={effectiveFilters.campaignId ?? ALL_OPTION_VALUE}
                  onValueChange={(value) =>
                    applyFilters({ campaignId: value === ALL_OPTION_VALUE ? null : value })
                  }
                >
                  <SelectTrigger className="h-9 rounded-lg border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-bold)] text-sm text-[color:var(--color-inbox-foreground)]">
                    <SelectValue placeholder="Todas campanhas" />
                  </SelectTrigger>
                  <SelectContent className="border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] text-[color:var(--color-inbox-foreground)]">
                    <SelectItem value={ALL_OPTION_VALUE}>Todas</SelectItem>
                    {campaignOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-inbox-foreground-muted)]">Convênio</p>
                <Select
                  value={effectiveFilters.productType ?? ALL_OPTION_VALUE}
                  onValueChange={(value) =>
                    applyFilters({ productType: value === ALL_OPTION_VALUE ? null : value })
                  }
                >
                  <SelectTrigger className="h-9 rounded-lg border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-bold)] text-sm text-[color:var(--color-inbox-foreground)]">
                    <SelectValue placeholder="Todos convênios" />
                  </SelectTrigger>
                  <SelectContent className="border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] text-[color:var(--color-inbox-foreground)]">
                    <SelectItem value={ALL_OPTION_VALUE}>Todos</SelectItem>
                    {productTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-inbox-foreground-muted)]">Estratégia</p>
                <Select
                  value={effectiveFilters.strategy ?? ALL_OPTION_VALUE}
                  onValueChange={(value) =>
                    applyFilters({ strategy: value === ALL_OPTION_VALUE ? null : value })
                  }
                >
                  <SelectTrigger className="h-9 rounded-lg border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-bold)] text-sm text-[color:var(--color-inbox-foreground)]">
                    <SelectValue placeholder="Todas estratégias" />
                  </SelectTrigger>
                  <SelectContent className="border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] text-[color:var(--color-inbox-foreground)]">
                    <SelectItem value={ALL_OPTION_VALUE}>Todas</SelectItem>
                    {strategyOptions.map((option) => (
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
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-full border-[color:var(--color-status-whatsapp-border)] bg-[color:var(--color-status-whatsapp-surface)] text-[color:var(--color-status-whatsapp-foreground)] shadow-sm transition hover:bg-[color:color-mix(in_srgb,var(--color-status-whatsapp-surface)_92%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-status-whatsapp-border)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--surface-shell)] disabled:opacity-70"
            onClick={onStartManualConversation}
            disabled={manualConversationPending}
            aria-label="Iniciar nova conversa manual no WhatsApp"
          >
            {manualConversationPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <WhatsAppGlyph className="h-5 w-5" />
            )}
          </Button>
        ) : null}
      </div>

      {manualConversationUnavailableReason ? (
        <div className="flex items-start gap-3 rounded-lg border border-dashed border-[color:var(--color-inbox-border)] bg-[color:color-mix(in_srgb,var(--surface-overlay-inbox-bold)_80%,transparent)] px-4 py-3 text-xs text-[color:var(--color-inbox-foreground)]">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-[color:var(--accent-inbox-primary)]" />
          <div className="flex-1 leading-relaxed text-[color:var(--color-inbox-foreground-muted)]">
            {manualConversationUnavailableReason}
          </div>
        </div>
      ) : null}

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
