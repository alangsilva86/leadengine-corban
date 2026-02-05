import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Building2, Mail, Phone, User, Workflow, CalendarClock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import LeadHealthBadge from './LeadHealthBadge';
const formatRelativeTime = (value) => {
    if (!value) {
        return 'Sem atividade recente';
    }
    try {
        return `Última atividade ${formatDistanceToNow(new Date(value), { addSuffix: true, locale: ptBR })}`;
    }
    catch {
        return 'Última atividade indisponível';
    }
};
const LeadHeader = ({ lead }) => {
    return (_jsxs("section", { className: "space-y-3", children: [_jsxs("div", { className: "flex flex-wrap items-start justify-between gap-3", children: [_jsxs("div", { className: "space-y-1", children: [_jsxs("div", { className: "flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground", children: [_jsx(Workflow, { className: "h-4 w-4" }), _jsx("span", { children: lead.stage ?? 'Etapa desconhecida' })] }), _jsx("h2", { className: "text-xl font-semibold text-foreground", children: lead.name }), _jsx("p", { className: "text-sm text-muted-foreground", children: formatRelativeTime(lead.lastActivityAt) })] }), _jsx(LeadHealthBadge, { status: lead.health ?? undefined })] }), _jsxs("div", { className: "grid gap-3 rounded-lg border border-border/60 bg-muted/20 p-3 text-sm text-muted-foreground sm:grid-cols-2", children: [_jsxs("span", { className: "flex items-center gap-2", children: [_jsx(User, { className: "h-4 w-4" }), "Respons\u00E1vel: ", _jsx("strong", { className: "text-foreground", children: lead.ownerName ?? 'Não atribuído' })] }), _jsxs("span", { className: "flex items-center gap-2", children: [_jsx(Building2, { className: "h-4 w-4" }), "Empresa: ", _jsx("strong", { className: "text-foreground", children: lead.company ?? 'Não informado' })] }), _jsxs("span", { className: "flex items-center gap-2", children: [_jsx(Mail, { className: "h-4 w-4" }), _jsx("a", { href: lead.email ? `mailto:${lead.email}` : '#', className: "text-primary hover:underline", children: lead.email ?? 'Sem e-mail' })] }), _jsxs("span", { className: "flex items-center gap-2", children: [_jsx(Phone, { className: "h-4 w-4" }), _jsx("a", { href: lead.phone ? `tel:${lead.phone}` : '#', className: "text-primary hover:underline", children: lead.phone ?? 'Sem telefone' })] }), _jsxs("span", { className: "flex items-center gap-2", children: [_jsx(CalendarClock, { className: "h-4 w-4" }), "Canal: ", _jsx("strong", { className: "text-foreground", children: lead.channel ?? 'Desconhecido' })] })] })] }));
};
export default LeadHeader;
