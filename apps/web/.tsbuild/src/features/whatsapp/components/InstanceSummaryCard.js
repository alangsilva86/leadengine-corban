import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import { cn } from '@/lib/utils.js';
import { formatMetricValue } from '../lib/formatting';
import { resolveConnectionState } from '../lib/connectionStates.js';
import { Collapsible, CollapsibleContent, CollapsibleTrigger, } from '@/components/ui/collapsible.jsx';
import { ChevronDown } from 'lucide-react';
import InstanceActionsMenu from './InstanceActionsMenu.jsx';
const STATUS_LABEL_MAP = {
    connected: 'Conectado',
    reconnecting: 'Reconectando',
    attention: 'Atenção',
    disconnected: 'Desconectado',
};
const STATUS_CHIP_STYLES = {
    connected: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/40',
    reconnecting: 'bg-amber-500/10 text-amber-300 border border-amber-500/40',
    attention: 'bg-amber-500/10 text-amber-300 border border-amber-500/40',
    disconnected: 'bg-rose-500/10 text-rose-300 border border-rose-500/40',
};
const DEFAULT_STATUS_CODES = ['1', '2', '3', '4', '5'];
const computeLoadLevel = (metrics = {}, ratePercentage = 0) => {
    const queued = Number(metrics.queued ?? 0);
    const sent = Number(metrics.sent ?? 0);
    const failed = Number(metrics.failed ?? 0);
    const usage = Number(ratePercentage ?? 0);
    if (queued > 50 || failed > 10 || usage >= 90) {
        return 'alta';
    }
    if (queued > 10 || failed > 0 || usage >= 75) {
        return 'média';
    }
    if (sent === 0 && queued === 0 && failed === 0) {
        return 'baixa';
    }
    return 'baixa';
};
const mapStatusCodes = (statusValues = {}, statusCodeMeta = []) => {
    const knownCodes = statusCodeMeta.length
        ? statusCodeMeta.map((item) => `${item.code}`)
        : DEFAULT_STATUS_CODES;
    return knownCodes.map((code) => {
        const meta = statusCodeMeta.find((item) => `${item.code}` === `${code}`) ?? null;
        const count = Number(statusValues?.[code] ?? statusValues?.[Number(code)] ?? 0);
        return {
            code: `${code}`,
            label: meta?.label ?? code,
            description: meta?.description ?? 'Sem descrição',
            count,
        };
    });
};
const InstanceSummaryCard = ({ viewModel, statusCodeMeta, isBusy, isAuthenticated, deletingInstanceId, onSelectInstance, onViewQr, onRequestDelete, onOpenStatusDrawer, onOpenHealthDrawer, onRenameInstance, onViewLogs, }) => {
    const [showDetails, setShowDetails] = useState(false);
    const [showMetrics, setShowMetrics] = useState(false);
    const { instance, displayName, formattedPhone, addressLabel, statusInfo, metrics, statusValues, rateUsage, ratePercentage, lastUpdatedLabel, isCurrent, } = viewModel;
    const connectionState = resolveConnectionState(statusInfo);
    const loadLevel = computeLoadLevel(metrics, ratePercentage);
    const statusChipClass = STATUS_CHIP_STYLES[connectionState] ?? STATUS_CHIP_STYLES.disconnected;
    const statusCodes = useMemo(() => mapStatusCodes(statusValues, statusCodeMeta), [statusValues, statusCodeMeta]);
    const sortedCodes = useMemo(() => {
        return [...statusCodes].sort((a, b) => b.count - a.count);
    }, [statusCodes]);
    const primaryActionLabel = connectionState === 'connected' ? 'Pausar' : 'Ativar';
    const usagePercentage = Math.max(0, Math.min(100, Number(ratePercentage ?? 0)));
    const usageBarClass = usagePercentage >= 80 ? 'bg-rose-500' : 'bg-indigo-500';
    const primaryDisabled = connectionState === 'connected' ? Boolean(isBusy) : Boolean(isBusy || !isAuthenticated);
    const totalMessages = useMemo(() => {
        const queued = Number(metrics?.queued ?? 0);
        const sent = Number(metrics?.sent ?? 0);
        const failed = Number(metrics?.failed ?? 0);
        return queued + sent + failed;
    }, [metrics]);
    const handlePrimaryAction = () => {
        if (connectionState === 'connected') {
            onSelectInstance?.(instance, { skipAutoQr: true });
            onOpenHealthDrawer?.(viewModel);
        }
        else {
            onViewQr?.(instance);
        }
    };
    const topStatus = sortedCodes[0]?.label ?? 'Código 1';
    return (_jsxs("article", { className: cn('group flex h-full flex-col rounded-2xl border border-slate-800 bg-slate-950/80 p-4 transition-colors hover:border-indigo-500/40 hover:bg-slate-900/80 focus-within:ring-2 focus-within:ring-indigo-500/40', isCurrent ? 'border-indigo-500/60 shadow-[0_0_0_1px_rgba(129,140,248,0.45)]' : null), tabIndex: -1, children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { className: "space-y-1", children: [_jsx("h3", { className: "text-sm font-semibold text-foreground", children: displayName }), _jsxs("p", { className: "text-[0.7rem] uppercase tracking-wide text-muted-foreground", children: ["Inst\u00E2ncia ", instance?.id ?? '—'] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.65rem] font-medium uppercase', statusChipClass), children: STATUS_LABEL_MAP[connectionState] }), _jsx(InstanceActionsMenu, { instance: instance, deletingInstanceId: deletingInstanceId, isBusy: isBusy, isAuthenticated: isAuthenticated, onViewQr: onViewQr, onRequestDelete: onRequestDelete, onRenameInstance: onRenameInstance, onViewLogs: () => onViewLogs?.(viewModel) })] })] }), _jsxs(Collapsible, { open: showDetails, onOpenChange: setShowDetails, className: "mt-2", children: [_jsxs("div", { className: "flex items-center justify-between text-[0.7rem] text-muted-foreground", children: [_jsxs("span", { children: ["Atualizado \u2014 ", lastUpdatedLabel || '—'] }), _jsx(CollapsibleTrigger, { asChild: true, children: _jsxs(Button, { variant: "ghost", size: "sm", className: "h-7 px-2 text-[0.65rem] uppercase tracking-wide", children: [_jsx(ChevronDown, { className: cn('mr-1 h-3.5 w-3.5 transition-transform', showDetails ? 'rotate-180' : '') }), showDetails ? 'Recolher detalhes' : 'Detalhes'] }) })] }), _jsxs(CollapsibleContent, { className: "mt-2 grid gap-2 text-[0.8rem] text-muted-foreground sm:grid-cols-2", children: [_jsxs("div", { className: "rounded-lg border border-slate-800/80 bg-slate-950/60 p-2", children: [_jsx("p", { className: "text-[0.65rem] uppercase tracking-wide text-slate-400", children: "Telefone" }), _jsx("p", { className: "text-sm text-foreground", children: formattedPhone || '—' })] }), _jsxs("div", { className: "rounded-lg border border-slate-800/80 bg-slate-950/60 p-2", children: [_jsx("p", { className: "text-[0.65rem] uppercase tracking-wide text-slate-400", children: "Remetente" }), _jsx("p", { className: "text-sm text-foreground", children: addressLabel || '—' })] })] })] }), _jsx(Collapsible, { open: showMetrics, onOpenChange: setShowMetrics, className: "mt-4 space-y-2", children: _jsxs("div", { className: "rounded-xl border border-slate-800/70 bg-slate-950/70 p-3", children: [_jsxs("div", { className: "flex items-center justify-between gap-2 text-[0.65rem] uppercase tracking-wide text-slate-400", children: [_jsx("span", { children: "M\u00E9tricas" }), _jsx(CollapsibleTrigger, { asChild: true, children: _jsxs(Button, { variant: "ghost", size: "sm", className: "h-7 px-2 text-[0.65rem] uppercase tracking-wide", children: [_jsx(ChevronDown, { className: cn('mr-1 h-3.5 w-3.5 transition-transform', showMetrics ? 'rotate-180' : '') }), showMetrics ? 'Ocultar' : 'Ver completas'] }) })] }), _jsxs("p", { className: "mt-2 text-sm font-semibold text-foreground", children: ["Total ", formatMetricValue(totalMessages), " \u2022 Ganhos ", formatMetricValue(metrics?.sent)] }), _jsxs(CollapsibleContent, { className: "mt-3 space-y-3", children: [_jsxs("div", { className: "grid grid-cols-3 gap-2", children: [_jsxs("div", { className: "rounded-lg border border-slate-800/80 bg-slate-950/60 p-2", children: [_jsx("p", { className: "text-[0.6rem] uppercase tracking-wide text-slate-400", children: "Env." }), _jsx("p", { className: "text-sm font-semibold text-foreground", children: formatMetricValue(metrics?.sent) })] }), _jsxs("div", { className: "rounded-lg border border-slate-800/80 bg-slate-950/60 p-2", children: [_jsx("p", { className: "text-[0.6rem] uppercase tracking-wide text-slate-400", children: "Fila" }), _jsx("p", { className: "text-sm font-semibold text-foreground", children: formatMetricValue(metrics?.queued) })] }), _jsxs("div", { className: "rounded-lg border border-slate-800/80 bg-slate-950/60 p-2", children: [_jsx("p", { className: "text-[0.6rem] uppercase tracking-wide text-slate-400", children: "Falhas" }), _jsx("p", { className: "text-sm font-semibold text-foreground", children: formatMetricValue(metrics?.failed) })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between text-[0.65rem] uppercase tracking-wide text-slate-400", children: [_jsx("span", { children: "C\u00F3digos de status" }), _jsxs("span", { className: "text-[0.6rem] lowercase text-slate-500", children: ["Top: ", topStatus] })] }), _jsx("div", { className: "flex items-center gap-1", children: statusCodes.map((code) => {
                                                const isActive = code.count > 0;
                                                const toneClass = isActive ? 'bg-indigo-400' : 'bg-slate-800';
                                                return (_jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsx("button", { type: "button", className: cn('h-2.5 w-2.5 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60', toneClass), onClick: () => onOpenStatusDrawer?.(viewModel), "aria-label": `Código ${code.label}: ${formatMetricValue(code.count)}` }) }), _jsxs(TooltipContent, { side: "bottom", className: "text-xs", children: [_jsxs("p", { className: "font-medium", children: ["C\u00F3digo ", code.label] }), _jsx("p", { children: code.description }), _jsxs("p", { className: "mt-1 text-[0.6rem] uppercase tracking-wide text-slate-400", children: [formatMetricValue(code.count), " ocorr\u00EAncia(s)"] })] })] }, code.code));
                                            }) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("div", { className: "flex items-center justify-between text-[0.65rem] uppercase tracking-wide text-slate-400", children: _jsxs("span", { children: ["Utiliza\u00E7\u00E3o do limite ", usagePercentage, "%"] }) }), _jsx("div", { className: "h-[6px] w-full overflow-hidden rounded-full bg-slate-900", children: _jsx("div", { className: cn('h-full rounded-full transition-all', usageBarClass), style: { width: `${usagePercentage}%` } }) }), _jsxs("p", { className: "text-[0.65rem] text-slate-400", children: ["Usadas ", formatMetricValue(rateUsage?.used), " | Limite ", formatMetricValue(rateUsage?.limit)] })] })] })] }) }), _jsxs("div", { className: "mt-5 flex flex-wrap items-center justify-between gap-2 text-[0.65rem] uppercase tracking-wide text-slate-500", children: [_jsxs("span", { className: "flex items-center gap-2", children: ["Carga ", loadLevel] }), _jsx("span", { className: cn('inline-flex items-center gap-1 rounded-full border border-slate-800/70 px-2 py-0.5 text-[0.6rem] font-medium', loadLevel === 'alta' ? 'text-rose-300' : loadLevel === 'média' ? 'text-amber-300' : 'text-emerald-300'), children: lastUpdatedLabel ? `Última atualização ${lastUpdatedLabel}` : 'Sem atualização recente' })] }), _jsx("div", { className: "mt-4 flex flex-col gap-2", children: _jsx(Button, { size: "sm", className: "w-full", onClick: handlePrimaryAction, disabled: primaryDisabled, children: primaryActionLabel }) })] }));
};
export default InstanceSummaryCard;
