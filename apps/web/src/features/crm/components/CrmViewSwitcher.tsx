import { useMemo } from 'react';
import type { ComponentType } from 'react';
import { MonitorSmartphone, CalendarRange, KanbanSquare, List, Activity, Hourglass } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group.jsx';
import { cn } from '@/lib/utils.js';
import type { CrmViewType } from '../state/view-context.tsx';
import { useCrmViewContext } from '../state/view-context.tsx';

type CrmViewSwitcherProps = {
  onViewChange?: (view: CrmViewType) => void;
};

const VIEW_OPTIONS: Array<{ id: CrmViewType; label: string; icon: ComponentType<{ className?: string }> }> = [
  { id: 'kanban', label: 'Kanban', icon: KanbanSquare },
  { id: 'list', label: 'Lista', icon: List },
  { id: 'calendar', label: 'Agenda', icon: CalendarRange },
  { id: 'timeline', label: 'Timeline', icon: MonitorSmartphone },
  { id: 'aging', label: 'Envelhecimento', icon: Hourglass },
  { id: 'insights', label: 'Painel', icon: Activity },
];

const CrmViewSwitcher = ({ onViewChange }: CrmViewSwitcherProps) => {
  const {
    state: { view },
    setView,
  } = useCrmViewContext();

  const options = useMemo(() => VIEW_OPTIONS, []);

  return (
    <ToggleGroup
      type="single"
      value={view}
      onValueChange={(next) => {
        if (!next) {
          return;
        }
        setView(next as CrmViewType);
        onViewChange?.(next as CrmViewType);
      }}
      className="flex flex-wrap gap-2"
    >
      {options.map((option) => {
        const Icon = option.icon;
        const isActive = option.id === view;
        return (
          <ToggleGroupItem
            key={option.id}
            value={option.id}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm font-medium transition',
              isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-background text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{option.label}</span>
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
};

export default CrmViewSwitcher;
