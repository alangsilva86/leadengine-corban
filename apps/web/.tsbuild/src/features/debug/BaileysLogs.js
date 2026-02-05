import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '@/components/ui/select.jsx';
import { Card } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import { ScrollArea } from '@/components/ui/scroll-area.jsx';
import { formatDateTime, useBaileysEvents } from './hooks/useBaileysEvents.ts';
const LIMIT_OPTIONS = [20, 50, 100, 150];
const STATUS_PAGE_URL = 'https://status.leadengine.com.br';
const directionTone = {
    inbound: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
    outbound: 'bg-sky-500/15 text-sky-600 dark:text-sky-300',
};
const stringifyJson = (value) => {
    try {
        return JSON.stringify(value ?? null, null, 2);
    }
    catch {
        return '<< não foi possível serializar o payload >>';
    }
};
const BaileysLogs = () => {
    const [limit, setLimit] = useState(50);
    const [direction, setDirection] = useState('all');
    const [tenantId, setTenantId] = useState('');
    const [chatId, setChatId] = useState('');
    const buildQuery = useCallback(() => {
        const params = new URLSearchParams();
        params.set('limit', String(limit));
        if (direction !== 'all') {
            params.set('direction', direction);
        }
        if (tenantId.trim().length > 0) {
            params.set('tenantId', tenantId.trim());
        }
        if (chatId.trim().length > 0) {
            params.set('chatId', chatId.trim());
        }
        return params.toString();
    }, [chatId, direction, limit, tenantId]);
    const { events: logs, loading, error, degradedMode, refresh } = useBaileysEvents({
        buildQuery,
        dependencies: [buildQuery],
    });
    const handleManualRefresh = useCallback(() => {
        refresh();
    }, [refresh]);
    const summary = useMemo(() => {
        if (!logs.length) {
            return null;
        }
        const latest = logs[0];
        return {
            lastDirection: latest.direction ?? '—',
            lastTenant: latest.tenantId ?? '—',
            lastInstance: latest.instanceId ?? '—',
            lastChatId: latest.chatId ?? '—',
            lastReceivedAt: formatDateTime(latest.createdAt),
        };
    }, [logs]);
    return (_jsxs("div", { className: "space-y-6", "data-degraded-mode": degradedMode ? 'true' : 'false', children: [_jsxs("div", { className: "flex flex-col gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold tracking-tight", children: "Logs do Baileys" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Visualize os payloads recebidos do conector Baileys para diagnosticar diferen\u00E7as de formato entre inst\u00E2ncias." })] }), _jsxs(Card, { className: "border border-border/60 bg-card/70 p-4 backdrop-blur", children: [_jsxs("div", { className: "flex flex-col gap-4 md:flex-row md:items-end md:justify-between", children: [_jsxs("div", { className: "grid w-full max-w-5xl grid-cols-1 gap-3 md:grid-cols-5", children: [_jsxs("div", { className: "flex flex-col gap-1.5", children: [_jsx("label", { className: "text-xs font-medium uppercase text-muted-foreground", children: "Limite" }), _jsxs(Select, { value: String(limit), onValueChange: (value) => setLimit(Number(value)), disabled: loading, children: [_jsx(SelectTrigger, { children: _jsx(SelectValue, { placeholder: "Limite" }) }), _jsx(SelectContent, { children: LIMIT_OPTIONS.map((option) => (_jsx(SelectItem, { value: String(option), children: option }, option))) })] })] }), _jsxs("div", { className: "flex flex-col gap-1.5", children: [_jsx("label", { className: "text-xs font-medium uppercase text-muted-foreground", children: "Dire\u00E7\u00E3o" }), _jsxs(Select, { value: direction, onValueChange: setDirection, disabled: loading, children: [_jsx(SelectTrigger, { children: _jsx(SelectValue, { placeholder: "Dire\u00E7\u00E3o" }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "all", children: "Todas" }), _jsx(SelectItem, { value: "inbound", children: "Inbound" }), _jsx(SelectItem, { value: "outbound", children: "Outbound" })] })] })] }), _jsxs("div", { className: "flex flex-col gap-1.5", children: [_jsx("label", { className: "text-xs font-medium uppercase text-muted-foreground", children: "Tenant" }), _jsx(Input, { value: tenantId, onChange: (event) => setTenantId(event.target.value), placeholder: "Ex: demo-tenant", disabled: loading })] }), _jsxs("div", { className: "flex flex-col gap-1.5 md:col-span-2", children: [_jsx("label", { className: "text-xs font-medium uppercase text-muted-foreground", children: "Chat / remoteJid" }), _jsx(Input, { value: chatId, onChange: (event) => setChatId(event.target.value), placeholder: "Ex: 5562...@s.whatsapp.net", disabled: loading })] })] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx(Button, { type: "button", variant: "outline", onClick: () => {
                                                    setTenantId('');
                                                    setChatId('');
                                                }, disabled: loading, children: "Limpar" }), _jsx(Button, { type: "button", onClick: handleManualRefresh, disabled: loading, children: loading ? 'Atualizando…' : 'Atualizar' })] })] }), summary ? (_jsxs(_Fragment, { children: [_jsx(Separator, { className: "my-4" }), _jsxs("div", { className: "grid gap-3 text-sm text-muted-foreground md:grid-cols-5", children: [_jsxs("div", { children: [_jsx("span", { className: "text-xs uppercase text-muted-foreground/70", children: "\u00DAltima mensagem" }), _jsx("p", { className: "font-medium text-foreground", children: summary.lastDirection })] }), _jsxs("div", { children: [_jsx("span", { className: "text-xs uppercase text-muted-foreground/70", children: "Tenant" }), _jsx("p", { className: "font-medium text-foreground", children: summary.lastTenant })] }), _jsxs("div", { children: [_jsx("span", { className: "text-xs uppercase text-muted-foreground/70", children: "Inst\u00E2ncia" }), _jsx("p", { className: "font-medium text-foreground", children: summary.lastInstance })] }), _jsxs("div", { className: "truncate", children: [_jsx("span", { className: "text-xs uppercase text-muted-foreground/70", children: "Chat" }), _jsx("p", { className: "font-medium text-foreground", children: summary.lastChatId })] }), _jsxs("div", { children: [_jsx("span", { className: "text-xs uppercase text-muted-foreground/70", children: "Recebido em" }), _jsx("p", { className: "font-medium text-foreground", children: summary.lastReceivedAt })] })] })] })) : null] })] }), error ? (_jsxs("div", { className: "space-y-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-900 dark:border-amber-300/40 dark:bg-amber-400/10 dark:text-amber-100", children: [_jsxs("div", { className: "flex flex-col gap-3", children: [_jsxs("div", { className: "flex flex-col gap-2", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide", children: [_jsx(Badge, { variant: "outline", className: "border-amber-500 bg-amber-500/10 text-amber-900 dark:border-amber-200 dark:bg-amber-200/10 dark:text-amber-50", children: "Modo degradado ativo" }), typeof error.status === 'number' ? (_jsxs("span", { className: "text-amber-800/80 dark:text-amber-100/80", children: ["C\u00F3digo ", error.status] })) : null] }), _jsx("p", { className: "text-base font-medium text-amber-900 dark:text-amber-100", children: error.message }), error.fallbackMessage && error.fallbackMessage !== error.message ? (_jsxs("p", { className: "text-xs text-amber-800/70 dark:text-amber-100/70", children: ["Detalhes t\u00E9cnicos: ", error.fallbackMessage] })) : null, error.requestId ? (_jsxs("p", { className: "text-xs text-amber-800/70 dark:text-amber-100/70", children: ["ID da falha: ", _jsx("code", { children: error.requestId })] })) : null, error.recoveryHint ? (_jsx("p", { className: "text-xs text-amber-800/70 dark:text-amber-100/70", children: error.recoveryHint })) : null] }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx(Button, { type: "button", onClick: refresh, disabled: loading, children: loading ? 'Recarregando…' : 'Tentar novamente' }), _jsx(Button, { asChild: true, variant: "outline", children: _jsx("a", { href: STATUS_PAGE_URL, target: "_blank", rel: "noreferrer", children: "Abrir status page" }) })] })] }), error.payload ? (_jsxs("div", { className: "rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-900 dark:border-amber-200/30 dark:bg-amber-200/5 dark:text-amber-50", children: [_jsx("p", { className: "mb-2 font-semibold uppercase tracking-wide", children: "\u00DAltimo payload recebido" }), _jsx("pre", { className: "max-h-64 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed", children: stringifyJson(error.payload) })] })) : null] })) : null, !logs.length && !loading ? (_jsx("div", { className: "rounded-lg border border-border/60 bg-muted/50 p-8 text-center text-sm text-muted-foreground", children: "Nenhum payload do Baileys encontrado para os filtros informados." })) : null, _jsx("div", { className: "space-y-4", children: logs.map((entry) => {
                    const directionToneClass = directionTone[entry.direction] ?? 'bg-muted text-muted-foreground';
                    return (_jsxs(Card, { className: "border border-border/60 bg-card/80 p-4", children: [_jsxs("div", { className: "flex flex-col gap-3 md:flex-row md:items-center md:justify-between", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2 text-sm", children: [_jsx(Badge, { className: directionToneClass, children: entry.direction ?? '—' }), _jsxs(Badge, { variant: "outline", children: ["tenant: ", entry.tenantId ?? '—'] }), _jsxs(Badge, { variant: "outline", children: ["iid: ", entry.instanceId ?? '—'] }), _jsxs(Badge, { variant: "outline", children: ["chat: ", entry.chatId ?? '—'] }), _jsxs(Badge, { variant: "outline", children: ["msg: ", entry.messageId ?? '—'] })] }), _jsx("p", { className: "text-xs text-muted-foreground", children: formatDateTime(entry.createdAt) })] }), _jsx(Separator, { className: "my-3" }), _jsx(ScrollArea, { className: "rounded-md border border-border/60 bg-muted/40 p-3", viewportProps: { className: 'max-h-[320px] overflow-auto' }, children: _jsx("pre", { className: "whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground", children: stringifyJson(entry.payload) }) })] }, entry.id));
                }) })] }));
};
export default BaileysLogs;
