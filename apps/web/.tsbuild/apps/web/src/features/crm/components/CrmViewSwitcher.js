import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import { MonitorSmartphone, CalendarRange, KanbanSquare, List, Activity, Hourglass } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group.jsx';
import { cn } from '@/lib/utils.js';
import { useCrmViewContext } from '../state/view-context';
const VIEW_OPTIONS = [
    { id: 'kanban', label: 'Kanban', icon: KanbanSquare },
    { id: 'list', label: 'Lista', icon: List },
    { id: 'calendar', label: 'Agenda', icon: CalendarRange },
    { id: 'timeline', label: 'Timeline', icon: MonitorSmartphone },
    { id: 'aging', label: 'Envelhecimento', icon: Hourglass },
    { id: 'insights', label: 'Painel', icon: Activity },
];
const CrmViewSwitcher = ({ onViewChange }) => {
    const { state: { view }, setView, } = useCrmViewContext();
    const options = useMemo(() => VIEW_OPTIONS, []);
    return (_jsx(ToggleGroup, { type: "single", value: view, onValueChange: (next) => {
            if (!next) {
                return;
            }
            setView(next);
            onViewChange?.(next);
        }, className: "flex flex-wrap gap-2", children: options.map((option) => {
            const Icon = option.icon;
            const isActive = option.id === view;
            return (_jsxs(ToggleGroupItem, { value: option.id, className: cn('inline-flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm font-medium transition', isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-background text-muted-foreground hover:text-foreground'), children: [_jsx(Icon, { className: "h-4 w-4" }), _jsx("span", { children: option.label })] }, option.id));
        }) }));
};
export default CrmViewSwitcher;
