import { useMemo, useState } from 'react';
import { Filter, Plus, Save, SlidersHorizontal, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import { cn } from '@/lib/utils.js';

import StatusFilter from './StatusFilter.jsx';

const renderOptionLabel = (label, count) => {
  if (typeof count !== 'number') {
    return label;
  }
  return `${label} (${count})`;
};

const SavedViewChip = ({ view, isActive, onSelect, onDelete }) => {
  return (
    <div className="group flex items-center gap-1">
      <button
        type="button"
        onClick={() => onSelect(view)}
        className={cn(
          'flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          isActive
            ? 'border-primary/60 bg-primary/10 text-primary-foreground focus-visible:ring-primary'
            : 'hover:border-primary/40 hover:text-foreground focus-visible:ring-ring'
        )}
      >
        <span>{view.name}</span>
        <Badge
          variant={isActive ? 'info' : 'outline'}
          className="border border-[color:var(--color-inbox-border)] px-2 text-xs text-muted-foreground/80"
        >
          {view.count ?? 0}
        </Badge>
      </button>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onDelete(view)}
            className="rounded-full p-1 text-muted-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label={`Remover visão ${view.name}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Remover visão salva</TooltipContent>
      </Tooltip>
    </div>
  );
};

export const GlobalFiltersBar = ({
  filters,
  onUpdateFilters,
  onResetFilters,
  queueOptions,
  windowOptions,
  savedViews,
  activeViewId,
  onSelectSavedView,
  onSaveCurrentView,
  onDeleteSavedView,
  canSaveView,
  viewLimit,
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const queueLabel = useMemo(() => {
    const option = queueOptions.find((item) => item.value === filters.queue);
    return option?.label ?? 'Todas as filas';
  }, [filters.queue, queueOptions]);

  const windowLabel = useMemo(() => {
    const option = windowOptions.find((item) => item.value === filters.timeWindow);
    return option?.label ?? 'Qualquer período';
  }, [filters.timeWindow, windowOptions]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Filter className="h-4 w-4" />
          <span>Filtro rápido</span>
        </div>

        <StatusFilter
          value={filters.status}
          onChange={(status) => onUpdateFilters({ status })}
        />

        <Select
          value={filters.queue}
          onValueChange={(value) => onUpdateFilters({ queue: value })}
        >
          <SelectTrigger className="h-9 min-w-[180px] text-xs">
            <SelectValue placeholder="Fila">
              {renderOptionLabel(queueLabel, queueOptions.find((item) => item.value === filters.queue)?.count)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {queueOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {renderOptionLabel(option.label, option.count)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.timeWindow}
          onValueChange={(value) => onUpdateFilters({ timeWindow: value })}
        >
          <SelectTrigger className="h-9 min-w-[160px] text-xs">
            <SelectValue placeholder="Janela">
              {windowLabel}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {windowOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DrawerTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 text-xs">
              <SlidersHorizontal className="h-4 w-4" /> Mais filtros
            </Button>
          </DrawerTrigger>
          <DrawerContent className="sm:max-w-md">
            <DrawerHeader>
              <DrawerTitle>Filtros avançados</DrawerTitle>
              <p className="text-sm text-muted-foreground">
                Ajuste critérios menos frequentes. As preferências ficam salvas para o seu usuário.
              </p>
            </DrawerHeader>

            <div className="flex flex-col gap-4 px-4 pb-4">
              <div className="space-y-2">
                <Label htmlFor="inbox-search">Buscar por nome, CPF ou telefone</Label>
                <Input
                  id="inbox-search"
                  placeholder="Digite um termo de busca"
                  value={filters.search}
                  onChange={(event) => onUpdateFilters({ search: event.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="inbox-min-score">Score mínimo</Label>
                  <Input
                    id="inbox-min-score"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max="1000"
                    placeholder="0"
                    value={filters.minScore ?? ''}
                    onChange={(event) => {
                      const value = event.target.value;
                      onUpdateFilters({ minScore: value === '' ? null : Number(value) });
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inbox-min-margin">Margem mínima (R$)</Label>
                  <Input
                    id="inbox-min-margin"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="100"
                    placeholder="0"
                    value={filters.minMargin ?? ''}
                    onChange={(event) => {
                      const value = event.target.value;
                      onUpdateFilters({ minMargin: value === '' ? null : Number(value) });
                    }}
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Checkbox
                  checked={filters.hasPhoneOnly}
                  onCheckedChange={(checked) =>
                    onUpdateFilters({ hasPhoneOnly: Boolean(checked) })
                  }
                />
                Exibir apenas leads com telefone válido
              </label>
            </div>

            <DrawerFooter>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <DrawerClose asChild>
                  <Button variant="ghost" size="sm">
                    Fechar
                  </Button>
                </DrawerClose>
                <Button variant="outline" size="sm" onClick={onResetFilters}>
                  Limpar filtros
                </Button>
              </div>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Save className="h-4 w-4" />
          <span>Views salvas</span>
        </div>

        {savedViews.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Salve uma combinação de filtros para acompanhar filas ou SLAs específicos.
          </p>
        ) : (
          savedViews.map((view) => (
            <SavedViewChip
              key={view.id}
              view={view}
              isActive={activeViewId === view.id}
              onSelect={onSelectSavedView}
              onDelete={onDeleteSavedView}
            />
          ))
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 text-xs"
                onClick={onSaveCurrentView}
                disabled={!canSaveView}
              >
                <Plus className="h-4 w-4" /> Salvar visão atual
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {canSaveView
              ? `Você pode salvar até ${viewLimit} visões personalizadas.`
              : 'Limite de visões atingido ou filtros já salvos.'}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};

export default GlobalFiltersBar;
