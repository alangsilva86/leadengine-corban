import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ListFilter, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Switch } from '@/components/ui/switch.jsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.jsx';
import { cn } from '@/lib/utils.js';
import CrmSavedViewsMenu from './CrmSavedViewsMenu';
import type { CrmFilterState, CrmSavedView } from '../state/types';
import { normalizeCrmFilters } from '../utils/filter-serialization';
import { getSourceLabel } from '../utils/labels';
import { LEAD_STAGE_DEFINITIONS, LEAD_STAGE_TONE_CLASSES, getLeadStageLabel, parseLeadStage } from '../utils/lead-stage';

type FilterOption = { id: string; label: string };

type CrmToolbarFilterOptions = {
  stages: FilterOption[];
  owners?: FilterOption[];
  origins: FilterOption[];
  channels?: FilterOption[];
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

type CrmToolbarProps = {
  filters: CrmFilterState;
  onFiltersChange: (next: CrmFilterState) => void;
  onClearFilters?: () => void;
  filterOptions: CrmToolbarFilterOptions;
  savedViews: CrmToolbarSavedViews;
  /** Slot à direita (seletor de visão). */
  trailing?: ReactNode;
  searchDebounceMs?: number;
};

const OWNER_ME = 'owner:me';

const DEFAULT_FILTERS: CrmFilterState = {
  stages: [],
  owners: [],
  origins: [],
  channels: [],
  score: null,
  dateRange: null,
  inactivityDays: null,
};

const getClearedFilters = (search?: string): CrmFilterState => normalizeCrmFilters({ ...DEFAULT_FILTERS, search });

export const countActiveFilters = (filters: CrmFilterState) => {
  let total = 0;
  total += filters.stages?.length ?? 0;
  total += filters.owners?.length ?? 0;
  total += filters.origins?.length ?? 0;
  total += filters.channels?.length ?? 0;
  if (filters.score?.min != null || filters.score?.max != null) total += 1;
  if (filters.dateRange?.from || filters.dateRange?.to) total += 1;
  if (typeof filters.inactivityDays === 'number' && filters.inactivityDays >= 0) total += 1;
  return total;
};

const toggleItem = (collection: string[] | undefined, value: string) => {
  const safeList = Array.isArray(collection) ? collection : [];
  return safeList.includes(value) ? safeList.filter((item) => item !== value) : [...safeList, value];
};

const formatDay = (value?: string | null) => {
  if (!value) return null;
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
};

type Chip = { id: string; label: string; remove: (filters: CrmFilterState) => CrmFilterState };

const buildChips = (filters: CrmFilterState, options: CrmToolbarFilterOptions): Chip[] => {
  const chips: Chip[] = [];
  const labelFrom = (list: FilterOption[] | undefined, id: string) => list?.find((option) => option.id === id)?.label;

  (filters.stages ?? []).forEach((id) =>
    chips.push({
      id: `stage:${id}`,
      label: labelFrom(options.stages, id) ?? getLeadStageLabel(id),
      remove: (current) => ({ ...current, stages: (current.stages ?? []).filter((entry) => entry !== id) }),
    })
  );
  (filters.owners ?? []).forEach((id) =>
    chips.push({
      id: `owner:${id}`,
      label: id === OWNER_ME ? 'Meus leads' : labelFrom(options.owners, id) ?? 'Responsável',
      remove: (current) => ({ ...current, owners: (current.owners ?? []).filter((entry) => entry !== id) }),
    })
  );
  (filters.origins ?? []).forEach((id) =>
    chips.push({
      id: `origin:${id}`,
      label: `Origem: ${labelFrom(options.origins, id) ?? getSourceLabel(id) ?? 'outra'}`,
      remove: (current) => ({ ...current, origins: (current.origins ?? []).filter((entry) => entry !== id) }),
    })
  );
  (filters.channels ?? []).forEach((id) =>
    chips.push({
      id: `channel:${id}`,
      label: `Canal: ${getSourceLabel(id) ?? 'outro'}`,
      remove: (current) => ({ ...current, channels: (current.channels ?? []).filter((entry) => entry !== id) }),
    })
  );
  if (filters.score?.min != null || filters.score?.max != null) {
    chips.push({
      id: 'score',
      label: `Pontuação ${filters.score?.min ?? 0}–${filters.score?.max ?? '∞'}`,
      remove: (current) => ({ ...current, score: null }),
    });
  }
  if (filters.dateRange?.from || filters.dateRange?.to) {
    const from = formatDay(filters.dateRange?.from);
    const to = formatDay(filters.dateRange?.to);
    chips.push({
      id: 'dateRange',
      label: from && to ? `Criados de ${from} a ${to}` : from ? `Criados desde ${from}` : `Criados até ${to}`,
      remove: (current) => ({ ...current, dateRange: null }),
    });
  }
  if (typeof filters.inactivityDays === 'number' && filters.inactivityDays >= 0) {
    chips.push({
      id: 'inactivityDays',
      label: `Parados há ${filters.inactivityDays}+ dias`,
      remove: (current) => ({ ...current, inactivityDays: null }),
    });
  }
  return chips;
};

const ChipToggle = ({
  label,
  pressed,
  onToggle,
  dotClassName,
}: {
  label: string;
  pressed: boolean;
  onToggle: () => void;
  dotClassName?: string | undefined;
}) => (
  <Button
    type="button"
    size="xs"
    variant={pressed ? 'soft' : 'outline'}
    aria-pressed={pressed}
    onClick={onToggle}
    className={cn('rounded-full px-2.5', pressed && 'ring-1 ring-primary/40')}
  >
    {dotClassName ? <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full', dotClassName)} /> : null}
    {label}
  </Button>
);

/** Ponto do tom da etapa (mesmo do Kanban e dos chips). */
const stageDotClass = (id: string) => {
  const stage = parseLeadStage(id);
  return stage ? LEAD_STAGE_TONE_CLASSES[LEAD_STAGE_DEFINITIONS[stage].tone].dot : undefined;
};

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <fieldset className="space-y-2">
    <legend className="text-xs font-medium text-muted-foreground">{title}</legend>
    {children}
  </fieldset>
);

const CrmToolbar = ({
  filters,
  onFiltersChange,
  onClearFilters,
  filterOptions,
  savedViews,
  trailing,
  searchDebounceMs = 300,
}: CrmToolbarProps) => {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<CrmFilterState>(() => normalizeCrmFilters(filters));
  const [searchInput, setSearchInput] = useState(filters.search ?? '');
  const lastPushedSearch = useRef(filters.search ?? '');
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  // Mantém o campo sincronizado quando a busca muda por fora (limpar filtros, visão salva).
  useEffect(() => {
    const external = filters.search ?? '';
    if (external !== lastPushedSearch.current.trim()) {
      lastPushedSearch.current = external;
      setSearchInput(external);
    }
  }, [filters.search]);

  // Busca com debounce: evita recarregar leads e métricas a cada tecla.
  useEffect(() => {
    if (searchInput === lastPushedSearch.current) {
      return undefined;
    }
    const timer = setTimeout(() => {
      lastPushedSearch.current = searchInput;
      onFiltersChange({ ...filtersRef.current, search: searchInput });
    }, searchDebounceMs);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!filtersOpen) {
      setDraftFilters(normalizeCrmFilters(filters));
    }
  }, [filters, filtersOpen]);

  const chips = useMemo(() => buildChips(filters, filterOptions), [filters, filterOptions]);
  const activeFiltersCount = countActiveFilters(filters);

  const handleApplyFilters = () => {
    setFiltersOpen(false);
    onFiltersChange(normalizeCrmFilters({ ...draftFilters, search: filters.search }));
  };

  const handleResetFilters = () => {
    const cleared = getClearedFilters(filters.search);
    setDraftFilters(cleared);
    onFiltersChange(cleared);
    onClearFilters?.();
    setFiltersOpen(false);
  };

  const handleDateChange = (key: 'from' | 'to', value: string) => {
    setDraftFilters((current) => ({
      ...current,
      dateRange: {
        from: key === 'from' ? value || null : current.dateRange?.from ?? null,
        to: key === 'to' ? value || null : current.dateRange?.to ?? null,
      },
    }));
  };

  const onlyMine = (draftFilters.owners ?? []).includes(OWNER_ME);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Buscar lead pelo nome"
            aria-label="Buscar leads"
            className="h-9 bg-surface pl-9 pr-9"
          />
          {searchInput ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground"
              onClick={() => setSearchInput('')}
              aria-label="Limpar busca"
            >
              <X />
            </Button>
          ) : null}
        </div>

        <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" className="gap-2">
              <ListFilter aria-hidden="true" />
              Filtros
              {activeFiltersCount > 0 ? (
                <Badge variant="primary" className="h-5 min-w-5 px-1.5 tabular-nums">
                  {activeFiltersCount}
                </Badge>
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[400px] max-w-[calc(100vw-2rem)] p-0">
            <div className="max-h-[70vh] space-y-5 overflow-y-auto p-4">
              <Section title="Etapa">
                <div className="flex flex-wrap gap-1.5">
                  {filterOptions.stages.map((stage) => (
                    <ChipToggle
                      key={stage.id}
                      label={stage.label}
                      dotClassName={stageDotClass(stage.id)}
                      pressed={(draftFilters.stages ?? []).includes(stage.id)}
                      onToggle={() => setDraftFilters((current) => ({ ...current, stages: toggleItem(current.stages, stage.id) }))}
                    />
                  ))}
                </div>
              </Section>

              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="crm-filter-mine" className="font-normal">
                  Somente leads atribuídos a mim
                </Label>
                <Switch
                  id="crm-filter-mine"
                  checked={onlyMine}
                  onCheckedChange={(checked: boolean) =>
                    setDraftFilters((current) => ({
                      ...current,
                      owners: checked
                        ? Array.from(new Set([...(current.owners ?? []), OWNER_ME]))
                        : (current.owners ?? []).filter((entry) => entry !== OWNER_ME),
                    }))
                  }
                />
              </div>

              <Section title="Origem">
                <div className="flex flex-wrap gap-1.5">
                  {filterOptions.origins.map((origin) => (
                    <ChipToggle
                      key={origin.id}
                      label={origin.label}
                      pressed={(draftFilters.origins ?? []).includes(origin.id)}
                      onToggle={() => setDraftFilters((current) => ({ ...current, origins: toggleItem(current.origins, origin.id) }))}
                    />
                  ))}
                </div>
              </Section>

              <Section title="Criados entre">
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    aria-label="Criados a partir de"
                    value={draftFilters.dateRange?.from ?? ''}
                    onChange={(event) => handleDateChange('from', event.target.value)}
                  />
                  <span className="text-muted-foreground" aria-hidden="true">
                    –
                  </span>
                  <Input
                    type="date"
                    aria-label="Criados até"
                    value={draftFilters.dateRange?.to ?? ''}
                    onChange={(event) => handleDateChange('to', event.target.value)}
                  />
                </div>
              </Section>

              <Section title="Parados há pelo menos">
                <div className="flex flex-wrap items-center gap-1.5">
                  {[2, 3, 7, 15].map((days) => (
                    <ChipToggle
                      key={days}
                      label={`${days} dias`}
                      pressed={draftFilters.inactivityDays === days}
                      onToggle={() =>
                        setDraftFilters((current) => ({
                          ...current,
                          inactivityDays: current.inactivityDays === days ? null : days,
                        }))
                      }
                    />
                  ))}
                </div>
              </Section>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-border p-3">
              <Button type="button" variant="ghost" size="sm" onClick={handleResetFilters}>
                Limpar filtros
              </Button>
              <Button type="button" size="sm" onClick={handleApplyFilters}>
                Aplicar
              </Button>
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

        {trailing ? <div className="ml-auto flex items-center">{trailing}</div> : null}
      </div>

      {chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Filtros ativos">
          {chips.map((chip) => (
            <Badge key={chip.id} variant="secondary" className="gap-1 py-1 pl-2.5 pr-1 text-foreground">
              {chip.label}
              <button
                type="button"
                className="rounded-full p-0.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                onClick={() => onFiltersChange(normalizeCrmFilters(chip.remove(filters)))}
                aria-label={`Remover filtro ${chip.label}`}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
          <Button type="button" variant="link" size="xs" className="text-muted-foreground" onClick={handleResetFilters}>
            Limpar tudo
          </Button>
        </div>
      ) : null}
    </div>
  );
};

export default CrmToolbar;
