import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { addDays, endOfWeek, format, isSameDay, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar.jsx';
import { Card } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { ScrollArea } from '@/components/ui/scroll-area.jsx';
import useCrmTasks from '../hooks/useCrmTasks';
import { useCrmViewContext, useCrmViewState } from '../state/view-context';
import useCrmPermissions from '../state/permissions';
import emitCrmTelemetry from '../utils/telemetry';
const getDefaultRange = () => {
    const today = new Date();
    return { from: startOfWeek(today, { locale: ptBR }), to: endOfWeek(today, { locale: ptBR }) };
};
const LeadCalendarView = () => {
    const { filters } = useCrmViewState();
    const { openLeadDrawer, selectIds, clearSelection } = useCrmViewContext();
    const permissions = useCrmPermissions();
    const [range, setRange] = useState(getDefaultRange);
    const [focusDay, setFocusDay] = useState(() => range.from);
    const { tasks, isLoading } = useCrmTasks(filters, range);
    const tasksByDate = useMemo(() => {
        const map = {};
        tasks.forEach((task) => {
            const dateKey = format(new Date(task.dueDate), 'yyyy-MM-dd');
            if (!map[dateKey]) {
                map[dateKey] = [];
            }
            map[dateKey].push(task);
        });
        return map;
    }, [tasks]);
    const daysInRange = useMemo(() => {
        const days = [];
        let current = range.from;
        while (current <= range.to) {
            days.push(current);
            current = addDays(current, 1);
        }
        return days;
    }, [range]);
    const focusedTasks = tasks.filter((task) => isSameDay(new Date(task.dueDate), focusDay));
    return (_jsxs("div", { className: "flex flex-col gap-6 lg:flex-row", children: [_jsxs(Card, { className: "w-full max-w-md border border-border/60 bg-background/90 p-4", children: [_jsx(Calendar, { mode: "range", selected: { from: range.from, to: range.to }, onSelect: (value) => {
                            if (!value || !value.from || !value.to) {
                                return;
                            }
                            setRange({ from: value.from, to: value.to });
                            setFocusDay(value.from);
                        }, weekStartsOn: 1, numberOfMonths: 1, locale: ptBR }), _jsxs("div", { className: "mt-4 space-y-2", children: [_jsxs("p", { className: "text-sm text-muted-foreground", children: ["Selecionado: ", format(range.from, "dd 'de' MMMM", { locale: ptBR }), " \u2192 ", format(range.to, "dd 'de' MMMM", { locale: ptBR })] }), _jsx(Button, { type: "button", variant: "outline", size: "sm", onClick: () => {
                                    const next = getDefaultRange();
                                    setRange(next);
                                    setFocusDay(next.from);
                                    emitCrmTelemetry('crm.metrics.refresh', { source: 'calendar', range: next });
                                }, children: "Voltar para esta semana" })] })] }), _jsxs("div", { className: "flex-1 space-y-4", children: [_jsx(ScrollArea, { className: "max-h-[220px] rounded-xl border border-border/60 bg-background/70 p-4", children: _jsx("div", { className: "space-y-3", children: daysInRange.map((day) => {
                                const key = format(day, 'yyyy-MM-dd');
                                const dayTasks = tasksByDate[key] ?? [];
                                return (_jsxs("button", { type: "button", className: "flex w-full items-center justify-between rounded-lg border border-border/50 bg-background px-4 py-3 text-left text-sm transition hover:border-primary", onClick: () => setFocusDay(day), children: [_jsxs("span", { children: [_jsx("span", { className: "font-medium text-foreground", children: format(day, "EEE, dd 'de' MMM", { locale: ptBR }) }), _jsxs("span", { className: "ml-2 text-xs text-muted-foreground", children: [dayTasks.length, " tarefa(s)"] })] }), dayTasks.some((task) => task.status === 'overdue') ? _jsx(Badge, { variant: "destructive", children: "Atraso" }) : null] }, key));
                            }) }) }), _jsxs(Card, { className: "h-[360px] border border-border/60 bg-background/90 p-4", children: [_jsxs("header", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-base font-semibold text-foreground", children: format(focusDay, "dd 'de' MMMM, EEEE", { locale: ptBR }) }), _jsxs("p", { className: "text-xs text-muted-foreground", children: [focusedTasks.length, " tarefa(s) planejadas"] })] }), _jsx(Button, { type: "button", size: "sm", variant: "outline", disabled: !permissions.canManageTasks, children: "Reagendar selecionadas" })] }), _jsx("div", { className: "mt-4 flex h-full flex-col gap-3 overflow-y-auto", children: isLoading && focusedTasks.length === 0 ? (Array.from({ length: 3 }).map((_, index) => _jsx("div", { className: "h-16 animate-pulse rounded-lg bg-muted/40" }, index))) : focusedTasks.length === 0 ? (_jsx("div", { className: "flex flex-1 items-center justify-center text-sm text-muted-foreground", children: "Nenhuma tarefa para este dia." })) : (focusedTasks.map((task) => {
                                    const dueDate = format(new Date(task.dueDate), 'HH:mm');
                                    return (_jsxs("div", { className: "flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background px-4 py-3 text-sm", children: [_jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("span", { className: "font-medium text-foreground", children: task.title }), _jsxs("span", { className: "text-xs text-muted-foreground", children: [dueDate, " \u2022 ", task.leadName ?? 'Lead sem nome'] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Badge, { variant: task.status === 'completed' ? 'secondary' : task.status === 'overdue' ? 'destructive' : 'outline', children: task.status === 'completed' ? 'Concluída' : task.status === 'overdue' ? 'Atrasada' : 'Pendente' }), _jsx(Button, { type: "button", size: "sm", disabled: !permissions.canManageTasks, onClick: () => {
                                                            if (!task.leadId || !permissions.canManageTasks) {
                                                                return;
                                                            }
                                                            clearSelection();
                                                            selectIds([task.leadId]);
                                                            openLeadDrawer(task.leadId);
                                                            emitCrmTelemetry('crm.lead.open', {
                                                                source: 'calendar',
                                                                leadId: task.leadId,
                                                                taskId: task.id,
                                                            });
                                                        }, children: "Ver lead" })] })] }, task.id));
                                })) })] })] })] }));
};
export default LeadCalendarView;
