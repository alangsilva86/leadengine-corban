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
import { cn } from '@/lib/utils.js';
import { Filter, RefreshCw } from 'lucide-react';

const CONTEXT_TABS = [
  { id: 'overview', label: 'Visão Geral' },
  { id: 'agreements', label: 'Convênios' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'inbox', label: 'Inbox' },
];

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
  const [contextTab, setContextTab] = useState('inbox');

  const effectiveFilters = useMemo(
    () => ({
      scope: filters?.scope ?? 'team',
      state: filters?.state ?? 'open',
      window: filters?.window ?? 'in_window',
      outcome: filters?.outcome ?? 'all',
    }),
    [filters]
  );

  const applyFilters = (updater) => {
    if (typeof onFiltersChange !== 'function') return;
    onFiltersChange((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      return { ...current, ...next };
    });
  };

  return (
    <div className="space-y-4 rounded-xl border border-slate-900/70 bg-slate-950/80 p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        {CONTEXT_TABS.map((tab) => {
          const active = tab.id === contextTab;
          return (
            <Button
              key={tab.id}
              variant={active ? 'default' : 'ghost'}
              size="sm"
              className={cn(
                'rounded-full border border-slate-900/70 px-4 text-xs font-medium uppercase tracking-wide',
                active ? 'bg-sky-600 text-white hover:bg-sky-600/90' : 'text-slate-300 hover:bg-slate-900'
              )}
              onClick={() => setContextTab(tab.id)}
            >
              {tab.label}
            </Button>
          );
        })}

        <div className="ml-auto flex items-center gap-2">
          <Input
            value={search}
            onChange={(event) => onSearchChange?.(event.target.value)}
            placeholder="Buscar tickets, contatos..."
            className="h-9 w-64 bg-slate-900/70 text-slate-100 placeholder:text-slate-500"
          />
          <Button
            variant="outline"
            size="sm"
            className="border-slate-800 bg-slate-900/60 text-slate-200 hover:bg-slate-900"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            <span className="ml-2 text-xs font-medium">Sincronizar</span>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-500" />
          <span className="font-semibold text-slate-200">Quadro atual</span>
        </div>

        <Select
          value={effectiveFilters.scope}
          onValueChange={(value) => applyFilters({ scope: value })}
        >
          <SelectTrigger size="sm" className="min-w-[120px] bg-slate-900/70 text-slate-100">
            <SelectValue placeholder="Equipe" />
          </SelectTrigger>
          <SelectContent>
            {SCOPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={effectiveFilters.state}
          onValueChange={(value) => applyFilters({ state: value })}
        >
          <SelectTrigger size="sm" className="min-w-[140px] bg-slate-900/70 text-slate-100">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={effectiveFilters.window}
          onValueChange={(value) => applyFilters({ window: value })}
        >
          <SelectTrigger size="sm" className="min-w-[150px] bg-slate-900/70 text-slate-100">
            <SelectValue placeholder="Janela" />
          </SelectTrigger>
          <SelectContent>
            {WINDOW_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={effectiveFilters.outcome}
          onValueChange={(value) => applyFilters({ outcome: value })}
        >
          <SelectTrigger size="sm" className="min-w-[140px] bg-slate-900/70 text-slate-100">
            <SelectValue placeholder="Resultado" />
          </SelectTrigger>
          <SelectContent>
            {OUTCOME_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {SAVED_PRESETS.map((preset) => (
            <Badge
              key={preset.id}
              variant="outline"
              className="cursor-pointer border-slate-800/80 bg-slate-900/60 px-3 py-1 text-[11px] font-medium text-slate-200 hover:bg-slate-900"
              onClick={() => applyFilters(preset.filters)}
            >
              {preset.label}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FilterToolbar;
