import type { ComponentType } from 'react';
import { Activity, CalendarRange, ChevronDown, Hourglass, KanbanSquare, List, ListTree, MoreHorizontal } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group.jsx';
import { Button } from '@/components/ui/button.jsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.jsx';
import { cn } from '@/lib/utils.js';
import type { CrmViewType } from '../state/view-context';
import { useCrmViewContext } from '../state/view-context';

type CrmViewSwitcherProps = {
  onViewChange?: (view: CrmViewType) => void;
  className?: string;
};

type ViewOption = { id: CrmViewType; label: string; icon: ComponentType<{ className?: string }> };

/** Visões do dia a dia. */
export const PRIMARY_VIEWS: ViewOption[] = [
  { id: 'kanban', label: 'Funil', icon: KanbanSquare },
  { id: 'list', label: 'Lista', icon: List },
  { id: 'calendar', label: 'Agenda', icon: CalendarRange },
];

/** Visões de análise, agrupadas em "Mais visões". */
export const SECONDARY_VIEWS: ViewOption[] = [
  { id: 'timeline', label: 'Atividades', icon: ListTree },
  { id: 'aging', label: 'Envelhecimento', icon: Hourglass },
  { id: 'insights', label: 'Painel', icon: Activity },
];

export const ALL_VIEWS = [...PRIMARY_VIEWS, ...SECONDARY_VIEWS];

const CrmViewSwitcher = ({ onViewChange, className }: CrmViewSwitcherProps) => {
  const {
    state: { view },
    setView,
  } = useCrmViewContext();

  const handleChange = (next: string) => {
    if (!next || next === view) {
      return;
    }
    setView(next as CrmViewType);
    onViewChange?.(next as CrmViewType);
  };

  const activeSecondary = SECONDARY_VIEWS.find((option) => option.id === view) ?? null;
  const SecondaryIcon = activeSecondary?.icon ?? null;

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <ToggleGroup
        type="single"
        size="sm"
        value={activeSecondary ? '' : view}
        onValueChange={handleChange}
        aria-label="Visão do CRM"
        className="rounded-md border border-border bg-surface p-0.5"
      >
        {PRIMARY_VIEWS.map((option) => {
          const Icon = option.icon;
          return (
            <ToggleGroupItem
              key={option.id}
              value={option.id}
              aria-label={option.label}
              className="h-7 flex-none gap-1.5 rounded-[5px] px-2.5 text-muted-foreground first:rounded-[5px] last:rounded-[5px] hover:bg-surface-hover hover:text-foreground data-[state=on]:text-primary-soft-foreground"
            >
              <Icon className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">{option.label}</span>
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant={activeSecondary ? 'soft' : 'ghost'}
            size="sm"
            className={cn('gap-1.5', !activeSecondary && 'text-muted-foreground')}
            aria-label={activeSecondary ? `Visão: ${activeSecondary.label}. Mais visões` : 'Mais visões'}
          >
            {SecondaryIcon ? (
              <SecondaryIcon className="size-4" aria-hidden="true" />
            ) : (
              <MoreHorizontal className="size-4 md:hidden" aria-hidden="true" />
            )}
            <span className={cn(!activeSecondary && 'hidden md:inline')}>{activeSecondary?.label ?? 'Mais visões'}</span>
            <ChevronDown className="size-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuRadioGroup value={view} onValueChange={handleChange}>
            {SECONDARY_VIEWS.map((option) => {
              const Icon = option.icon;
              return (
                <DropdownMenuRadioItem key={option.id} value={option.id}>
                  <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                  {option.label}
                </DropdownMenuRadioItem>
              );
            })}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default CrmViewSwitcher;
