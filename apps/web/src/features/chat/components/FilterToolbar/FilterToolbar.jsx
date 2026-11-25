import { useMemo, useState } from 'react';
import { AlertTriangle, ListFilter, Loader2, RefreshCw, Search, SquarePen, X } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import { cn } from '@/lib/utils.js';
import { LEAD_STAGE_DEFINITIONS, LEAD_STAGE_FILTER_OPTIONS, LEAD_STAGE_TONE_CLASSES } from '@/features/crm/utils/lead-stage';

const DEFAULT_FILTERS = {
  state: 'open',
  instanceId: null,
  campaignId: null,
  productType: null,
  strategy: null,
  stage: null,
};

const ALL_OPTION_VALUE = '__all__';

const STATE_OPTIONS = [
  { value: 'open', label: 'Em aberto' },
  { value: 'closed', label: 'Encerradas' },
  { value: 'all', label: 'Todas' },
];

const SCOPE_TABS = [
  { value: 'mine', label: 'Minhas' },
  { value: 'team', label: 'Todas' },
];

/** Etapas do funil único do lead (as mesmas do CRM), com o ponto do tom. */
const STAGE_OPTIONS = LEAD_STAGE_FILTER_OPTIONS.map(({ id, label }) => ({
  value: id,
  label,
  dotClassName: LEAD_STAGE_TONE_CLASSES[LEAD_STAGE_DEFINITIONS[id].tone].dot,
}));

const QUICK_FILTER_CHIPS = [
  { value: 'unread', label: 'Não lidas' },
  { value: 'awaiting', label: 'Aguardando resposta' },
];

/** Configuração única dos filtros do popover (antes eram 8 blocos copiados). */
const buildFilterConfig = ({ instanceOptions, campaignOptions, productTypeOptions, strategyOptions }) => [
  { id: 'state', label: 'Status', options: STATE_OPTIONS, required: true },
  { id: 'stage', label: 'Etapa do lead', options: STAGE_OPTIONS, allLabel: 'Todas as etapas' },
  { id: 'instanceId', label: 'Número', options: instanceOptions, allLabel: 'Todos os números' },
  { id: 'campaignId', label: 'Regra de roteamento', options: campaignOptions, allLabel: 'Todas as regras' },
  { id: 'productType', label: 'Convênio', options: productTypeOptions, allLabel: 'Todos os convênios' },
  { id: 'strategy', label: 'Estratégia', options: strategyOptions, allLabel: 'Todas as estratégias' },
];

