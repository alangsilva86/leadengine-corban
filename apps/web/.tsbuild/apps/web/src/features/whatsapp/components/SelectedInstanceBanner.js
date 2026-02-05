import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, } from '@/components/ui/dropdown-menu.jsx';
import { cn } from '@/lib/utils.js';
import { formatPhoneNumber, formatMetricValue } from '../lib/formatting';
import { Activity, AlarmClock, EllipsisVertical, Gauge, Inbox, Link2, Plus, RefreshCcw, Zap, CheckCircle2, Clock3, CircleDot, } from 'lucide-react';
const QR_STATUS_VARIANTS = {
    connected: 'bg-emerald-500/10 text-emerald-200 border border-emerald-400/40',
    connecting: 'bg-sky-500/10 text-sky-100 border border-sky-400/40',
    qr_required: 'bg-amber-500/10 text-amber-200 border border-amber-400/40',
    disconnected: 'bg-rose-500/10 text-rose-200 border border-rose-400/40',
    fallback: 'bg-slate-800/70 text-slate-200 border border-slate-700',
};
const SelectedInstanceBanner = ({ copy, summary, selectedInstance, selectedInstanceStatusInfo, selectedInstancePhone, instancesCountLabel, onMarkConnected, localStatus, onRefresh, onCreateInstance, createInstanceDisabled = false, createInstanceWarning = null, onViewLogs, loadingInstances, isAuthenticated, qrStatusMessage, countdownMessage, journeySteps, canContinue, readinessChecklist, }) => {
    const selectedName = selectedInstance?.name || selectedInstance?.id || 'Selecione um canal';
    const formattedPhone = selectedInstance ? formatPhoneNumber(selectedInstancePhone) : null;
    const showMarkConnected = Boolean(onMarkConnected) && localStatus !== 'connected';
    const normalizedSummary = summary ??
        {
            state: 'loading',
            totals: { connected: 0, attention: 0, reconnecting: 0, disconnected: 0 },
            queueTotal: 0,
            failureTotal: 0,
            usageAverage: 0,
            lastSyncLabel: '—',
        };
    const qrBadgeClass = QR_STATUS_VARIANTS[localStatus] ?? QR_STATUS_VARIANTS.fallback;
    const timeline = Array.isArray(journeySteps) && journeySteps.length > 0 ? journeySteps : null;
    const checklist = Array.isArray(readinessChecklist) && readinessChecklist.length > 0 ? readinessChecklist : null;
    const renderChecklistIcon = (state) => {
        if (state === 'done') {
            return _jsx(CheckCircle2, { className: "h-4 w-4 text-emerald-300" });
        }
        if (state === 'progress') {
            return _jsx(Clock3, { className: "h-4 w-4 text-amber-200" });
        }
        return _jsx(CircleDot, { className: "h-4 w-4 text-slate-300" });
    };
    const renderSummaryContent = () => {
        if (normalizedSummary.state === 'ready') {
            return (_jsxs("div", { className: "flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground", children: [_jsxs(Badge, { className: "flex items-center gap-2 rounded-full bg-slate-900/70 px-3 py-1 text-[0.65rem] text-slate-200", children: [_jsx(Activity, { className: "h-3.5 w-3.5 text-indigo-300" }), "Fila total: ", formatMetricValue(normalizedSummary.queueTotal)] }), _jsxs(Badge, { className: "flex items-center gap-2 rounded-full bg-slate-900/70 px-3 py-1 text-[0.65rem] text-slate-200", children: [_jsx(Zap, { className: "h-3.5 w-3.5 text-emerald-300" }), "Falhas 24h: ", formatMetricValue(normalizedSummary.failureTotal)] }), _jsxs(Badge, { className: "flex items-center gap-2 rounded-full bg-slate-900/70 px-3 py-1 text-[0.65rem] text-slate-200", children: [_jsx(Gauge, { className: cn('h-3.5 w-3.5', normalizedSummary.usageAverage >= 80 ? 'text-rose-200' : normalizedSummary.usageAverage >= 60 ? 'text-amber-200' : 'text-emerald-200') }), "Uso m\u00E9dio: ", normalizedSummary.usageAverage, "%"] }), _jsxs(Badge, { className: "flex items-center gap-2 rounded-full bg-slate-900/70 px-3 py-1 text-[0.65rem] text-slate-200", children: [_jsx(AlarmClock, { className: "h-3.5 w-3.5 text-slate-300" }), "\u00DAltima sync: ", normalizedSummary.lastSyncLabel] }), instancesCountLabel ? (_jsx("span", { className: "ml-2 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground/80", children: instancesCountLabel })) : null] }));
        }
        if (normalizedSummary.state === 'loading') {
            return (_jsxs("div", { className: "flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground", children: [_jsx(Badge, { variant: "status", tone: "info", children: "Sincronizando inst\u00E2ncias\u2026" }), instancesCountLabel ? _jsx("span", { children: instancesCountLabel }) : null] }));
        }
        return _jsx("span", { className: "text-xs text-muted-foreground", children: instancesCountLabel || 'Nenhuma instância cadastrada.' });
    };
    return (_jsxs("div", { className: "space-y-6", children: [timeline ? (_jsx("nav", { "aria-label": "Jornada WhatsApp", className: "flex flex-wrap items-center gap-3 text-xs font-medium uppercase", children: timeline.map((step, index) => {
                    const isLast = index === timeline.length - 1;
                    const statusClass = step.status === 'current'
                        ? 'border-indigo-400/50 bg-indigo-500/10 text-indigo-200'
                        : step.status === 'ready'
                            ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
                            : 'border-slate-700 bg-slate-900/60 text-muted-foreground';
                    return (_jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("div", { className: cn('flex items-center gap-2 rounded-full border px-4 py-1.5 text-[0.7rem] tracking-wide transition', statusClass), children: [_jsx("span", { children: step.label }), step.status === 'ready' ? _jsx("span", { className: "text-[0.65rem] text-emerald-200/90", children: "Pronto" }) : null, step.status === 'current' ? _jsx("span", { className: "text-[0.65rem] text-indigo-200/80", children: "Agora" }) : null] }), !isLast ? _jsx("span", { className: "h-0.5 w-6 rounded-full bg-slate-800" }) : null] }, step.key || step.label));
                }) })) : null, renderSummaryContent(), checklist ? (_jsx("div", { className: "grid gap-2 md:grid-cols-3", children: checklist.map((item) => {
                    const toneClass = item.state === 'done'
                        ? 'border-emerald-500/40 bg-emerald-500/5'
                        : item.state === 'progress'
                            ? 'border-amber-500/40 bg-amber-500/5'
                            : 'border-slate-800/70 bg-slate-950/70';
                    return (_jsxs("div", { className: cn('flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm text-muted-foreground transition', toneClass), children: [_jsx("div", { className: "mt-0.5 shrink-0", children: renderChecklistIcon(item.state) }), _jsxs("div", { className: "space-y-1", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-wide text-foreground", children: item.label }), item.meta ? _jsx("p", { className: "text-[0.8rem] leading-relaxed text-muted-foreground", children: item.meta }) : null] })] }, item.key || item.label));
                }) })) : null, _jsx("div", { className: "rounded-3xl border border-slate-800/60 bg-slate-950/70 p-4 shadow-[0_10px_40px_rgba(15,23,42,0.35)]", children: _jsxs("div", { className: "flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-3 text-sm text-muted-foreground", children: [_jsx("span", { className: "text-base font-semibold text-foreground", children: selectedName }), selectedInstanceStatusInfo ? (_jsx(Badge, { variant: selectedInstanceStatusInfo.variant, children: selectedInstanceStatusInfo.label })) : null, qrStatusMessage ? (_jsx("span", { className: cn('rounded-full px-3 py-1 text-[0.65rem] font-medium uppercase', qrBadgeClass), children: countdownMessage && countdownMessage !== qrStatusMessage ? countdownMessage : qrStatusMessage })) : null, selectedInstance ? (_jsxs("span", { className: "text-xs text-muted-foreground/80", children: ["Telefone: ", formattedPhone || selectedInstancePhone || '—'] })) : (_jsx("span", { className: "text-xs text-muted-foreground/80", children: copy?.description || 'Selecione uma instância para continuar.' }))] }), _jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [showMarkConnected ? (_jsx(Button, { onClick: onMarkConnected, size: "sm", variant: "outline", className: "rounded-full", children: "Marcar como conectado" })) : null, _jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsxs(Button, { variant: "ghost", size: "icon", className: "h-10 w-10 rounded-full border border-slate-800/80", children: [_jsx(EllipsisVertical, { className: "h-5 w-5" }), _jsx("span", { className: "sr-only", children: "Mais a\u00E7\u00F5es" })] }) }), _jsxs(DropdownMenuContent, { align: "end", className: "w-52", children: [_jsxs(DropdownMenuItem, { onSelect: (event) => {
                                                        event.preventDefault();
                                                        onRefresh?.();
                                                    }, disabled: loadingInstances || !isAuthenticated, className: "gap-2", children: [_jsx(RefreshCcw, { className: "h-4 w-4" }), " Atualizar lista"] }), _jsxs(DropdownMenuItem, { onSelect: (event) => {
                                                        event.preventDefault();
                                                        onCreateInstance?.();
                                                    }, disabled: createInstanceDisabled, title: createInstanceWarning ?? undefined, className: "gap-2", children: [_jsx(Plus, { className: "h-4 w-4" }), " Nova inst\u00E2ncia"] }), onViewLogs ? (_jsxs(DropdownMenuItem, { onSelect: (event) => {
                                                        event.preventDefault();
                                                        onViewLogs?.();
                                                    }, className: "gap-2", children: [_jsx(Link2, { className: "h-4 w-4" }), " Logs da inst\u00E2ncia"] })) : null, _jsxs(DropdownMenuItem, { disabled: true, className: "gap-2 text-muted-foreground", children: [_jsx(Inbox, { className: "h-4 w-4" }), canContinue ? 'Pronto para Inbox' : 'Selecione uma instância conectada'] })] })] })] })] }) })] }));
};
export default SelectedInstanceBanner;
