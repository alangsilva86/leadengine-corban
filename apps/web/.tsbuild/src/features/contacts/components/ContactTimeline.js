import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { ScrollArea } from '@/components/ui/scroll-area.jsx';
const formatTimestamp = (value) => {
    if (!value) {
        return 'há instantes';
    }
    try {
        const date = typeof value === 'string' ? parseISO(value) : new Date(value);
        return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
    }
    catch {
        return 'há instantes';
    }
};
const ContactTimeline = ({ items = [] }) => (_jsxs(Card, { className: "h-full", children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Timeline" }) }), _jsx(CardContent, { className: "h-full min-h-[300px]", children: items.length === 0 ? (_jsx("p", { className: "text-sm text-muted-foreground", children: "Nenhuma intera\u00E7\u00E3o registrada para este contato." })) : (_jsx(ScrollArea, { className: "h-[360px] pr-4", children: _jsx("ol", { className: "space-y-4 text-sm", children: items.map((item) => (_jsxs("li", { className: "rounded-lg border border-border/70 p-4", children: [_jsxs("div", { className: "flex items-center justify-between text-xs text-muted-foreground", children: [_jsx("span", { className: "font-medium uppercase tracking-wide", children: item.type ?? 'interação' }), _jsx("span", { children: formatTimestamp(item.createdAt) })] }), _jsx("p", { className: "mt-2 text-sm leading-relaxed text-foreground", children: item.description ?? item.message ?? 'Evento registrado na linha do tempo.' }), item.metadata ? (_jsx("pre", { className: "mt-3 overflow-x-auto rounded-md bg-muted/40 p-3 text-xs text-muted-foreground", children: JSON.stringify(item.metadata, null, 2) })) : null] }, item.id))) }) })) })] }));
export default ContactTimeline;