const FilterSelect = ({ config, value, onChange }) => {
  const selectValue = value ?? (config.required ? DEFAULT_FILTERS[config.id] : ALL_OPTION_VALUE);
  const id = `inbox-filter-${config.id}`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {config.label}
      </label>
      <Select
        value={selectValue}
        onValueChange={(next) => onChange(config.id, next === ALL_OPTION_VALUE ? null : next)}
      >
        <SelectTrigger id={id} className="h-9 w-full">
          <SelectValue placeholder={config.allLabel ?? config.label} />
        </SelectTrigger>
        <SelectContent>
          {config.required ? null : <SelectItem value={ALL_OPTION_VALUE}>{config.allLabel}</SelectItem>}
          {config.options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.dotClassName ? (
                <span aria-hidden className={cn('size-2 shrink-0 rounded-full', option.dotClassName)} />
              ) : null}
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

const FilterToolbar = ({
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  loading,
  onRefresh,
  total,
  quickFilter = null,
  onQuickFilterChange,
  canFilterMine = true,
  onStartManualConversation,
  manualConversationPending = false,
  manualConversationUnavailableReason,
  instanceOptions = [],
  campaignOptions = [],
  productTypeOptions = [],
  strategyOptions = [],
}) => {
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filterConfig = useMemo(
    () =>
      buildFilterConfig({ instanceOptions, campaignOptions, productTypeOptions, strategyOptions }).filter(
        (config) => config.required || config.options.length > 0 || filters?.[config.id],
      ),
    [campaignOptions, filters, instanceOptions, productTypeOptions, strategyOptions],
  );

  const activeFilters = useMemo(
    () =>
      filterConfig
        .filter((config) => {
          const value = filters?.[config.id] ?? DEFAULT_FILTERS[config.id];
          return value !== DEFAULT_FILTERS[config.id];
        })
        .map((config) => {
          const value = filters?.[config.id];
          const option = config.options.find((item) => item.value === value);
          return { id: config.id, label: config.label, value: option?.label ?? value };
        }),
    [filterConfig, filters],
  );

  const applyFilter = (id, value) => {
    if (typeof onFiltersChange !== 'function') return;
    onFiltersChange((current) => ({ ...current, [id]: value }));
  };

  const resetFilters = () => {
    if (typeof onFiltersChange !== 'function') return;
    onFiltersChange((current) => ({ ...current, ...DEFAULT_FILTERS }));
  };

  const scope = filters?.scope === 'mine' ? 'mine' : 'team';
  const countLabel = typeof total === 'number' ? total : null;

  return (
    <div className="flex w-full flex-col gap-3 px-3 pb-3 pt-3">
      <div className="flex items-center gap-2">
        <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">
          Conversas
          {countLabel !== null ? (
            <span className="ml-1.5 text-sm font-normal text-muted-foreground">({countLabel})</span>
          ) : null}
        </h2>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onRefresh}
              disabled={loading}
              aria-label="Atualizar conversas"
            >
              <RefreshCw className={cn(loading && 'animate-spin')} aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Atualizar conversas</TooltipContent>
        </Tooltip>
        {onStartManualConversation ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={onStartManualConversation}
                disabled={manualConversationPending}
                aria-label="Nova conversa no WhatsApp"
              >
                {manualConversationPending ? <Loader2 className="animate-spin" aria-hidden /> : <SquarePen aria-hidden />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Nova conversa no WhatsApp</TooltipContent>
          </Tooltip>
        ) : null}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          value={search}
          onChange={(event) => onSearchChange?.(event.target.value)}
          placeholder="Buscar por nome ou telefone"
          aria-label="Buscar conversas por nome ou telefone"
          className="h-9 pl-8 pr-8"
        />
        {search ? (
          <button
            type="button"
            onClick={() => onSearchChange?.('')}
            className="absolute right-2 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Limpar busca"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <div role="tablist" aria-label="Quais conversas mostrar" className="inline-flex rounded-md bg-surface-sunken p-0.5">
          {SCOPE_TABS.map((tab) => {
            const selected = scope === tab.value;
            const disabled = tab.value === 'mine' && !canFilterMine;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={selected}
                disabled={disabled}
                onClick={() => applyFilter('scope', tab.value)}
                className={cn(
                  'h-7 rounded-[5px] px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
                  selected ? 'bg-surface text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <div className="flex-1" />
        <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(activeFilters.length > 0 && 'text-primary')}
              aria-label={activeFilters.length > 0 ? `Filtros (${activeFilters.length} ativos)` : 'Filtros'}
            >
              <ListFilter aria-hidden />
              Filtros
              {activeFilters.length > 0 ? (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-2xs font-semibold text-primary-foreground">
                  {activeFilters.length}
                </span>
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-0">
            <div className="flex flex-col gap-3 p-4">
              <p className="text-sm font-semibold text-foreground">Filtrar conversas</p>
              {filterConfig.map((config) => (
                <FilterSelect
                  key={config.id}
                  config={config}
                  value={filters?.[config.id] ?? null}
                  onChange={applyFilter}
                />
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
              <span className="text-xs text-muted-foreground">Os filtros valem na hora.</span>
              <Button type="button" variant="ghost" size="xs" onClick={resetFilters} disabled={activeFilters.length === 0}>
                Limpar filtros
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtros rápidos">
        {QUICK_FILTER_CHIPS.map((chip) => {
          const active = quickFilter === chip.value;
          return (
            <button
              key={chip.value}
              type="button"
              aria-pressed={active}
              onClick={() => onQuickFilterChange?.(chip.value)}
              className={cn(
                'inline-flex h-7 items-center gap-1 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active
                  ? 'border-transparent bg-primary-soft text-primary-soft-foreground'
                  : 'border-border bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground',
              )}
            >
              {chip.label}
            </button>
          );
        })}
        {activeFilters.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => applyFilter(filter.id, DEFAULT_FILTERS[filter.id])}
            className="inline-flex h-7 items-center gap-1 rounded-full border border-transparent bg-surface-sunken px-2.5 text-xs font-medium text-foreground hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Remover filtro ${filter.label}: ${filter.value}`}
          >
            <span className="text-muted-foreground">{filter.label}:</span> {filter.value}
            <X className="size-3" aria-hidden />
          </button>
        ))}
      </div>

      {manualConversationUnavailableReason ? (
        <div className="flex items-start gap-2 rounded-md bg-surface-sunken px-3 py-2 text-xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <p>{manualConversationUnavailableReason}</p>
        </div>
      ) : null}
    </div>
  );
};

export default FilterToolbar;
