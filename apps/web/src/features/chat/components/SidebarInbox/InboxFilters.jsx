import { useCallback } from 'react';
import { Input } from '@/components/ui/input.jsx';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group.jsx';
import { Button } from '@/components/ui/button.jsx';
import { RefreshCcw } from 'lucide-react';

const scopeOptions = [
  { value: 'mine', label: 'Meus' },
  { value: 'team', label: 'Time' },
  { value: 'all', label: 'Todos' },
];

const windowOptions = [
  { value: 'in_window', label: 'Em janela 24h' },
  { value: 'expired', label: 'Expirados' },
];

const outcomeOptions = [
  { value: 'won', label: 'Ganho' },
  { value: 'lost', label: 'Sem interesse' },
];

export const InboxFilters = ({
  filters,
  onFiltersChange,
  search,
  onSearchChange,
  onRefresh,
  loading,
}) => {
  const handleScopeChange = useCallback(
    (value) => {
      if (typeof onFiltersChange === 'function') {
        onFiltersChange({ scope: value || 'team' });
      }
    },
    [onFiltersChange]
  );

  const handleWindowChange = useCallback(
    (value) => {
      if (typeof onFiltersChange === 'function') {
        onFiltersChange({ window: value || 'in_window' });
      }
    },
    [onFiltersChange]
  );

  const handleOutcomeChange = useCallback(
    (value) => {
      if (typeof onFiltersChange === 'function') {
        onFiltersChange({ outcome: value || null });
      }
    },
    [onFiltersChange]
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Input
          value={search}
          onChange={(event) => onSearchChange?.(event.target.value)}
          placeholder="Buscar por nome, telefone, CPF, matrícula, ID..."
          className="flex-1 bg-slate-900/70 text-[13px] text-foreground placeholder:text-muted-foreground/60"
        />
        <Button
          variant="outline"
          size="sm"
          className="border-slate-700/60 bg-slate-900/70 text-[13px] font-semibold text-sky-200"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCcw className={loading ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
          {loading ? 'Sincronizando…' : 'Sincronizar' }
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 text-[13px] text-muted-foreground/80">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/70">Responsável</span>
          <ToggleGroup
            type="single"
            value={filters.scope}
            onValueChange={handleScopeChange}
            variant="outline"
            size="sm"
            className="bg-slate-950/80"
          >
            {scopeOptions.map((option) => (
              <ToggleGroupItem key={option.value} value={option.value}>
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/70">Janela</span>
          <ToggleGroup
            type="single"
            value={filters.window}
            onValueChange={handleWindowChange}
            variant="outline"
            size="sm"
            className="bg-slate-950/80"
          >
            {windowOptions.map((option) => (
              <ToggleGroupItem key={option.value} value={option.value}>
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/70">Resultado</span>
          <ToggleGroup
            type="single"
            value={filters.outcome ?? undefined}
            onValueChange={handleOutcomeChange}
            variant="outline"
            size="sm"
            className="bg-slate-950/80"
          >
            {outcomeOptions.map((option) => (
              <ToggleGroupItem key={option.value} value={option.value}>
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>
    </div>
  );
};

export default InboxFilters;
