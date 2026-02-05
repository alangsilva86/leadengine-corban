import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
const iconMap = {
    note: '📝',
    call: '📞',
    meeting: '📅',
    task: '✅',
    status_change: '🔄',
    message: '💬',
};
const LeadTimeline = ({ events }) => {
    if (!events.length) {
        return _jsx("p", { className: "text-sm text-muted-foreground", children: "Nenhum evento registrado para este lead." });
    }
    return (_jsx("ol", { className: "space-y-3", children: events.map((event) => {
            const icon = iconMap[event.type] ?? '•';
            let timestamp = '';
            try {
                timestamp = format(new Date(event.timestamp), "dd 'de' MMM 'às' HH:mm", { locale: ptBR });
            }
            catch {
                timestamp = event.timestamp;
            }
            return (_jsxs("li", { className: "rounded-lg border border-border/50 bg-background/60 p-3 shadow-sm", children: [_jsxs("div", { className: "flex items-center gap-2 text-xs text-muted-foreground", children: [_jsx("span", { className: "text-base", "aria-hidden": true, children: icon }), _jsx("span", { children: timestamp }), event.author ? _jsxs("span", { className: "text-muted-foreground/80", children: ["\u2022 ", event.author] }) : null] }), _jsx("h4", { className: "mt-2 text-sm font-semibold text-foreground", children: event.title }), event.description ? _jsx("p", { className: "text-sm text-muted-foreground", children: event.description }) : null] }, event.id));
        }) }));
};
export default LeadTimeline;
