import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ArrowRight, MapPin } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { cn } from '@/lib/utils.js';
const formatLastSync = (lastSyncAt) => {
    if (!lastSyncAt) {
        return '—';
    }
    const date = lastSyncAt instanceof Date ? lastSyncAt : new Date(lastSyncAt);
    if (Number.isNaN(date.getTime())) {
        return '—';
    }
    return date.toLocaleString();
};
const AgreementCard = ({ name, description, region, tags = [], availableLeads, hotLeads, lastSyncAt, isSelected = false, onSelect, actionLabel, className, badgeVariant, ...cardProps }) => {
    const formattedLastSync = formatLastSync(lastSyncAt);
    const resolvedActionLabel = actionLabel ?? (isSelected ? 'Convênio selecionado' : 'Ativar leads');
    const resolvedBadgeVariant = badgeVariant ?? (isSelected ? 'secondary' : 'info');
    return (_jsxs(Card, { className: cn('transition-colors duration-200', isSelected
            ? 'border-[color-mix(in_oklab,_var(--primary)_55%,_transparent)] shadow-[0_0_0_1px_rgba(99,102,241,0.35)]'
            : 'border-[var(--border)]', className), ...cardProps, children: [_jsx(CardHeader, { children: _jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { children: [_jsx(CardTitle, { className: "text-lg font-semibold", children: name }), description ? _jsx(CardDescription, { children: description }) : null] }), region ? (_jsxs(Badge, { variant: resolvedBadgeVariant, children: [_jsx(MapPin, { className: "mr-1 h-3 w-3" }), region] })) : null] }) }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between text-sm", children: [_jsxs("div", { children: [_jsx("p", { className: "text-muted-foreground", children: "Leads dispon\u00EDveis" }), _jsx("p", { className: "text-lg font-semibold text-foreground", children: availableLeads })] }), _jsxs("div", { className: "text-right", children: [_jsx("p", { className: "text-muted-foreground", children: "Leads quentes" }), _jsx("p", { className: "text-lg font-semibold text-foreground", children: hotLeads })] })] }), tags.length ? (_jsx("div", { className: "flex flex-wrap gap-2", children: tags.map((tag) => (_jsx(Badge, { variant: "outline", children: tag }, tag))) })) : null] }), _jsxs(CardFooter, { className: "flex items-center justify-between", children: [_jsxs("div", { className: "text-xs text-muted-foreground", children: ["Atualizado em ", formattedLastSync] }), _jsxs(Button, { size: "sm", onClick: onSelect, variant: isSelected ? 'default' : 'outline', children: [resolvedActionLabel, _jsx(ArrowRight, { className: "ml-2 h-4 w-4" })] })] })] }));
};
export default AgreementCard;
