import { useEffect, useMemo, useState } from 'react';
import { Filter, Loader2, RefreshCw, Search, Trash2, X, Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.jsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.jsx';
import { cn } from '@/lib/utils.js';
import CrmSavedViewsMenu from './CrmSavedViewsMenu.tsx';
import type { CrmFilterState, CrmSavedView } from '../state/types.ts';
import { normalizeCrmFilters } from '../utils/filter-serialization.ts';

type CrmToolbarFilterOptions = {
  stages: Array<{ id: string; label: string }>;
  owners: Array<{ id: string; label: string }>;
  origins: Array<{ id: string; label: string }>;
  channels: Array<{ id: string; label: string }>;
};

type CrmToolbarSavedViews = {
  views: CrmSavedView[];
  activeViewId: string | null;
  isSaving: boolean;
  isDeleting: boolean;
  createSavedView: (input: { name: string; scope: CrmSavedView['scope']; filters: CrmFilterState }) => Promise<unknown>;
  updateSavedView: (view: CrmSavedView, filters: CrmFilterState) => Promise<unknown>;
  deleteSavedView: (view: CrmSavedView) => Promise<unknown>;
  selectSavedView: (viewId: string | null) => Promise<unknown>;
};

type BulkAction = {
  id: string;
  label: string;
};

type CrmToolbarProps = {
  filters: CrmFilterState;
  onFiltersChange: (next: CrmFilterState) => void;
  onClearFilters?: () => void;
  filterOptions: CrmToolbarFilterOptions;
  totalCount?: number;
  selectedCount?: number;
  onClearSelection?: () => void;
  onBulkAction?: (actionId: string) => void;
  bulkActions?: BulkAction[];
  isBulkProcessing?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onCreateLead?: () => void;
  savedViews: CrmToolbarSavedViews;
};

const DEFAULT_FILTERS: CrmFilterState = {
  stages: [],
  owners: [],
  origins: [],
  channels: [],
  score: null,
  dateRange: null,
  inactivityDays: null,
};

const getClearedFilters = (): CrmFilterState => normalizeCrmFilters(DEFAULT_FILTERS);

const sumFilters = (filters: CrmFilterState) => {
  let total = 0;
  total += Array.isArray(filters.stages) ? filters.stages.length : 0;
  total += Array.isArray(filters.owners) ? filters.owners.length : 0;
  total += Array.isArray(filters.origins) ? filters.origins.length : 0;
  total += Array.isArray(filters.channels) ? filters.channels.length : 0;
  if (filters.score?.min != null || filters.score?.max != null) total += 1;
  if (filters.dateRange?.from || filters.dateRange?.to) total += 1;
  if (typeof filters.inactivityDays === 'number' && filters.inactivityDays >= 0) total += 1;
  return total;
};

const toggleItem = (collection: string[] | undefined, value: string) => {
  const safeList = Array.isArray(collection) ? collection : [];
  return safeList.includes(value) ? safeList.filter((item) => item !== value) : [...safeList, value];
};

const buildBadges = (
  filters: CrmFilterState,
  filterOptions: CrmToolbarFilterOptions
): Array<{ id: string; label: string }> => {
  const badges: Array<{ id: string; label: string }> = [];
  const mapLabel = (id: string, options: Array<{ id: string; label: string }>) =>
    options.find((option) => option.id === id)?.label ?? id;

  (filters.stages ?? []).forEach((stageId) => {
    badges.push({ id: `stage:${stageId}`, label: `Etapa: ${mapLabel(stageId, filterOptions.stages)}` });
  });

  (filters.owners ?? []).forEach((ownerId) => {
    badges.push({ id: `owner:${ownerId}`, label: `Dono: ${mapLabel(ownerId, filterOptions.owners)}` });
  });

  (filters.origins ?? []).forEach((originId) => {
    badges.push({ id: `origin:${originId}`, label: `Origem: ${mapLabel(originId, filterOptions.origins)}` });
  });

  (filters.channels ?? []).forEach((channelId) => {
    badges.push({ id: `channel:${channelId}`, label: `Canal: ${mapLabel(channelId, filterOptions.channels)}` });
  });

  if (filters.score?.min != null || filters.score?.max != null) {
    badges.push({
      id: 'score',
      label: `Score: ${filters.score?.min ?? 0} – ${filters.score?.max ?? '∞'}`,
    });
  }

  if (filters.dateRange?.from || filters.dateRange?.to) {
    badges.push({
      id: 'dateRange',
      label: `Datas: ${(filters.dateRange?.from ?? 'início')} → ${(filters.dateRange?.to ?? 'agora')}`,
    });
  }

  if (typeof filters.inactivityDays === 'number' && filters.inactivityDays >= 0) {
    badges.push({
      id: 'inactivityDays',
      label: `Sem atividade há ${filters.inactivityDays} dia(s)`,
    });
  }

  return badges;
};

const formatTotalLabel = (totalCount?: number) => {
  if (typeof totalCount !== 'number') {
    return null;
  }
  const formatted = new Intl.NumberFormat('pt-BR').format(totalCount);
  return `${formatted} ${totalCount === 1 ? 'lead' : 'leads'}`;
};

const CrmToolbar = ({
  filters,
  onFiltersChange,
  onClearFilters,
  filterOptions,
  totalCount,
  selectedCount = 0,
  onClearSelection,
  onBulkAction,
  bulkActions = [],
  isBulkProcessing = false,
  onRefresh,
  isRefreshing = false,
  onCreateLead,
  savedViews,
}: CrmToolbarProps) => {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<CrmFilterState>(() => normalizeCrmFilters(filters));

  useEffect(() => {
    if (!filtersOpen) {
      setDraftFilters(normalizeCrmFilters(filters));
    }
  }, [filters, filtersOpen]);

  const totalLabel = useMemo(() => formatTotalLabel(totalCount), [totalCount]);
  const activeBadges = useMemo(() => buildBadges(filters, filterOptions), [filters, filterOptions]);
  const activeFiltersCount = useMemo(() => sumFilters(filters), [filters]);

  const handleApplyFilters = () => {
    setFiltersOpen(false);
    onFiltersChange(normalizeCrmFilters(draftFilters));
  };

  const handleResetFilters = () => {
    const cleared = getClearedFilters();
    setDraftFilters(cleared);
    onFiltersChange(cleared);
    onClearFilters?.();
    setFiltersOpen(false);
  };

  const handleBadgeRemove = (badgeId: string) => {
    const [type, value] = badgeId.split(':');
    if (!type) return;

    const next: CrmFilterState = { ...filters };
    if (type === 'stage') {
      next.stages = (next.stages ?? []).filter((stageId) => stageId !== value);
    } else if (type === 'owner') {
      next.owners = (next.owners ?? []).filter((ownerId) => ownerId !== value);
    } else if (type === 'origin') {
      next.origins = (next.origins ?? []).filter((originId) => originId !== value);
    } else if (type === 'channel') {
      next.channels = (next.channels ?? []).filter((channelId) => channelId !== value);
    } else if (badgeId === 'score') {
      next.score = null;
    } else if (badgeId === 'dateRange') {
      next.dateRange = null;
    } else if (badgeId === 'inactivityDays') {
      next.inactivityDays = null;
    }
    onFiltersChange(normalizeCrmFilters(next));
  };

  const handleNumberChange = (key: 'min' | 'max', value: string) => {
    setDraftFilters((current) => ({
      ...current,
      score: {
        min: key === 'min' ? (value ? Number(value) : null) : current.score?.min ?? null,
        max: key === 'max' ? (value ? Number(value) : null) : current.score?.max ?? null,
      },
    }));
  };

  const handleDateChange = (key: 'from' | 'to', value: string) => {
    setDraftFilters((current) => ({
      ...current,
      dateRange: {
        from: key === 'from' ? (value || null) : current.dateRange?.from ?? null,
        to: key === 'to' ? (value || null) : current.dateRange?.to ?? null,
      },
    }));
  };

  const handleInactivityChange = (value: string) => {
    setDraftFilters((current) => ({
      ...current,
      inactivityDays: value ? Number(value) : null,
    }));
  };

  const renderSelectionBanner = () => {
    if (selectedCount <= 0) {
      return null;
    }

    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm">
        <span>
          {selectedCount} {selectedCount === 1 ? 'lead selecionado' : 'leads selecionados'}
        </span>
        {onClearSelection ? (
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onClearSelection}>
            Limpar seleção
          </Button>
        ) : null}
        {bulkActions.length > 0 && onBulkAction ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="sm" className="h-7 px-3 text-xs">
                <Users className="mr-2 h-3.5 w-3.5" />
                Ações em massa
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {bulkActions.map((action) => (
                <DropdownMenuItem key={action.id} onSelect={() => onBulkAction(action.id)}>
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        {isBulkProcessing ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filters.search ?? ''}
              onChange={(event) =>
                onFiltersChange({
                  ...filters,
                  search: event.target.value,
                })
              }
              placeholder="Buscar por nome, empresa ou telefone"
              className="h-10 w-full rounded-lg border border-border bg-background pl-9 text-sm shadow-none"
            />
            {filters.search ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground"
                onClick={() =>
                  onFiltersChange({
                    ...filters,
                    search: '',
                  })
                }
                aria-label="Limpar busca"
              >
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>

          <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="h-10 rounded-lg border-border/60">
                <Filter className="mr-2 h-4 w-4" />
                Filtros
                {activeFiltersCount > 0 ? (
                  <Badge variant="secondary" className="ml-2 h-5 rounded-full px-2 text-xs">
                    {activeFiltersCount}
                  </Badge>
                ) : null}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[420px] max-w-[90vw] rounded-xl border border-border bg-background p-4 shadow-xl">
              <div className="space-y-4">
                <div className="space-y-2">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">Etapa</span>
                  <div className="flex flex-wrap gap-2">
                    {filterOptions.stages.map((stage) => {
                      const isSelected = draftFilters.stages?.includes(stage.id);
                      return (
                        <Button
                          key={stage.id}
                          type="button"
                          variant={isSelected ? 'default' : 'outline'}
                          size="sm"
                          className={cn(
                            'h-8 rounded-full border-border/60',
                            isSelected ? 'bg-primary text-primary-foreground' : 'bg-background'
                          )}
                          onClick={() =>
                            setDraftFilters((current) => ({
                              ...current,
                              stages: toggleItem(current.stages, stage.id),
                            }))
                          }
                        >
                          {stage.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FilterList
                    title="Dono"
                    options={filterOptions.owners}
                    selected={draftFilters.owners ?? []}
                    onToggle={(value) =>
                      setDraftFilters((current) => ({
                        ...current,
                        owners: toggleItem(current.owners, value),
                      }))
                    }
                  />
                  <FilterList
                    title="Origem"
                    options={filterOptions.origins}
                    selected={draftFilters.origins ?? []}
                    onToggle={(value) =>
                      setDraftFilters((current) => ({
                        ...current,
                        origins: toggleItem(current.origins, value),
                      }))
                    }
                  />
                  <FilterList
                    title="Canal"
                    options={filterOptions.channels}
                    selected={draftFilters.channels ?? []}
                    onToggle={(value) =>
                      setDraftFilters((current) => ({
                        ...current,
                        channels: toggleItem(current.channels, value),
                      }))
                    }
                  />
                  <div className="space-y-2">
                    <span className="text-xs font-semibold uppercase text-muted-foreground">Score</span>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        placeholder="mín."
                        value={draftFilters.score?.min ?? ''}
                        onChange={(event) => handleNumberChange('min', event.target.value)}
                      />
                      <span className="text-muted-foreground">–</span>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        placeholder="máx."
                        value={draftFilters.score?.max ?? ''}
                        onChange={(event) => handleNumberChange('max', event.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <span className="text-xs font-semibold uppercase text-muted-foreground">Datas</span>
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        value={draftFilters.dateRange?.from ?? ''}
                        onChange={(event) => handleDateChange('from', event.target.value)}
                      />
                      <span className="text-muted-foreground">→</span>
                      <Input
                        type="date"
                        value={draftFilters.dateRange?.to ?? ''}
                        onChange={(event) => handleDateChange('to', event.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <span className="text-xs font-semibold uppercase text-muted-foreground">Sem atividade</span>
                    <Input
                      type="number"
                      min={0}
                      placeholder="Dias"
                      value={draftFilters.inactivityDays ?? ''}
                      onChange={(event) => handleInactivityChange(event.target.value)}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Button type="button" variant="ghost" onClick={handleResetFilters} className="h-9">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Limpar filtros
                  </Button>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" onClick={() => setFiltersOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="button" onClick={handleApplyFilters}>
                      Aplicar filtros
                    </Button>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <CrmSavedViewsMenu
            views={savedViews.views}
            activeViewId={savedViews.activeViewId}
            filters={filters}
            onSelect={savedViews.selectSavedView}
            onSave={(payload) => savedViews.createSavedView(payload)}
            onUpdate={({ view, filters: updatedFilters }) => savedViews.updateSavedView(view, updatedFilters)}
            onDelete={(view) => savedViews.deleteSavedView(view)}
            isSaving={savedViews.isSaving}
            isDeleting={savedViews.isDeleting}
          />

          {onRefresh ? (
            <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={isRefreshing} className="h-10 rounded-lg">
              <RefreshCw className={cn('mr-2 h-4 w-4', isRefreshing ? 'animate-spin' : '')} />
              Atualizar
            </Button>
          ) : null}

          {onCreateLead ? (
            <Button type="button" size="sm" className="h-10 rounded-lg" onClick={onCreateLead}>
              <Plus className="mr-2 h-4 w-4" />
              Novo lead
            </Button>
          ) : null}
        </div>

        {totalLabel ? <span className="text-xs text-muted-foreground">Exibindo {totalLabel}</span> : null}
      </div>

      {renderSelectionBanner()}

      {activeBadges.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {activeBadges.map((badge) => (
            <Badge
              key={badge.id}
              variant="secondary"
              className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs"
            >
              <span>{badge.label}</span>
              <button
                type="button"
                className="text-muted-foreground transition hover:text-foreground"
                onClick={() => handleBadgeRemove(badge.id)}
              >
                <X className="h-3 w-3" />
                <span className="sr-only">Remover filtro</span>
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
};

type FilterListProps = {
  title: string;
  options: Array<{ id: string; label: string }>;
  selected: string[];
  onToggle: (value: string) => void;
};

const FilterList = ({ title, options, selected, onToggle }: FilterListProps) => {
  return (
    <div className="space-y-2">
      <span className="text-xs font-semibold uppercase text-muted-foreground">{title}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isSelected = selected.includes(option.id);
          return (
            <Button
              key={option.id}
              type="button"
              variant={isSelected ? 'default' : 'outline'}
              size="sm"
              className={cn(
                'h-8 rounded-full border-border/60',
                isSelected ? 'bg-primary text-primary-foreground' : 'bg-background'
              )}
              onClick={() => onToggle(option.id)}
            >
              {option.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
};

export default CrmToolbar;
