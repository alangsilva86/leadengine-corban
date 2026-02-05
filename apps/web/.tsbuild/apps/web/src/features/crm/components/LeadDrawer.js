import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, DrawerClose, } from '@/components/ui/drawer.jsx';
import { Button } from '@/components/ui/button.jsx';
import { ScrollArea } from '@/components/ui/scroll-area.jsx';
import useLeadDetails from '../hooks/useLeadDetails';
import useLeadTimeline from '../hooks/useLeadTimeline';
import useLeadTasks from '../hooks/useLeadTasks';
import LeadHeader from './lead-drawer/LeadHeader';
import LeadActionList from './lead-drawer/LeadActionList';
import LeadTimeline from './lead-drawer/LeadTimeline';
import LeadTaskList from './lead-drawer/LeadTaskList';
import { useCrmViewContext } from '../state/view-context';
import useCrmPermissions from '../state/permissions';
import emitCrmTelemetry from '../utils/telemetry';
const LeadDrawer = ({ open, leadId, onOpenChange }) => {
    const { toggleRealtime } = useCrmViewContext();
    const permissions = useCrmPermissions();
    const { lead, isLoading: leadLoading } = useLeadDetails(leadId);
    const { timeline, isLoading: timelineLoading } = useLeadTimeline(leadId);
    const { tasks, isLoading: tasksLoading } = useLeadTasks(leadId);
    useEffect(() => {
        if (open) {
            toggleRealtime(false);
            return () => toggleRealtime(true);
        }
        return undefined;
    }, [open, toggleRealtime]);
    const ready = useMemo(() => Boolean(lead) && !leadLoading, [lead, leadLoading]);
    return (_jsx(Drawer, { open: open, onOpenChange: onOpenChange, direction: "right", children: _jsxs(DrawerContent, { className: "flex h-full max-h-full w-full flex-col sm:max-w-2xl", children: [_jsxs(DrawerHeader, { className: "border-b border-border/60 pb-4", children: [_jsx(DrawerTitle, { children: "Lead" }), _jsx(DrawerDescription, { children: "Detalhes, hist\u00F3rico e pr\u00F3ximos passos." })] }), _jsx(ScrollArea, { className: "flex-1", children: _jsxs("div", { className: "flex flex-col gap-6 p-6", children: [ready && lead ? _jsx(LeadHeader, { lead: lead }) : _jsx("div", { className: "h-32 animate-pulse rounded-lg bg-muted/40" }), _jsxs("section", { className: "space-y-3", children: [_jsx("h3", { className: "text-sm font-semibold text-foreground", children: "A\u00E7\u00F5es r\u00E1pidas" }), _jsx(LeadActionList, { onMarkConnected: () => emitCrmTelemetry('crm.lead.open', { action: 'mark_connected', leadId }), onScheduleFollowUp: () => emitCrmTelemetry('crm.lead.open', { action: 'schedule_follow_up', leadId }), onSendMessage: () => emitCrmTelemetry('crm.lead.open', { action: 'send_message', leadId }), onEditLead: () => emitCrmTelemetry('crm.lead.open', { action: 'edit_lead', leadId }), canManageTasks: permissions.canManageTasks, canEditLead: permissions.canEditLead })] }), _jsxs("section", { className: "space-y-3", children: [_jsx("h3", { className: "text-sm font-semibold text-foreground", children: "Timeline" }), timelineLoading ? _jsx("div", { className: "h-24 animate-pulse rounded-lg bg-muted/40" }) : _jsx(LeadTimeline, { events: timeline })] }), _jsxs("section", { className: "space-y-3", children: [_jsx("h3", { className: "text-sm font-semibold text-foreground", children: "Pr\u00F3ximas tarefas" }), tasksLoading ? _jsx("div", { className: "h-24 animate-pulse rounded-lg bg-muted/40" }) : _jsx(LeadTaskList, { tasks: tasks })] })] }) }), _jsxs(DrawerFooter, { className: "flex items-center justify-between border-t border-border/60 bg-muted/20 py-4", children: [_jsxs("span", { className: "text-xs text-muted-foreground", children: ["ID do lead: ", leadId ?? 'desconhecido'] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(DrawerClose, { asChild: true, children: _jsx(Button, { type: "button", variant: "outline", children: "Fechar" }) }), _jsx(Button, { type: "button", onClick: () => emitCrmTelemetry('crm.insights.navigate', { targetView: 'list', entry: 'drawer_footer', leadId }), children: "Ver detalhes completos" })] })] })] }) }));
};
export default LeadDrawer;
